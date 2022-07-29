<?php
require_once('obscure.php');
obscure(__FILE__);

require_once('DButil.php');
require_once('DBC.php');
require_once('DBV.php');
require_once('DBR.php');

//Database Table... extended to become a DBR
class DBT {
    private static $tables = array();

    private static ?ReflectionClass $DBRreflection = null;
    private static ?ReflectionClass $DBJRreflection = null;
    private static ?ReflectionClass $DBVreflection = null;

    /* A reflection of the classes for type-checking ReflectionClass
     * objects returned from implementations.
     *
     * Variables' values are constructed when it is first needed by the DBT
     * constructor, since it can't be constructed at compile-time.
     */

    protected static final function getDBT(string $name, ?DBC &$dbc = null) : DBT {
        //lazy getter
        if (key_exists($name, DBT::$tables)) {
            return DBT::$tables[$name];
        } else {
            $DBRimplementation = new ReflectionClass(static::class);
            $DBRreflection = DBT::$DBRreflection ??
                    (DBT::$DBRreflection = new ReflectionClass(DBR::class));

            if (!($DBRimplementation->isSubclassOf($DBRreflection))) {
                $DBJRreflection = DBT::$DBJRreflection ??
                        (DBT::$DBJRreflection = new ReflectionClass(DBJR::class));

                if (!($DBRimplementation->isSubclassOf($DBJRreflection))) {
                    echo static::class;
                    throw new DBerror('Invoking DBT:getDBT from invalid implementation:\n'
                            . $DBRimplementation);
                }
            }

            return DBT::$tables[$name] = new DBT($name, $DBRimplementation, $dbc);
        }
    }



    private ?string $name = null;
    private ?string $escapedName = null;
    private array $descriptors;
    private array $primaryKey;
    private array $fields;
    private array $all;
    private ?ReflectionClass $DBRimplementation = null;
    private ?ReflectionMethod $validateInsert = null;
    private ?ReflectionMethod $validateConstruction = null;
    private bool $checkFK = true;

    private function __construct(string $name, ReflectionClass $DBRimplementation,
            ?DBC &$dbc = null) {

        $this->name = $name;
        $this->DBRimplementation = $DBRimplementation;

        $dbc = $dbc ?? DBC::get();

        $escapedName = $dbc->escape_string($name);
        $this->escapedName = $escapedName;

        $dbc->lockTable($this);

        $result = $dbc->query("DESCRIBE `$escapedName`");

        if (!($result && $result->num_rows > 0)) {
            throw new DBerror("Descriptor could not be found for table `$name`");
        }

        $pkResult = $dbc->query("SHOW INDEX FROM `$escapedName` WHERE Key_name = 'PRIMARY'");
        if (!($pkResult && $pkResult->num_rows > 0)) {
            throw new DBerror("No primary keys found for table $name");
        }

        $fields = array();

        // Parse type and add appropriate phpType values
        while ($row = $result->fetch_array(MYSQLI_ASSOC)) {
            $fields[$row['Field']] = $this->parseInitialDescriptor($row);
        }

        $primaryKey = array();
        // determine primary keys

        while($row = $pkResult->fetch_array(MYSQLI_ASSOC)) {
            $field = $row['Column_name'];
            if (!key_exists($field, $fields)) {

                throw new DBerror("Mismatch between fields and primary key $field in table $name");
            }

            $primaryKey[$field] = null; //key will be used later to seperate out the two arrays
            $fields[$field]['primaryKey'] = true;
        }



        //validate descriptor with DBR subclass implementations
        foreach($fields as $field => &$descriptor) {
            $descriptor = $this->validateDescriptor($field, $descriptor, $DBRimplementation);
            if ($descriptor === null) unset($fields[$field]);
        }

        $all = $fields;

        //split off primary key array
        foreach ($primaryKey as $field => $value) {
            $primaryKey[$field] = $fields[$field];
            unset($fields[$field]);
        }


        $this->descriptors = array (
                'tableName' => $name,
                'primaryKey' => $primaryKey,
                'fields' => $fields,
            );
        $this->primaryKey = $primaryKey;
        $this->fields = $fields;
        $this->all = $all;
    }

