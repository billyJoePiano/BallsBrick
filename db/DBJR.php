<?php
require_once('obscure.php');
obscure(__FILE__);

require_once('DButil.php');
require_once('DBJ.php');
//require_once('DBRtraits.php'); inherits from DBJ > DBT > DBR > DBRtraits

//Database Record or Database Row.  Represents one row of data from a single table
abstract class DBJR extends DBJ implements IteratorAggregate {
    use AbstractDatabaseRecord;

    //override AbstractDatabaseRecord method so return can be explicitly DBJ
    public function getTable(?DBC &$dbc = null) : DBJ {
        return static::fetchTable();
    }

    public static function fetchTable(?DBC &$dbc = null) : DBJ {
        // can't declare this as abstract because it is static!  :-(
        throw new DBerror('fetchTable must be implemented by subclass');
    }

    private array $values = array();
    private ?array $firstLevelRootValues = null;

    /*
     * Fetches the record with the given primary key, or if you are submitting a
     * query result to $primaryKey then change the already queried flag to true.
     * In the latter case, this WILL THROW AN ERROR if any fields are missing.
     *
     * Subclasses which override this should still call parent::__construct for
     * optimal performance and to prevent runtime errors with methods like get
     * and set which can only use the private arrays constructed here
     */
    protected function __construct($values, ?DBC &$dbc = null,
                                   bool $alreadyQueried = false) {

        /*
         * IMPORTANT: already queried flag is NOT the same as already constructed
         * Rather it indicates the values have been fetched from DB as associative array
         * but the instance(s) need construction based on those values.
         *
         * For already constructed 'sub'-instances, the alreadyQueriedFlag can be false
         * (but doesn't need to be... depends on whether non-instance arrays are
         * for construction or querying)
         */

        $table = $this->getTable($dbc);
        $firstLevelTables = $table->getFirstLevelTables();

        foreach ($values as $name => $value) {
            if ($value instanceof DBR || $value instanceof DBJR) {
                if (gettype($name) === 'integer'
                        && key_exists($name, $firstLevelTables)
                        && $firstLevelTables[$name]
                                ->getDBRimplementationReflection()
                                ->isInstance($value)) {

                    if(key_exists($name, $this->values))
                        throw new DBerror('Repeated instance value for the same table/value index');

                    $this->values[$name] = $value;
                    continue;

                }

                if (!isset($references)) $references = $table->getReferences();

                if (gettype($name) === 'string'
                        && key_exists($name, $references)) {

                    if ($references[$name]['nested']) {
                        //TODO construct from nested instances
                        throw new DBerror('Not able to handle nested instances at this point ... TODO!');
                        continue;

                    } else if ($references[$name]['table']
                            ->getDBRimplementationReflection()
                            ->isInstance($value)) {

                        if ($references[$name]['insideDBJ']) {
                            // TODO construct from sub-instance, root-table/root-value of a DBJ/DBJR
                            throw new DBerror('Not yet able to handle sub-instances instide DBJRs ... TODO!');
                            continue;

                        } else {
                            if(key_exists($references[$name]['index'], $this->values))
                                throw new DBerror('Repeated instance value for the same table/value index');

                            $this->values[$references[$name]['index']] = $value;
                            continue;
                        }

                    } else throw new DBerror();
                        //TO DO search out the table which the instance returns from getTable($dbc)

                }

                //TO DO search out the table which the instance returns from getTable($dbc)
                throw new DBerror();
            }
        }



        foreach ($firstLevelTables as $index => $tbl) {
            if (gettype($tbl) === 'array') {
                $this->values[$index] = array();

            } else if ($table instanceof DBT
                    && (($class = get_class($table)) === 'DBT'
                         || $class === 'DBJ')) {
                if (!key_exists($index, $this->values))
                    $this->values[$index] = null;

            } else throw new DBerror();
        }

        if ($alreadyQueried) {
            $this->constructFromAlreadyQueried($table, $values, $dbc);

        } else {
            $this->constructFromNewQuery($table, $values, $dbc);
        }


    }

