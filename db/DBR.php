<?php
require_once('obscure.php');
obscure(__FILE__);

require_once('DButil.php');
require_once('DBT.php');
require_once('DBRtraits.php');

//Database Record or Database Row.  Represents one row of data from a single table
abstract class DBR extends DBT implements IteratorAggregate {
    use AbstractDatabaseRecord;

    const SELECT_FIELDS = array('*');

    public static function fetchTable(?DBC &$dbc = null) : DBT {
        return static::$table ??
                (static::$table = static::getDBT(static::TABLE, $dbc));
    }


    private ?array $allValues = array();
    private ?array $primaryKey = array();
    private ?array $values = array();
    private ?array $originalValues = null;

    // keeps the original values for changed fields only
    // also serves as a flag for modification,
    // when the array is initialized

    /*
     * Fetches the record with the given primary key, or if you are submitting a
     * query result to $primaryKey then change the already queried flag to true.
     * In the latter case, this WILL THROW AN ERROR if any fields are missing.
     *
     * Subclasses which override this should still call parent::__construct for
     * optimal performance and to prevent runtime errors with methods like get
     * and set which can only use the private arrays constructed here
     */
    protected function __construct($primaryKey, ?DBC &$dbc = null,
            bool $alreadyQueried = false) {

        $table = $this->getTable($dbc);
        $descriptors = $table->getAllDescriptors();

        $tableNameEscaped = $table->getEscapedTableName(true);

        if ($alreadyQueried) {
            //Used in cases of join statements, etc
            $copyFrom = $primaryKey;

        } else {
            $dbc = $dbc ?? DBC::get();
            $select = $table->writeSelectClause($dbc);
            $query = "SELECT $select FROM $tableNameEscaped WHERE "
                . $table->writeWhereClause($primaryKey, null, false, $dbc);

            if (!($result = $dbc->query($query))) throw new QueryError($query);
            else if (!($result->num_rows >= 1)) throw new NonexistentRecord($query);
            else if ($result->num_rows > 1) throw new MultipleRecords($query);

            $copyFrom = $result->fetch_array(MYSQLI_ASSOC);
        }


        //COPY AND TYPECAST

        foreach($descriptors as $field => $descriptor) {
            if(!key_exists($field, $copyFrom)) {
                throw new DBerror('Mismatch in query field return! ' . $field . ' missing' );
            }
            if ($alreadyQueried && $copyFrom[$field] !== null
                    && ($type = gettype($copyFrom[$field])) !== 'string') {

                if ($descriptor['phpType'] !== null) {
                    if ($descriptor['phpType'] !== $type) throw new DBtypeMismatch($type);
                    if ($type === 'object'
                            && !$descriptor['reflectionClass']->isInstance($copyFrom[$field]))
                        throw new DBtypeMismatch();
                }

                $this->allValues[$field] = $copyFrom[$field];

            } else {
                $this->allValues[$field] = $table->typeCastFromDB($field, $copyFrom[$field]);
            }
        }


        if (count($this->allValues) !== count($descriptors)) {
            throw new DBerror('Mismatch in number of fields!');
        }


        //VALIDATE INITIAL VALUES
        foreach ($this->allValues as $field => $value) {
            $this->allValues[$field] =
                    $table->checkValidation($field,
                            static::validateConstruction($field, $value, $this->allValues)
                        );
        }

        foreach ($this->allValues as $field => $value) {
            if ($descriptors[$field]['primaryKey'])
                $this->primaryKey[$field] = $value;
            else $this->values[$field] = $value;
        }

    }

    public final function insert($values, ?DBC &$dbc = null) {
        return $this->getTable($dbc)->insert($values, $dbc);
    }

    public final function getDBRimplementationReflection() : ReflectionClass {
        return $this->getTable()->getDBRimplementationReflection();
    }

    public final function getFieldValues() {
        return $this->values;
    }

    public final function getPrimaryKeyValues() {
        return $this->primaryKey;
    }

    public function getAllValues() {
        return $this->allValues ?? ($this->allValues
                                = array_merge($this->primaryKey, $this->values));
    }

    //can be overridden, or just override SELECT_FIELDS array constant...
    // this dictates the behavior of the table's writeSelectClause method
    // and could be used for other things like joining and custom SQL
    public static function getSelectFields(?DBC &$dbc = null) : array {
        return static::SELECT_FIELDS;
    }