    private function parseInitialDescriptor(array &$descriptor) : array {
        $descriptor['auto_increment']
                = str_contains($descriptor['Extra'], 'auto_increment');

        $descriptor['primaryKey'] = false; //will be overridden

        if ($descriptor['Null'] === 'YES') {
            $descriptor['null'] = true;

        } else if ($descriptor['Null'] === 'NO') {
            $descriptor['null'] = false;

        } else throw new DBerror();

        if (key_exists($descriptor['Type'], NONSTANDARD_NUMBER_TYPES)) {
            foreach(NONSTANDARD_NUMBER_TYPES[$descriptor['Type']] as $key => $val) {
                $descriptor[$key] = $val;
            }
            return $descriptor;
        }

        $type = $type = substr($descriptor['Type'], 0, 7);
        $getReflectionClass = false;

        if ($type === 'tinyint') {
            //tinyint is assumed to be a boolean.  If it is not, then override using validatePhpType
            $descriptor['phpType'] = 'boolean';

        } else if ($type === 'varchar' || substr($type, 0, 4) === 'char') {
            $descriptor['phpType'] = 'string';
            $descriptor['maxLen'] = intval(trim($descriptor['Type'], 'varchar()'));

        } else if ($type === 'decimal' || $type === 'numeric' || substr($descriptor['Type'], 0, 8) === 'smallint'
                || ($type = substr($type, 0, 3)) === 'int') {

            // parse out the numerical parameters of this field

            $sigDigits = trim($descriptor['Type'], 'intdecmalnursg() ');

            if ($sigDigits === '') $sigDigits = array();
            else $sigDigits = explode(',', $sigDigits);

            foreach ($sigDigits as $index => $value) {
                $value = trim($value);
                $intval = intval($value);
                if ($value !== ($intval . '')) {
                    //outputVar($descriptor);
                    throw new DBerror("Error parsing sigdigits from '" . $descriptor['Type'] . "'");
                }
                $sigDigits[$index] = $intval;
            }

            switch (count($sigDigits)) {
                case 2:
                    if ($type === 'int') throw new DBerror();
                    if($sigDigits[0] <= 0 || $sigDigits[1] < 0
                            || $sigDigits[1] > $sigDigits[0]) {
                        throw new DBerror();
                    }

                    $descriptor['leftDigits'] = $sigDigits[0] - $sigDigits[1];
                    $descriptor['rightDigits'] = $sigDigits[1];

                    if ($sigDigits[1] > 0) {
                        $descriptor['phpType'] = 'double';
                        $descriptor['maxVal'] = floatval(str_repeat('9', $descriptor['leftDigits'])
                                . '.' . str_repeat('9', $descriptor['rightDigits']));
                        $descriptor['minVal'] = -$descriptor['maxVal'];

                        break;
                    }

                    // if $sigDigits[1] === 0 then treat as an integer...
                    // fall through to below code

                case 1:
                    if($sigDigits[0] <= 0) throw new DBerror();
                    $sigDigits = $sigDigits[0];
                    $descriptor['phpType'] = 'integer';
                    $descriptor['maxVal'] = intval(str_repeat('9', $sigDigits));
                    $descriptor['minVal'] = -$descriptor['maxVal'];
                    break;


                //use default mySQL limits for the type
                case 0:
                    $descriptor['phpType'] = 'integer';
                    if ($type === 'int') {
                        $descriptor['minVal'] = -2147483648;
                        $descriptor['maxVal'] = 2147483647;

                    } else {
                        $descriptor['leftDigits'] = 10;
                        $descriptor['rightDigits'] = 0;
                        $descriptor['minVal'] = -9999999999;
                        $descriptor['maxVal'] = 9999999999;
                    }
                    break;


                default:
                    throw new DBerror();
            }
        } else {
            $descriptor['phpType'] = 'object';
        }

        return $descriptor;
    }

