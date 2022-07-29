<?php
require_once('obscure.php');
obscure(__FILE__);

require_once('DBT.php');

//foreign key reference.  Represents a FK constraint relationship between two tables
class FKreference {
    private static array $tables = array(); //TO DO: add code to index FKreferences by table... not a priority right now 4-6-2021
    private static array $constraints = array(); // currently this is where all are cached

    /*public static function get(DBT $toTable, array $toFields,
                               DBT $fromTable, array $fromFields,
                               string $constraintName) : ?FKreference {

        $reference = null;

        $to = $toTable->getTableName();
        $from = $fromTable->getTableName();

        if (!key_exists($to, FKreference::$tables)) {
            FKreference::$tables[$to] = array(
                    'name' => $to,
                    'to' => array(),
                    'from' => array()
            );

        } else {
            foreach (FKreference::$tables[$to]['to'] as $ref) {
                if ($ref->getOriginTable() === $fromTable
                        && $ref->getConstraintName() == $constraintName) {
                    $reference = $ref;
                    break;
                }
            }
        }

        if (!key_exists($from, FKreference::$tables)) {
            if ($reference !== null) throw new DBerror(); // inconsistency between from and to table references
            FKreference::$tables[$from] = array(
                    'name' => $from,
                    'to' => array(),
                    'from' => array()
            );
        } else {
            foreach (FKreference::$tables[$from]['from'] as $ref) {
                if ($ref->getReferencedTable() === $toTable
                        && $ref->getConstraintName() === $constraintName) {
                    if ($ref !== $reference) throw new DBerror(); // inconsistency between from and to table references
                    return $reference;
                }
            }
            if ($reference !== null) throw new DBerror(); // inconsistency between from and to table references
        }

        if($reference) return $reference;

        $reference = new FKreference($toTable, $toFields, $fromTable, $fromFields, $constraintName);

        FKreference::$tables[$to]['to'][] = $reference;
        FKreference::$tables[$from]['from'][] = $reference;

        return $reference;
    }*/

    public static function getArray(array $tables, ?DBC &$dbc = null) : ?array {
        $dbc = $dbc ?? DBC::get();

        $db = "'" . $dbc->escape_string(DBC::DATABASE) . "'";

        $query = array();
        $tablesByName = array();

        foreach ($tables as $table) {
            if (!($table instanceof DBT && get_class($table) === 'DBT'))
                throw new DBerror();

            $tablesByName[$table->getTableName()] = $table;
            $escapedName = $table->getEscapedTableName(false);
            $query[] = "TABLE_NAME = '$escapedName' OR REFERENCED_TABLE_NAME = '$escapedName'";
        }

        $query = 'SELECT * FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE WHERE '
                . "TABLE_SCHEMA = $db AND REFERENCED_TABLE_SCHEMA = $db AND ("
                . implode(' OR ', $query) . ') ORDER BY CONSTRAINT_NAME';

        $result = $dbc->query($query);

        if (!$result) throw new DBerror($query);
        if ($result->num_rows === 0) return null;

        $references = array();

        $row = $result->fetch_array(MYSQLI_ASSOC);
        while ($row) {
            $from = $row['TABLE_NAME'];
            $to = $row['REFERENCED_TABLE_NAME'];
            if (!(key_exists($from, $tablesByName) && key_exists($to, $tablesByName))) {
                $row = $result->fetch_array(MYSQLI_ASSOC);
                continue;
            }

            $constraintName = $row['CONSTRAINT_NAME'];
            if (key_exists($constraintName, FKreference::$constraints)) {
                $references[] = FKreference::$constraints[$constraintName];
                do {
                    $row = $result->fetch_array(MYSQLI_ASSOC);
                } while ($row['CONSTRAINT_NAME'] === $constraintName);

                continue;
            }


            $fromFields = array();
            $toFields = array();
            while ($row && $row['CONSTRAINT_NAME'] === $constraintName) {

                if (!($row['TABLE_NAME'] === $from
                        && $row['REFERENCED_TABLE_NAME'] === $to)) {
                    throw new DBerror();
                }

                $fromField = $row['COLUMN_NAME'];
                $toField = $row['REFERENCED_COLUMN_NAME'];

                if (key_exists($toField, $toFields) || key_exists($fromField, $fromFields)) {
                    throw new DBerror();
                }

                $toFields[$toField] = $fromField;
                $fromFields[$fromField] = $toField;

                $row = $result->fetch_array(MYSQLI_ASSOC);
            }

            $reference = new static(    $tablesByName[$to], $toFields,
                                        $tablesByName[$from], $fromFields,
                                        $constraintName                     );

            FKreference::$constraints[$constraintName] = $reference;
            $references[] = $reference;

            //TO DO: add code to index FKreferences by table in static::$tables... not a priority right now 4-6-2021
        }

        return count($references) > 0 ? $references : null;
    }