    /* validateInsert/Construction/Set(field, value) are intended
     * to be overriden by subclass implementations, to modify/validate the values
     * for certain fields (e.g. a password hash instead of a plaintext password).
     *
     * validateInsert is invoked when inserting a new record, validateConstruction
     * is invoked during construction of a retrieved record DBR (as well as validating
     * DB values against the current instance), and validateUpdate
     * is invoked during every call to 'set.'
     *
     * All are called AFTER the type cast but BEFORE the value is finalized.
     *
     * In construction and set, all of the other fields are accessible to the
     * subclass instance through the 'get' method but any call to 'set' with a
     * new value will cause the instance to cache the original value and believe
     * the DB record needs an update.
     *
     * In insert, because this is a static function, the other values are accessible
     * through the array passed.  Changing other values/keys in this array should
     * not affect what is inserted, since it is not passed by reference.
     *
     * In validateUpdate implementations can stop the field from being changed,
     * either by returning the value from $this->get($field), or by throwing an
     * exception.
     *
     * The construction/insertion/update can be disrupted by throwing an exception.
     * In the case of insertion, a FieldValidationError will be caught by the insert
     * method and aggregated with other FieldValidationErrors into a single InsertError
     * that will be thrown back to the htmlForm (where insert is normally invoked from)
     * to be used in notifying the user of invalid field values
     *
     * Most other exceptions will need to be caught somewhere upthread, as the 'set',
     * '__construct' and methods themselves will not catch the exceptions.
     *
     * If not overridden, these methods simply default to returning the passed value
     * which may be sufficient for many implementations.
     */


    // NOTE: Validate insert is originally implemented in DBT, since that is where
    // the insert function originates.  The most basic implementation (copied directly
    // from DBT, mainly for reference) looks like this:

    public static function validateInsert(string $field, $value, array $valuesArray) {
        return $value;
    }

    public static function validateConstruction(string $field, $value, array $valuesArray) {
        return $value;
    }

    public function validateUpdate(string $field, $value) {
        return static::validateInsert($field, $value, $this->values);
    }



    //simulates constructing a new instance to compare against this instance's values
    public function validateAgainstDBvalues(array $dbVals, bool $requireAll = false) : bool {
        $table = $this->getTable();
        foreach ($dbVals as $field => $value) {
            if (!(key_exists($field, $this->values)
                    || key_exists($field, $this->primaryKey))) {
                return false;
            }
            $dbVals[$field] = $table->typeCastFromDB($field, $value);
        }

        foreach ($dbVals as $field => $value) {
            try {
                $val = $table->checkValidation($field,
                        static::validateConstruction($field, $value, $dbVals)
                    );

            } catch (DBerror $e) {
                return false;
            }

            if (gettype($val) === 'object') {
                if ($val->toSQLstring() !== $this->get($field)->toSQLstring())
                    return false;

            } else {
                if ($val !== $this->get($field)) return false;
            }
        }

        if ($requireAll) {
            foreach ($this->primaryKey as $field => $value) {
                if(!key_exists($field, $dbVals)) return false;
            }
            foreach ($this->values as $field => $value) {
                if(!key_exists($field, $dbVals)) return false;
            }
        }

        return true;
    }




    // These are field descriptor validators, called during DBT table construction
    // to be overridden by subclass implementations.

    // to simplify things, just override this array... array[field][validationProperty] = value
    // and the default functions will handle the rest
    const FIELD_ATTRIBUTES = array();

    // whether to use the field ... must be congruent with SELECT_FIELDS
    // TO DO -- mesh this function with SELECT_FIELDS ???
    public static function validateUseField(string $field, array $descriptor) : bool {
        if (key_exists($field, static::FIELD_ATTRIBUTES)
                && key_exists('use', static::FIELD_ATTRIBUTES[$field]))
            return static::FIELD_ATTRIBUTES[$field]['use'];

        return true;
    }

    //confirms whether a field is nullable
    public static function validateNull(string $field, bool $default, array $descriptor) : bool {
        if (key_exists($field, static::FIELD_ATTRIBUTES)
                && key_exists('null', static::FIELD_ATTRIBUTES[$field]))
            return static::FIELD_ATTRIBUTES[$field]['null'];

        return $default;
    }