    private function validateDescriptor($field, array &$descriptor, ReflectionClass $DBRimplementation) {
        // Validate user-facing label and phpType
        if (!$DBRimplementation->getMethod('validateUseField')
                                ->invoke(null, $field, $descriptor)) {
            return null;
        }

        $descriptor['label'] = $DBRimplementation->getMethod('validateLabel')
                                    ->invoke(null, $field, $descriptor);

        $descriptor['null'] = $DBRimplementation->getMethod('validateNull')
                                    ->invoke(null, $field, $descriptor['null'], $descriptor);

        $descriptor['phpType'] = $DBRimplementation->getMethod('validatePhpType')
                                    ->invoke(null, $field, $descriptor['phpType'], $descriptor);


        // for object and undefined phpTypes, get a DBV class...
        // if provided, the phpType will default to 'object', otherwise to 'null
        if ($descriptor['phpType'] === 'object' || $descriptor['phpType'] === null) {
            $reflectionClass = $DBRimplementation->getMethod('getDBVclass')
                    ->invoke(null, $field, $descriptor['Type']);

            if ($reflectionClass === null) {
                $descriptor['phpType'] = null;

            } else {
                if (DBT::$DBVreflection === null) {
                    DBT::$DBVreflection = new ReflectionClass('DBV');
                }

                if (!$reflectionClass->isSubclassOf(DBT::$DBVreflection)) {
                    throw new DBerror('Invalid ReflectionClass. Must be a subclass of DBV.');
                }

                $descriptor['reflectionClass'] = $reflectionClass;
                $descriptor['phpType'] = 'object';
            }

        }

        //minLen and maxLen for strings and undefined types
        if ($descriptor['phpType'] === 'string') { //|| $descriptor['phpType'] === null) {
            $minLen = $DBRimplementation->getMethod('validateMinLen')
                                        ->invoke(null, $field, $descriptor);
            if ($minLen !== null) $descriptor['minLen'] = $minLen;

            //maxLen may have already been set, therefore handling is slightly different
            if (key_exists('maxLen', $descriptor)) {
                $maxLen = $descriptor['maxLen'];
            } else {
                $maxLen = null;
            }

            $descriptor['maxLen'] = $DBRimplementation->getMethod('validateMaxLen')
                                        ->invoke(null, $field, $maxLen, $descriptor);

            if ($descriptor['maxLen'] === null) unset ($descriptor['maxLen']);



            $descriptor['minLen'] = $DBRimplementation->getMethod('validateMinLen')
                            ->invoke(null, $field, $descriptor);

            if ($descriptor['minLen'] === null) unset ($descriptor['minLen']);

        } else if(key_exists('maxLen', $descriptor)) {
            unset($descriptor['maxLen']);
        }


        //limits for numerical types
        if ($descriptor['phpType'] === 'integer' || $descriptor['phpType'] === 'double') {

            // set default min/max values if they haven't already been set (aka if
            // the phpType value was changed by implementation's validatePhpType above)
            if ($descriptor['phpType'] === 'integer') {
                // for integers
                if (!key_exists('minVal', $descriptor)) {
                    if(key_exists('maxVal', $descriptor)) throw new DBerror();

                    $descriptor['minVal'] = -2147483648;
                    $descriptor['maxVal'] = 2147483647;

                } else if (!key_exists('maxVal', $descriptor)) throw new DBerror();

                $methodSuffix = 'Int';



            } else if ($descriptor['phpType'] === 'double') {
                // for double / float  (decimal/numeric in mySQL)
                //left and right significant digits.  Set defaults if they don't exist, then validate

                if (!key_exists('leftDigits', $descriptor)) {
                    if(key_exists('rightDigits', $descriptor)) throw new DBerror();

                    //defaults from mySQL
                    $descriptor['leftDigits'] = 10;
                    $descriptor['rightDigits'] = 0;

                } else if (!key_exists('rightDigits', $descriptor)) throw new DBerror();


                //left digits
                $left = $DBRimplementation->getMethod('validateLeftDigits')
                            ->invoke(null, $field, $descriptor['leftDigits'], $descriptor);

                if (gettype($left) !== 'integer' || $left <= 0)
                    throw new DBtypeMismatch();

                $descriptor['leftDigits'] = $left;


                //right digits
                $right = $DBRimplementation->getMethod('validateRightDigits')
                            ->invoke(null, $field, $descriptor['rightDigits'], $descriptor);

                if (gettype($right) !== 'integer' || $right < 0 || $right > $left)
                    throw new DBtypeMismatch();

                $descriptor['rightDigits'] = $right;


                //set default min/max values
                if (!key_exists('minVal', $descriptor)) {
                    if(key_exists('maxVal', $descriptor)) throw new DBerror();

                    $descriptor['maxVal'] = floatval(str_repeat('9', $descriptor['leftDigits'])
                            . '.' . str_repeat('9', $descriptor['rightDigits']));

                    $descriptor['minVal'] = -$descriptor['maxVal'];

                } else if (!key_exists('maxVal', $descriptor)) throw new DBerror();

                $methodSuffix = 'Float';
            }



            // minimum value for both ints and floats
            $minval = $DBRimplementation->getMethod('validateMin' . $methodSuffix)
                                        ->invoke(null, $field, $descriptor['minVal'], $descriptor);

            $castval = $minval;
            settype($castval, $descriptor['phpType']);

            if (($minval . '') !== ($castval . '') || $minval < $descriptor['minVal'])
                throw new DBtypeMismatch();

            $descriptor['minVal'] = $minval;


            // maximum value
            $maxval = $DBRimplementation->getMethod('validateMax' . $methodSuffix)
                                        ->invoke(null, $field, $descriptor['maxVal'], $descriptor);

            $castval = $maxval;
            settype($castval, $descriptor['phpType']);

            if (($maxval . '') !== ($castval . '') || $maxval <= $minval
                    || $maxval > $descriptor['maxVal'])
                throw new DBtypeMismatch();

            $descriptor['maxVal'] = $maxval;


        } else {
            //non-numeric types
            if (key_exists('minVal', $descriptor)) {
                if(!key_exists('maxVal', $descriptor)) throw new DBerror();
                unset($descriptor['minVal']);
                unset($descriptor['maxVal']);

                if(key_exists('leftDigits', $descriptor)) {
                    if(!key_exists('rightDigits', $descriptor)) throw new DBerror();
                    unset($descriptor['rightDigits']);
                    unset($descriptor['leftDigits']);
                }

            } else {
                if (key_exists('maxVal', $descriptor) || key_exists('leftDigits', $descriptor)
                        || key_exists('rightDigits', $descriptor)) {
                    throw new DBerror();
                }
            }
        }

        return $descriptor;
    }