    private function constructFromNewQuery(DBJ $table, $lookup, ?DBC &$dbc = null) {
        $dbc = $dbc ?? DBC::get();

        $escapedTableName = $table->getEscapedTableName(true);
        $query = 'SELECT ' . $table->writeSelectClause($dbc)
                . " FROM $escapedTableName WHERE "
                . $table->writeWhereClause($lookup, null, false, $dbc);

        if (!($result = $dbc->query($query))) throw new QueryError($query);
        else if (!($result->num_rows >= 1)) throw new NonexistentRecord($query);
        else if ($result->num_rows > 1) {
            while ($row = $result->fetch_array(MYSQLI_ASSOC)) {
                outputVar($row);
            }
            throw new MultipleRecords($query);
        }

        $values = $result->fetch_array(MYSQLI_ASSOC);
        $valuesToConstruct = array();
        foreach ($values as $key => $value) {
            $this->parseField($table, $key, $value, $valuesToConstruct);
        }

        foreach ($this->values as $index => &$value) {
            if ($value === null) {
                //first-level table
                if (!key_exists($index, $valuesToConstruct)) throw new DBerror();


                $value = $table->getTableByIndex($index)
                        ->getDBRimplementationReflection()
                        ->getMethod('createInstanceFromValues')
                        ->invokeArgs(null, array($valuesToConstruct[$index], &$dbc));
                unset($valuesToConstruct[$index]);

            } else if (($type = gettype($value)) === 'array') {
                //second level, aka will have more than one row (many side of one-to-many relationship)
                if (count($value) !== 0)
                    throw new DBerror();

                $instanceTable = $table->getTableByIndex($index)[0];
                if (!($instanceTable instanceof DBJ || $instanceTable instanceof DBT))
                    throw new DBerror();

                $tableName = $instanceTable->getEscapedTableName(true);
                $select = $instanceTable->writeSelectClause($dbc);
                $where = $this->writeNextLevelWhereClause($this, $index, $dbc);

                $query = "SELECT $select FROM $tableName WHERE $where";
                $result = $dbc->query($query);

                if ($result === false) throw new QueryError($query);

                $createInstance = $instanceTable->getDBRimplementationReflection()
                                        ->getMethod('createInstanceFromValues');

                while ($row = $result->fetch_array(MYSQLI_ASSOC)) {
                    $this->values[$index][] = $createInstance->invoke(null, $row);
                }

            } else if ($type === 'object') {
                //validate that the passed instance matches the values returned from DB
                if(!$this->values[$index]
                        ->validateAgainstDBvalues($valuesToConstruct[$index]))
                    throw new DBerror('Mismatched values between instance passed to DBJR and DB value');

            } else throw new DBerror();
        }
    }