    private DBT $toTable;
    private array $toFields;
    private DBT $fromTable;
    private array $fromFields;
    private string $constraintName;
    private bool $containsSomePrimaryKey = false; // contains at least one field in primary key of 'to' table
    private bool $containsEntirePrimaryKey = false; // contains entire primary key of 'to' table
    private bool $isPK = false; //contains exclusively the entire primary key of 'to' table
    private bool $nullable = false; //if any one of the FK fields is nullable while the referenced field is not, this flips to true

    private function __construct (DBT $toTable, array $toFields,
                                  DBT $fromTable, array $fromFields,
                                  string $constraintName) {

        $fromDescriptors = $fromTable->getAllDescriptors();
        $toDescriptors = $toTable->getAllDescriptors();
        $pkTracker = array();


        foreach ($fromFields as $fromField => $toField) {
            if(!(      gettype($toField) === 'string'
                    && gettype($fromField) === 'string'
                    && key_exists($toField, $toFields)
                    && $toFields[$toField] === $fromField
                    && key_exists($fromField, $fromDescriptors)
                    && key_exists($toField, $toDescriptors)
                    && $fromDescriptors[$fromField]['Type']
                    === $toDescriptors[$toField]['Type'])) {
                throw new DBerror();
            }
            if ($toDescriptors[$toField]['primaryKey']) {
                $this->containsSomePrimaryKey = true;
                $pkTracker[$toField] = $fromField;
            }
            if ($fromDescriptors[$fromField]['Null'] === 'Yes'
                    && $toDescriptors[$toField]['Null'] === 'No') {
                $this->nullable = true;
            }
        }

        //safety check, in case there are extra fields in $toFields
        foreach ($toFields as $toField => $fromField) {
            if (!(     gettype($toField) === 'string'
                    && gettype($fromField) === 'string'
                    && key_exists($fromField, $fromFields)
                    && $fromFields[$fromField] === $toField)) {
                throw new DBerror();
            }
        }

        // check for primary key of 'to' table
        if ($this->containsSomePrimaryKey) {
            $toPK = $toTable->getPrimaryKeyDescriptors();

            $pkCount = count($toPK);
            $trackerCount = count($pkTracker);

            if($pkCount <= $trackerCount) {
                $this->containsEntirePrimaryKey = true;
                foreach ($toPK as $field => $descriptor) {
                    if (!key_exists($field, $pkTracker)) {
                        $this->containsEntirePrimaryKey = false;
                        break;
                    }
                }

                $this->isPK = $this->containsEntirePrimaryKey
                        && $pkCount === $trackerCount;
            }
        }

        $this->toTable = $toTable;
        $this->toFields = $toFields;
        $this->fromTable = $fromTable;
        $this->fromFields = $fromFields;
        $this->constraintName = $constraintName;
    }

    public function getOriginTable() : DBT {
        return $this->fromTable;
    }

    public function getOriginFields() : array {
        return $this->fromFields;
    }

    public function getReferencedTable() : DBT {
        return $this->toTable;
    }

    public function getReferencedFields() : array {
        return $this->toFields;
    }

    public function getConstraintName() : string {
        return $this->constraintName;
    }

    public function isNullable() : bool {
        return $this->nullable;
    }

    // foreign reference is exclusively the entire primary key of the referenced table, and nothing else
    public function isPrimaryKey() : bool {
        return $this->isPrimaryKey;
    }

    // foreign reference contains the entire primary key of the referenced table
    public function doesContainPrimaryKey() : bool {
        return $this->containsEntirePrimaryKey;
    }

    // foreign references contain *at least* part of the primary key of the referenced table
    // (if true, it may contain the entire primary key as well, see above)
    public function doesContainSomePrimaryKey() : bool {
        return $this->containsSomePrimaryKey;
    }

    public function writeWhereClause(DBR $referencing, ?DBC &$dbc = null) {
        if ($referencing->getTable($dbc) === $this->toTable
                && $this->toTable
                    ->getDBRimplementationReflection()
                    ->isInstance($referencing)) {

            $values = array();
            foreach ($this->fromFields as $from => $to) {
                $values[$from] = $referencing->get($to);
            }
            return $this->fromTable->writeWhereClause($values,
                                                $this->fromTable->getTableName(),
                                                false, $dbc);

        } else if ($referencing->getTable($dbc) === $this->fromTable
                && $this->fromTable
                        ->getDBRimplementationReflection()
                        ->isInstance($referencing)) {

            $values = array();
            foreach ($this->toFields as $to => $from) {
                $values[$to] = $referencing->get($from);
            }
            return $this->toTable->writeWhereClause($values,
                                                $this->toTable->getTableName(),
                                                $this->containsEntirePrimaryKey,
                                                $dbc);

        } else throw new DBerror('Invalid DBR $referencing argument.  Record\'s table not part of this FKreference');
    }

    public function __toString() : string {
        // since keys are the local identifier and values the foreign identifier,
        // the toFields and fromFields seem to be switched here
        return 'FOREIGN KEY ' . $this->fromTable->getTableName() . '('
                . implode(', ', $this->toFields) . ') REFERENCES '
                . $this->toTable->getTableName() . '('
                . implode(', ', $this->fromFields) . ')';
    }
}

?>