    public function __toString() {
        return $this->getTableName();
    }

    public function getTableName() : string {
        return $this->name;
    }

    public function getEscapedTableName(bool $addTickMarks = false) : string {
        if ($addTickMarks) return '`' . $this->escapedName . '`';
        else return $this->escapedName;
    }

    public function getTableDescriptors() : array {
        return $this->descriptors;
    }

    // difference between this and getTableDescriptors is that this array is flattened
    public function getAllDescriptors() : array {
        return $this->all;
    }

    public function getFieldDescriptors() : array {
        return $this->fields;
    }

    public function getPrimaryKeyDescriptors() : array {
        return $this->primaryKey;
    }

    public function getDBRimplementationReflection() : ReflectionClass {
        return $this->DBRimplementation;
    }


    public function writeSelectClause(?DBC &$dbc = null) : string {
        return implode(', ',
                $this->DBRimplementation->getMethod('getSelectFields')
                                            ->invokeArgs(null, array(&$dbc))  );
    }

    // if null is passed, then $_POST superglobal is used by default
    public function extractPrimaryKeyFromHTTP(?array $values = null) : array {
        // The below code was taken and tweaked from DBR __construct
        // NOTE: potential weakness in this abbreviated code -- unlike during DBR instance construction
        // the field values (non-PK) do not undergo typecasting and validation / checks.
        // Therefore, the $values array passed to validateConstruction is possibly inaccurate
        // This is only a problem if validateConstruction in the subclass implementation
        // relies upon those values being properly formed when validating the primary key field(s).

        if ($values === null) $values = $_POST;
        $primaryKey = array();
        foreach($this->primaryKey as $field => $descriptor) {
            if(!key_exists($field, $values)) throw new FieldValidationError('Missing primary key field');
            $primaryKey[$field] = $this->typeCastFromHTML($field, $values[$field]);
            $values[$field] = &$primaryKey[$field];
        }

        if ($this->validateConstruction === null) {
            $this->validateConstruction
                    = $this->DBRimplementation->getMethod('validateConstruction');
        }

        foreach ($primaryKey as $field => $value) {
            $this->primaryKey[$field] =
                    $this->checkValidation($field,
                            $this->validateConstruction->invoke(null, $field, $value, $values)
                        );
        }

        return $primaryKey;
    }