    // NOTE: Changing the return here will change which other validate functions are called below!!!!
    public static function validatePhpType(string $field, ?string $default, array $descriptor) : ?string {
        if (key_exists($field, static::FIELD_ATTRIBUTES)
                && key_exists('phpType', static::FIELD_ATTRIBUTES[$field]))
            return static::FIELD_ATTRIBUTES[$field]['phpType'];

        return $default;
    }


    // NOTE that max/min type descriptors are type-specific -- length for strings
    // and value for ints and floats.  left digits and right digits is for 'double'
    // types only (i.e. mySQL Numeric/Decimal)

    public static function validateMaxLen(string $field, ?int $default, array $descriptors) : int {
        // $default is from varchar(len) / char(len), or null for non-varchar/char fields
        // Unlike minLen, this MUST be provided.

        if (key_exists($field, static::FIELD_ATTRIBUTES)
                && key_exists('maxLen', static::FIELD_ATTRIBUTES[$field]))
            return static::FIELD_ATTRIBUTES[$field]['maxLen'];

        return $default;
    }

    public static function validateMinLen(string $field, array $descriptor) : ?int {
        if (key_exists($field, static::FIELD_ATTRIBUTES)
                && key_exists('minLen', static::FIELD_ATTRIBUTES[$field]))
            return static::FIELD_ATTRIBUTES[$field]['minLen'];

        return null; //null means do not check for minLen
    }

    public static function validateMinInt(string $field, int $default, array $descriptor) : int {
        if (key_exists($field, static::FIELD_ATTRIBUTES)
                && key_exists('minVal', static::FIELD_ATTRIBUTES[$field]))
            return static::FIELD_ATTRIBUTES[$field]['minVal'];

        return $default;
    }

    public static function validateMaxInt(string $field, int $default, array $descriptor) : int {
        if (key_exists($field, static::FIELD_ATTRIBUTES)
                && key_exists('maxVal', static::FIELD_ATTRIBUTES[$field]))
            return static::FIELD_ATTRIBUTES[$field]['maxVal'];

        return $default;
    }

    public static function validateMinFloat(string $field, float $default, array $descriptor) : float {
        if (key_exists($field, static::FIELD_ATTRIBUTES)
                && key_exists('minVal', static::FIELD_ATTRIBUTES[$field]))
            return static::FIELD_ATTRIBUTES[$field]['minVal'];
        return $default;
    }

    public static function validateMaxFloat(string $field, float $default, array $descriptor) : float {
        if (key_exists($field, static::FIELD_ATTRIBUTES)
                && key_exists('maxVal', static::FIELD_ATTRIBUTES[$field]))
            return static::FIELD_ATTRIBUTES[$field]['maxVal'];

        return $default;
    }

    public static function validateLeftDigits(string $field, int $default, array $descriptor) : int {
        if (key_exists($field, static::FIELD_ATTRIBUTES)
                && key_exists('leftDigits', static::FIELD_ATTRIBUTES[$field]))
            return static::FIELD_ATTRIBUTES[$field]['leftDigits'];

        return $default;
    }

    public static function validateRightDigits(string $field, int $default, array $descriptor) : int {
        if (key_exists($field, static::FIELD_ATTRIBUTES)
                && key_exists('rightDigits', static::FIELD_ATTRIBUTES[$field]))
            return static::FIELD_ATTRIBUTES[$field]['rightDigits'];

        return $default;
    }

    /* This static method is called when constructing the DBT table descriptors,
     * for all fields that have a non-primitive type (aka not int, double/float,
     * bool, or string ... for example date/time)
     *
     * Intended to be overriden by subclass DBR implementations, the returned
     * ReflectionClass will be used to construct DBV for the given field.
     * NOTE THAT THE DBT CONSTRUCTOR WILL THROW AN EXCEPTION IF THE
     * RETURNED ReflectionClass DOES NOT REFLECT A SUBCLASS OF DBV (!!!)
     *
     * If the return value is null, then the parent constructor will simply use
     * the string returned from the DB, which can subsequently be transformed
     * by the DBR instance in validateConstruction(field, value) at the end of its
     * construction
     */
    public static function getDBVclass(string $field, string $sqlType) : ?ReflectionClass {
        if (key_exists($field, static::FIELD_ATTRIBUTES)
                && key_exists('DBVclass', static::FIELD_ATTRIBUTES[$field]))
            return new ReflectionClass(static::FIELD_ATTRIBUTES[$field]['DBVclass']);

        $reflection = null;
        try {
            $reflection =  new ReflectionClass('DBV' . $sqlType);

        } catch (ReflectionException $e) {
            //echo $e;
        }
        return $reflection;
    }


