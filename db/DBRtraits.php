<?php

//  used by DBR, DBJR, and possibly other future implementations
// (e.g. group-by implementations with aggregation functions?)
trait AbstractDatabaseRecord {

    // returns an array of raw return values from a customizable query
    public static function queryForData(string $latterQueryClauses, ?DBC &$dbc = null) : array {
        $result = static::performQuery($latterQueryClauses, $dbc);
        $return = array();

        while ($row = $result->fetch_array(MYSQLI_ASSOC)) {
            $return[] = $row;
        }
        return $return;
    }

    public static function queryForInstances(string $latterQueryClauses, ?DBC &$dbc = null) : array {
        $result = static::performQuery($latterQueryClauses, $dbc);
        $return = array();

        while ($row = $result->fetch_array(MYSQLI_ASSOC)) {
            $return[] = static::createInstanceFromValues($row);
        }
        return $return;
    }

    public static function performQuery(string $latterQueryClauses, ?DBC &$dbc = null) : mysqli_result {
        $dbc = $dbc ?? DBC::get();

        $table = static::fetchTable($dbc);
        $query = 'SELECT ' . $table->writeSelectClause($dbc)
                . ' FROM ' . $table->getEscapedTableName(true) . ' '
                . $latterQueryClauses;

        $result = $dbc->query($query);
        if ($result === false) throw new QueryError($query);
        return $result;
    }


    // Next 2 functions should be overridden by subclasses as necessary, based on their own
    // constructors' parameters... this is a generalizable interface for creating
    // already-queried records (e.g. in a join through DBJR) out of specific
    // implementations in the first case, or fetching based on a lookup key in the second.
    // DBT only used to include both DBR and DBJR

    public static function createInstanceFromValues(array $values, ?DBC &$dbc = null) : DBT {
        return new static($values, $dbc, true);
    }

    public static function fetchInstanceFromLookupKey($lookup, ?DBC &$dbc = null) : DBT {
        return new static($lookup, $dbc, false);
    }

    public final function writeSelectClause(?DBC &$dbc = null) : string {
        return $this->getTable($dbc)->writeSelectClause($dbc);
    }

    public final function writeWhereClause($key, ?string $tableAlias = null,
                                           bool $requireFullPrimaryKey = true,
                                           ?DBC &$dbc = null)       : string {
        return $this->getTable($dbc)->writeWhereClause($key, $tableAlias, $requireFullPrimaryKey, $dbc);
    }

    //may return a DBJ in DBJR implementations. This can also be overriden
    public function getTable(?DBC &$dbc = null) : DBT {
        return static::fetchTable($dbc);
    }


    public final function getTableName() : string {
        return $this->getTable()->getTableName();
    }

    public final function getEscapedTableName(bool $addTickMarks = false) : string {
        return $this->getTable()->getEscapedTableName();
    }

    public final function getAllDescriptors() : array {
        return $this->getTable()->getAllDescriptors();
    }

    public final function getTableDescriptors() : array {
        return $this->getTable()->getTableDescriptors();
    }

    public final function getPrimaryKeyDescriptors() : array {
        return $this->getTable()->getPrimaryKeyDescriptors();
    }

    public final function getFieldDescriptors() : array {
        return $this->getTable()->getFieldDescriptors();
    }

    public final function getDBRimplementationReflection() : ReflectionClass {
        return $this->getTable()->getDBRimplementationReflection();
    }

    public final function extractPrimaryKeyFromHTTP(?array $values = null) : array {
        return $this->getTable()->extractPrimaryKeyFromHTTP($values);
    }

    public final function typeCastFromDB(string $field, ?string $value) {
        return $this->getTable()->typeCastFromDB($field, $value);
    }

    public final function typeCastFromHTML(string $field, $value) {
        return $this->getTable()->typeCastFromHTML($field, $value);
    }

    //In DBR, get iterator is for field values only, NOT primary key values
    public function getIterator() : Traversable {
        return (function() {
            foreach($this->values as $key => $value) {
                yield $key => $value;
            }
        })();
    }
}

?>