    // NOTE:  Does NOT include the 'WHERE' keyword ... 'LIMIT 1', etc...
    // ONLY the list of conditions!
    public function writeWhereClause($key, ?string $tableAlias = null,
            bool $requireFullPrimaryKey = true, ?DBC &$dbc = null) : string {

        $dbc = $dbc ?? DBC::get();

        if ($tableAlias === null) {
            $tableAlias = '';

        } else if ($tableAlias !== '') {
            //automatically adds the tick marks and dot
            $tableAlias = '`' . $dbc->escape_string($tableAlias) . '`.';
        }


        if (($type = gettype($key)) !== 'array') {
            if ($type === 'object' && $this->DBRimplementation->isInstance($key)) {
                $instance = $key;
                $key = array();
                foreach ($this->primaryKey as $field => $descriptor) {
                    $key[$field] = $instance->get($field);
                }

            } else {
                // if only one scalar/object value is submitted, it should be assigned
                // to the one and only primary key.  Will throw an error if
                // there is more than one PK in the table descriptors

                if (count($this->primaryKey) !== 1) {
                    // line length ???
                    throw new DBerror('Invalid non-array value submitted for table'
                            . 'with composite Primary Key: ' . $this->name);
                }
                foreach ($this->primaryKey as $field => $descriptor) {
                    $key = array($field => $key);
                    break;
                }
            }
        }

        $query = array();
        foreach($this->all as $field => $descriptor) {
            if(key_exists($field, $key)) {
                $value = $key[$field];

            } else if ($requireFullPrimaryKey && $descriptor['primaryKey']) {
                throw new DBerror('Missing primary key field ' . $field
                        . ' in table ' . $this->name);

            } else {
                continue;
            }

            $value = $this->checkValidation($field, $value);
            $field = $tableAlias . '`' . $dbc->escape_string($field) . '`';

            switch (gettype($value)) {
                case 'string' :
                    $value = "= '" . $dbc->escape_string($value) . "'";
                    break;

                case 'object':
                    $value = '= '. $value->toSQLstring($dbc);
                    break;

                case 'double':
                    $value = rtrim(implode($this->splitDecimal($value), '.'), '.');
                    //fall through...

                case 'integer':
                    $value = '= ' . $value;
                    break;

                case 'boolean':
                    $value = '= ' . ($value ? 'TRUE' : 'FALSE');
                    break;

                case 'NULL':
                    $value = 'IS NULL';
                    break;

                default:
                    throw new DBtypeMismatch();
            }
            $query[] = "$field $value";

        }

        return implode(' AND ', $query);
    }


    // ?? should probably delete this if not being used
    public static function insertInto(string $table, $values, ?DBC &$dbc = null) : DBR {
        static::getDBT($table)->insert($values, $dbc);
    }

    public function setCheckForeignKey(bool $checkFK) {
        $this->checkFK = $checkFK;
    }

    public function getCheckForeignKey() : bool {
        return $this->checkFK;
    }