    // Label is the user-facing label for this field in HTML forms and outputs.
    // If no value is provided in the static::FIELD_ATTRIBUTES array, this default
    // function reformats snake-case and camel-case names by adding spaces, and
    // capitalizes the very first letter, lowercases the first letter of camel-case
    // words (after the first word), and preserves case of all other letters
    public static function validateLabel(string $field, array $descriptor) : string {
        if (key_exists($field, static::FIELD_ATTRIBUTES)
        && key_exists('label', static::FIELD_ATTRIBUTES[$field]))
            return static::FIELD_ATTRIBUTES[$field]['label'];


        if(($len = strlen($field)) <= 0) return $field;
        $label = strtoupper($field[0]);
        $lastWasWhiteSpace = false;
        for ($i = 1; $i < $len; $i++) {
            $char = $field[$i];
            if ($char === '_') {
                $label .= ' ';
                $lastWasWhiteSpace = true;

            } else if (trim($char) === '') {
                //includes other white-space types of characters e.g. tabs, line returns, etc.
                $label .= $char;
                $lastWasWhiteSpace = true;

            } else if (ctype_upper($char) && !$lastWasWhiteSpace) {
                $label .= ' ' . strtolower($char);
                $lastWasWhiteSpace = false;

            } else {
                $label .= $char;
                $lastWasWhiteSpace = false;
            }
        }
        return $label;
    }


    //This validates the type of HTML input element to use for a given field
    // can and should be overriden by subclass implementations
    public static function validateHTMLinput(string $field, ?HTMLinput $input, array $descriptor) : ?HTMLinput {
        return $input;
    }

    public static function getInputForm(?string $title = null) : HTMLform {
        throw new DBerror('getInputForm not implemented on this interface');
    }


    public final function get(string $key) {
        if (key_exists($key, $this->primaryKey)) {
            return $this->primaryKey[$key];

        } else if(key_exists($key, $this->values)) {
            return $this->values[$key];

        } else throw new DBerror("Illegal key: '$key' for table " . $this->getTableName());
    }


    public final function set(string $field, $value) {
        $table = $this->getTable();
        $descriptors = $table->getTableDescriptors();

        if (!key_exists($field, $descriptors['fields'])) {
            if(key_exists($field, $descriptors['primaryKey'])) {
                throw new DBerror(htmlEscape('Cannot set primary key'
                        . "field `$field` for table `"
                        . $this->getTableName() . '`'));

            } else {
                throw new DBerror('Nonexistent field '
                        . "`$field` for table `" . $this->getTableName() . '`');
            }
        }


        $value = $table->checkValidation($field,
                        $this->validateUpdate($field,
                            $table->typeCastFromHTML($field, $value)));


        if (!DBR::looseCompare($this->values[$field], $value)) {
            // save the original value
            if ($this->originalValues === null) {
                $this->originalValues = array($field => $this->values[$field]);

            } else if (!key_exists($field, $this->originalValues)) {
                $this->originalValues[$field] = $this->values[$field];
            }


            // change the current value
            $this->values[$field] = $value;
            $this->allValues[$field] = $value;
        }
    }

    //USE SPARINGLY! (note: function was made for Request class in user.php)
    protected final function overridePrimaryKey(array $newPK) {
        $this->primaryKey = $newPK;
    }


    public final function update($values) {
        $oldOriginalValues = $this->originalValues;
        $this->originalValues = null;
        $errors = null;

        foreach($values as $field => $value) {
            if (!key_exists($field, $this->values)) {
                if ($errors === null) $errors = new UpdateError();
                $errors->errors[$field] = new FieldValidationError("Nonexistent field `$field`");
                continue;
            }
            try {
                $this->set($field, $value);

            } catch (FieldValidationError $f) {
                $errors = $errors ?? new UpdateError();
                $errors->errors[$field] = $f;

            } catch (Throwable $t) {
                $this->cancelUpdate();
                $this->originalValues = $oldOriginalValues;

                if($errors) echo $errors->errors;

                throw $t;
            }
        }

        if ($errors) {
            $this->cancelUpdate();
            $this->originalValues = $oldOriginalValues;
            //throw or store?
            throw $errors;
        }
    }