    private function constructFromAlreadyQueried($table, $values, $dbc) {
        $valuesToConstruct = array();
        foreach ($values as $key => $value) switch ($type = gettype($value)) {
            case 'array':   case 'object':
                // determine and validate the table first
                if ($table->includesRootTable($key)) {
                    $tableIndex = $table->getTableIndexByName($key);
                    if (gettype($tableIndex) === 'array') {
                        //nested tables have an array of indexes
                        if (count($tableIndex) !== 1)
                            throw new DBerror("Ambigious table key identifier: $key . This table exists more than once in the DBJ.  Use the table index instead, to specify which DBJ/join it belongs under.");

                        foreach($tableIndex as $idx) {
                            $tableIndex = $idx;
                            break;
                        }
                    }

                } else {
                    $tableIndex = intval($key);
                    if ($tableIndex . '' !== $key . '') throw new DBerror("Invalid table key identifier: $key");
                }

                // construct instance(s) for the value
                if ($type === 'object') {
                    if (!(($value instanceof DBR) || ($value instanceof DBJR)))
                        throw new DBerror();

                    $instanceTable = $table->getTableByIndex($tableIndex);

                    if (gettype($instanceTable) === 'array'
                            || $instanceTable !== $value->getTable($dbc))
                        throw new DBerror();


                    if (!$instanceTable->getDBRimplementationReflection()
                            ->isInstance($value))
                        throw new DBerror();

                    //everything checks out... assign it to the value
                    $this->values[$tableIndex] = $value;



                } else if ($type === 'array') {
                    $instanceTable = $table->getTableByIndex($tableIndex);
                    $reflection = $instanceTable->getDBRimplementationReflection();

                    switch (gettype($instanceTable)) {
                        case 'array': //nested table, therefore an array of DBRs or DBJRs
                            $instanceTable = $instanceTable[0];

                            foreach ($value as $subValue) {
                                if (gettype($subValue) === 'array') {
                                    $this->values[$tableIndex][] =
                                            $instanceTable
                                                    ->getDBRimplementationReflection()
                                                    ->getMethod('createInstanceFromValues')
                                                    ->invoke(null, $subValue, $dbc);
                                } else if (($subValue instanceof DBR) || ($subValue instanceof DBJR)) {
                                    if ($instanceTable !== $subValue->getTable($dbc))
                                        throw new DBerror();

                                    if (!$reflection->isInstance($value))  throw new DBerror();

                                    $this->values[$tableIndex][] = $subValue;

                                } else throw new DBerror('Invalid sub-value');
                            }
                            break;

                        case 'object': //first-level table, therefore a single DBR/DBJR
                            $this->values[$tableIndex] =
                                    $instanceTable
                                            ->getDBRimplementationReflection()
                                            ->getMethod('createInstanceFromValues')
                                            ->invoke(null, $value, $dbc);
                    }
                }

                break;

            default: //scalar value means the same as queried result...
                //$values is a flattened array with table#.fieldname as keys
                $this->parseField($table, $key, $value, $valuesToConstruct);
        }
        foreach ($valuesToConstruct as $index => $value) {
            $this->values[$index] = $table->getTableByIndex($index)
                                        ->getDBRimplementationReflection()
                                        ->getMethod('createInstanceFromValues')
                                        ->invokeArgs(null, array ($value, &$dbc));
        }
    }

    private static function parseField($table, $key, $value, &$valuesToConstruct) {
        $explosion = explode('.', $key, 2);
        if (count($explosion) !== 2)
            throw new DBerror();

        $tableIndex = $explosion[0];
        $fieldName = $explosion[1];

        if ($tableIndex . '' !== ($tableIndex = intval($tableIndex)) . '')
            throw new DBerror("Invalid field prefix for $key");

        if (key_exists($tableIndex, $valuesToConstruct)) {
            if (key_exists($fieldName, $valuesToConstruct[$tableIndex]))
                throw new DBerror('repeated value for table record object');

            $valuesToConstruct[$tableIndex][$fieldName] = $value;

        } else {
            //validates that this index exists... we don't do anything with the returned table
            $table->getTableByIndex($tableIndex);
            $valuesToConstruct[$tableIndex] = array(
                    $fieldName => $value
            );
        }
    }


    public function writeNextLevelWhereClause(DBJR $IGNORED, int $tableIndex, ?DBC $dbc) {
        return $this->getTable($dbc)->writeNextLevelWhereClause($this, $tableIndex, $dbc);
    }


    /*
     * Use the table index to return first-level value or a second-level array of values
     * regardless of DBJR or DBR.
     *
     * Use the table name to access a root-level value (aka DBR not DBJR) for
     * first-level values, or an array for second-level values (array values may or
     * may not be root-level, aka either DBR or DBJR)
     *
     * NOTE: WILL THROW AN ERROR IF TABLE NAME IS AMBIGIOUS BETWEEN MULTIPLE SECOND
     * LEVEL TABLES
     *
     */
    public function get($tableNameOrIndex) {
        $type = gettype($tableNameOrIndex);
        if ($type === 'integer') {
            if (key_exists($tableNameOrIndex, $this->values))
                return $this->values[$tableNameOrIndex];
            else throw new DBerror();

        } else if ($type === 'string') {
            $index = $this->getTable()->getTableIndexByName($tableNameOrIndex);

            if (($type = gettype($index)) === 'array') {
                //second level, return the array
                if (count($index) !== 1) throw new DBerror('Ambiguous table name');
                if (gettype($this->values[$index[0]]) !== 'array') throw new DBerror();
                return $this->values[$index[0]];

            } else if ($type !== 'integer') throw new DBerror();

            $value = $this->values[$index];
            if ($value instanceof DBJR) {
                return $value->get($tableNameOrIndex);

            } else if ($value instanceof DBR) {
                return $value;

            } else throw new DBerror();
        }
    }