    //returns the key to access the inserted record
    public function insert($values, ?DBC &$dbc = null) {

        $dbc = $dbc ?? DBC::get();

        $auto_increment = null; //field name of auto_increment id
        $primaryKey = array(); //for lookup after insertion
        $refinedValues = array();

        $errors = null;

        foreach ($values as $field => $value) {
            if (!key_exists($field, $this->all)) {
                if ($errors === null) $errors = new InsertError();
                $errors->errors[$field] = new FieldValidationError("Nonexistent field `$field`");
            }
        }

        foreach ($this->all as $field => $descriptor) {
            if ($descriptor['primaryKey'])  $primaryKey[$field] = null;
                //establishing the field set of the PK for lookup after insertion

            if($descriptor['auto_increment']) {
                if($auto_increment !== null)
                    throw new DBerror('More than one auto_increment field in this insert');

                $auto_increment = $field;
                continue;

            } else if (key_exists($field, $values)) {
                //TO DO -- create a descriptor property about whether to trim inputs for string/varchar
                if (gettype($values[$field]) === 'string')
                    $values[$field] = trim($values[$field]);

                try {
                    $refinedValues[$field] = $this->typeCastFromHTML($field, $values[$field]);

                } catch (FieldValidationError $e) {
                    //echo $e;
                    $errors = $errors ?? new InsertError();
                    $errors->errors[$field] = $e;
                }
            } else if ($descriptor['null'] === false || $descriptor['Null'] === 'NO') {
                $refinedValues[$field] = null;
                //forces the FieldValidation error to be thrown below by checkValidation
            }
        }


        // call static::validateInsert, and construct insert query
        $escapedFields = array();
        $escapedValues = array();
        if ($this->validateInsert === null) {
                $this->validateInsert
                            = $this->DBRimplementation->getMethod('validateInsert');
        }


        foreach ($refinedValues as $field => $value) {
            if (key_exists($field, $this->all)) {
                $descriptor = $this->all[$field];

            } else {
                throw new DBerror("Missing descriptor: $field");
            }


            // catch all FieldValidationErrors thrown by the validation methods
            // put them into an InsertError to be thrown after iteration over all
            // of the fields
            try {
                $value = $this->validateInsert->invoke(null, $field, $value, $refinedValues);

                $this->checkValidation($field, $value);

                /*if ($value === null) {
                    unset($refinedValues[$field]);
                    continue;

                } else {*/
                    $refinedValues[$field] = $value;
                //}

            } catch(FieldValidationError $e) {
                //echo $e;
                $refinedValues[$field] = $value;
                $errors = $errors ?? new InsertError();
                $errors->errors[$field] = $e;
            }

            if ($errors !== null) continue;


            if (key_exists($field, $primaryKey)) {
                //for DB lookup after insertion
                $primaryKey[$field] = $value;
            }

            $escapedFields[] = "`" . $dbc->escape_string($field) . "`";

            switch(gettype($value)) {
                case 'string':
                    $escapedValues[] = "'" . $dbc->escape_string($value) . "'";
                    break;

                case 'double':
                    $escapedValues[] = rtrim(implode(DBT::splitDecimal($value), '.'), '.');
                    break;

                case 'integer':
                    $escapedValues[] = $value;
                    break;

                case 'boolean':
                    $escapedValues[] = $value ? 'TRUE' : 'FALSE';
                    break;

                case 'object':
                    $escapedValues[] = $value->toSQLstring($dbc);
                    break;

                case 'NULL':
                    $escapedValues[] = 'NULL';
                    break;


                default: throw new DBerror(); //this should be impossible to reach
                    // because checkValidation will throw the error first.
                    // But I'm including it just as an extra safety net.

            }
        }

        if ($errors !== null) {
            $errors->values = $refinedValues;
            //outputVar($errors->errors);
            throw $errors;
        }

        $query = "INSERT INTO `$this->escapedName` (" . implode(', ', $escapedFields)
                . ') VALUES (' . implode(', ', $escapedValues) . ')';


        $dbc->lockToInsert($this);

        if ($this->checkFK) {
            $result = $dbc->query($query);
            if ($result) $id = $dbc->insert_id;

        } else {
            $dbc->disableForeignKeyChecks();
            $result = $dbc->query($query);
            if ($result) $id = $dbc->insert_id; //this has to be grabbed before
                        //FK checks are re-enabled, apparently!  Otherwise you just get 0
            $dbc->enableForeignKeyChecks();
        }

        $dbc->unlockTables();

        if (!$result) throw new InsertError($query . "\n \t" . $dbc->error);

        if ($auto_increment !== null
                && key_exists($auto_increment, $primaryKey)
            /* && count($primaryKey) === 1 */) {

            return $id;

        }

        $pkValid = count($primaryKey) > 0;
        foreach ($primaryKey as $value) {
            if ($value === null) $pkValid = false;
        }

        if ($pkValid) return $primaryKey;
        else return $refinedValues;


    }