    public final function cancelUpdate() {
        if (!$this->originalValues) return;
        foreach ($this->originalValues as $field => $value) {
            $this->values[$field] = $value;
            $this->allValues[$field] = $value;
        }
        $this->originalValues = null;
    }

    //non-strict comparison that utilizes DBV->equalTo($otherDBV) when appropriate
    //and treats null as != 0 , '', false, etc
    private static function looseCompare($value, $original) : bool {
        if (gettype($original) === 'object' || gettype($value) === 'object') {
            if ($value !== null) return $value->equalTo($original);
            else return $original->equalTo($value);

        } else if ($original === null || $value === null) {
            return $value === $original;

        } else return $value == $original;
    }

    public final function hasUpdatePending() : bool {
        if ($this->originalValues === null) return false;

        foreach ($this->originalValues as $field => $original) {
            $value = $this->values[$field];

            // non-strict comparison intentional here!
            if (!DBR::looseCompare($value, $original)) return true;
        }
        return false;
    }

    // Updates the database record, and resets 'originalValues' to null.
    // Returns true if an update was applied, false if there was nothing to change.
    // Throw DBtypeMismatch if a value doesn't match the expected type.
    // Throws DBerror if an updated was attempted but failed.
    public function applyUpdates(?DBC &$dbc = null) : bool {
        if ($this->originalValues === null) return false; //nothing was modified

        $descriptors = $this->getTableDescriptors();

        $query = '';

        foreach ($this->originalValues as $field => $original) {
            $value = $this->values[$field];

            // non-strict comparison intentional here!
            if (DBR::looseCompare($value, $original)) continue;


            //? means a value was set back to its original after being changed ?

            if (!(key_exists($field, $descriptors['fields']))) throw new DBerror($field);


            $phpType = $descriptors['fields'][$field]['phpType'];
            $actualType = gettype($value);
            if ($actualType !== $phpType) {
                if ($value === null) {
                    if ($descriptors['fields'][$field]['Null'] === 'NO') {
                        throw new DBtypeMismatch('NULL values not allowed in field '
                                . htmlEscape($field));
                    }

                } else if ($phpType !== null) {
                    throw new DBtypeMismatch($actualType . ' should be ' . $phpType
                            . ' in field ' . htmlEscape($field));
                }
            }


            $dbc ??= DBC::get();

            if ($phpType === 'string' || $actualType === 'string') {
                $value = "'" . $dbc->escape_string($value) . "'";

            } else if ($actualType === 'object') {
                $value = $value->toSQLstring($dbc);

            } else if ($value === null) {
                $value = 'NULL';

            } else if ($value === true) {
                $value = 'TRUE';

            } else if ($value === false) {
                $value = 'FALSE';
            }

            $field = '`' . $dbc->escape_string($field) . '`';

            $query .= $field . ' = ' . $value . ', ';
        }

        if ($query === '') {
            $this->originalValues = null;
            return false;
        }


        $query = substr($query, 0, -2); // remove the final ', '

        $query = 'UPDATE `' . $this->getEscapedTableName() . "` SET $query WHERE "
                . $this->getTable($dbc)->writeWhereClause($this->primaryKey, null, true, $dbc)
                . ' LIMIT 1';

        if (!$dbc->query($query)) {
            throw new UpdateError($query . "\n \t" . $dbc->error);
        }

        $this->originalValues = null;
        return true;
    }

    public function delete(?DBC &$dbc = null) {
        $dbc = $dbc ?? DBC::get();
        $table = $this->getTable($dbc);
        $query = 'DELETE FROM ' . $table->getEscapedTableName() . ' WHERE '
                . $table->writeWhereClause($this->primaryKey, null, true, $dbc) . ' LIMIT 1';

        //SHOULD LOCK THE TABLE HERE!!
        if (!$dbc->query($query)) throw new DBerror('Delete failure');

        $this->allValues = null;
        $this->values = null;
        $this->primaryKey = null;
        $this->originalValues = null;
    }


    // updates the record with any changes that have been made
    public function __destruct() {
        $this->applyUpdates();
    }
}

?>