    public function validateAgainstDBvalues(array $dbVals) : bool {
        foreach ($dbVals as $tableIndex => $value) {
            if (!(key_exists($tableIndex, $this->values)
                    && $this->values[$tableIndex]
                            ->validateAgainstDBvalues($value)))
                return false;
        }
        return true;
    }

    public final function getFirstLevelRootValues() : array {
        $result = array();
        foreach($this->values as $value) {
            if ($value instanceof DBR) {
                $result[$value-$this->getTableName()] = $value;

            } else if ($value instanceof DBJR) {
                $result = array_merge($result, $value->getFirstLevelRootValues());

            } else throw new DBerror();
        }
    }


    // 2-D array of booleans -- use fromName as first dimension, toName as 2nd
    // if keys are not provided, true is assumed default
    protected static array $referencesToUse = array();

    //alternatively... just override this function for more sophisticated behavior
    // ... Note: still needs refinement on the DBJ construction side
    public static function useReference(FKreference $reference,
                                        string $fromName,
                                        string $toName,
                                        array $fromDesc,
                                        array $toDesc)      : bool {

        if (key_exists($fromName, static::$referencesToUse)
                && key_exists($toName, static::$referencesToUse[$fromName]))
            return static::$referencesToUse[$fromName][$toName];

        else return true;
    }

    public final function writeSelectClause(?DBC &$dbc = null): string {
        return $this->getTable($dbc)->writeSelectClause($dbc);
    }

    public final function writeWhereClause($lookup,
                                           ?string $tableName = null,
                                           bool $requireFullPrimaryKey = true,
                                           ?DBC &$dbc = null        ) : string {
        return $this->getTable($dbc)->writeWhereClause($lookup, $tableName, $requireFullPrimaryKey, $dbc);
    }

    public final function getFirstLevelTables(): array {
        return $this->getTable()->getFirstLevelTables();
    }

    public final function getRootTables() : array {
        return $this->getTable()->getRootTables();
    }

    public final function getReferences(): array {
        return $this->getTable()->getReferences();
    }

    public final function includesRootTableAtFirstLevel(string $tableName): bool {
        return $this->getTable()->includesRootTableAtFirstLevel($tableName);
    }

    public final function includesRootTable($tableName): bool {
        return $this->getTable()->includesRootTable($tableName);
    }

    public final function includesRootDBTatFirstLevel(DBT $table): bool {
        return $this->getTable()->includesRootDBTatFirstLevel($table);
    }

    public final function includesDBTatFirstLevel(DBT $table): bool {
        return $this->getTable()->includesDBTatFirstLevel($table);
    }

    public final function includesRootDBT(DBT $table): bool {
        return $this->getTable()->includesRootDBT($table);
    }

    public final function includesDBT(DBT $table): bool {
        return $this->getTable()->includesDBT($table);
    }

    public final function getTableIndex(DBT $table): int {
        return $this->getTable()->getTableIndex($table);
    }

    public final function getTableIndexByName(string $rootTableName) {
        return $this->getTable()->getTableIndexByName($rootTableName);
    }

    public final function getTableByIndex(int $index) {
        return $this->getTable()->getTableByIndex($index);
    }

    public final function getRootTableByName(string $name): DBT {
        return $this->getTable()->getRootTableByName($name);
    }
}