    // used during DBR construction and DBR->validateAgainstDBvalues
    public function typeCastFromDB(string $field, ?string $value) {
        if (!key_exists($field, $this->all)) throw new DBerror();
        if ($value === null /*|| $value === ''*/) return null;

        $descriptor = $this->all[$field];

        switch($descriptor['phpType']) {
            case 'string': case null:
            return $value;

            case 'integer': case 'double': case 'boolean':
            $cast = $value;
            settype($cast, $descriptor['phpType']);
            return $cast;

            case 'object':
                if ($value instanceof DBV) return $value;
                else return $descriptor['reflectionClass']
                                                ->getMethod('fromDB')
                                                ->invoke(null, $value);


            default:
                throw new DBerror('Invalid phpType: ' . $descriptor['phpType']);
        }
    }

    // used during DBT->insert and anytime DBR->set is called
    public function typeCastFromHTML(string $field, $value) {
        if (!key_exists($field, $this->all)) throw new DBerror();

        $descriptor = $this->all[$field];

        if ($value === null || ($value === '' && $descriptor['phpType'] !== 'boolean'))
            return null;
        //TO DO -- create a FieldDescriptor to configure how empty strings are handled

        switch ($descriptor['phpType']) {
            case 'string':
                if (gettype($value) !== 'string') {
                    throw new FieldValidationError('Invalid value type for '
                            . $descriptor['label'] . '.  Should be a string.');
                    $value .= '';
                }
                //fall through...

            case null:
                return $value;

            case 'integer': case 'double': case 'boolean':
                $cast = $value;
                if (settype($cast, $descriptor['phpType'])) {
                    if(($cast . '') === ($value . ''))  return $cast;
                    if($descriptor['phpType'] === 'boolean' && !$cast) return $cast;
                }

                //CAST FAILURE
                //outputVar($value, 'value');
                //outputVar($cast, 'cast');
                throw new FieldValidationError( 'Invalid value type for field '
                        . $descriptor['label'] . '.  Must be type: '
                        . $descriptor['phpType']);


            case 'object':
                if (gettype($value) === 'object') {
                    if ($value instanceof DBV) return $value;
                    else throw new DBtypeMismatch();

                } else return $descriptor['reflectionClass']
                                                ->getMethod('fromHTML')
                                                ->invoke(null, $value);
            default:
                throw new DBerror('Invalid phpType: ' . $descriptor['phpType']);
        }
    }


    protected final function checkValidation($field, $value) {
        if (!key_exists($field, $this->all)) throw new DBerror();
        $descriptor = $this->all[$field];

        if ($value === null) {
            if (!$descriptor['null'] || $descriptor['Null'] === 'NO') {
                throw new FieldValidationError($descriptor['label'] . ' cannot be empty.');

            } else if ($descriptor['null'] && $descriptor['Null'] === 'YES') {
                return $value;

            } else throw new DBerror('Invalid value for descriptor\'s Null property');

        }

        $type = gettype($value);


        if ($descriptor['phpType'] === null) {
            if ($type !== 'string' && $type !== 'object') {
                outputVar($descriptor);
                throw new DBtypeMismatch("Invalid data type $type for field $field");
            }

        } else if ($descriptor['phpType'] !== $type
                && !($type === 'integer' && $descriptor['phpType'] === 'double')) {
                        //integers fit into doubles

            throw new DBtypeMismatch($type . ' should be ' . $descriptor['phpType']
                    . ' in field ' . $descriptor['label']);
        }

        switch($type) {
            case 'object':
                if(!($value instanceof DBV)) break;

            case 'string':
                if (key_exists('maxLen', $descriptor)
                        && strlen($value) > $descriptor['maxLen']) {

                    throw new FieldValidationError($descriptor['label']
                            . ' cannot be longer than ' . $descriptor['maxLen']
                            . ' characters.');
                }
                if (key_exists('minLen', $descriptor)
                        && strlen($value) < $descriptor['minLen']) {

                    throw new FieldValidationError($descriptor['label']
                            . ' must be at least ' . $descriptor['minLen']
                            . ' characters');
                }

                return $value;

            case 'double': case 'integer':
                if (!key_exists('minVal', $descriptor)) throw new DBtypeMismatch();
                if ($value < $descriptor['minVal'] || $value > $descriptor['maxVal']) {
                    throw new FieldValidationError($descriptor['label']
                            . ' must be between ' . $descriptor['minVal']
                            . ' and ' . $descriptor['maxVal']);
                }

                if (!key_exists('leftDigits', $descriptor)) return $value;


                $split = DBT::splitDecimal($value);

                if (strlen(ltrim($split[0], '-')) > $descriptor['leftDigits']
                        || strlen($split[1]) > $descriptor['rightDigits'])
                    throw new FieldValidationError($descriptor['label']
                            . ' cannot have more than ' . $descriptor['leftDigits']
                            . ' to the left of the decimal point, or more than '
                            . $descriptor['rightDigits'] . ' to the right');


                return $value;

            case 'boolean':
                return $value; // ? 'TRUE' : 'FALSE';

            default:
                throw new DBerror('Type not recognized for final check');

        }
        throw new DBtypeMismatch('Invalid value type: ' . gettype($value));
    }

    public static function splitDecimal(float $value)  {


        $value = $value . ''; //type cast to string;

        if ($value[0] === '-') $negative = true;
        else $negative = false;

        $value = ltrim($value, '+-');

        if (str_contains($value, 'e') ||  str_contains($value, 'E')) {
            //scientific notation, convert to a decimal string
            $value = strtoupper($value);
            $split = explode('E', $value);

            $E = intval($split[1]);

            if (count($split) !== 2 || $split[1] !== $E . '')
                throw new DBerror();

            $split = explode('.', $split[0]);
            if (count($split) === 1) $split[1] = '';
            else if (count($split !== 2)) throw new DBerror();

            if ($E < 0) {
                $digitsToKeepLeft = strlen($split[0]) + $E;

                if ($$digitsToKeepLeft <= 0) {
                    $split[1] = str_repeat('0', -$digitsToKeepLeft) . $split[0] . $split[1];
                    $split[0] = '0';

                } else {
                    $split[1] = substr($split[0], $digitsToKeepLeft) . $split[0];
                    $split[0] = substr($split[0], 0, $digitsToKeepLeft);
                }
            } else if ($E > 0) {
                $digitsToKeepRight = strlen($split[1]) - $E;

                if ($$digitsToKeepRight <= 0) {
                    $split[0] = $split[0] . $split[1] . str_repeat('0', -$digitsToKeepRight);
                    unset($split[1]);

                } else {
                    $split[0] = $split[0] . substr($split[0], 0, -$digitsToKeepRight);
                    $split[1] = substr($split[0], -$digitsToKeepRight);
                }
            }

            if (floatval(implode($split, '.')) !== floatval($value))
                throw new DBerror('scientific notation converter not working correctly');

        } else {
            //normal scenario... split along the the decimal point
            $split = explode('.', $value);
            if (count($split) === 1) $split[1] = '';
            else if (count($split) !== 2) throw new DBerror();
        }

        if ($negative) $split[0] = '-' . $split[0];

        return $split;
    }

}

?>