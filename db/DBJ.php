<?php
require_once('obscure.php');
obscure(__FILE__);

require_once('DButil.php');
require_once('DBT.php');
require_once('FKreference.php');

//Database join -- this represents the hypothetical 'table' that joins the tables
// ...NOT the record -- DBJR represents a join record


class DBJ extends DBT {
    private static array $joins = array();
    private static ?ReflectionClass $DBJRreflection = null;
    /* A reflection of the classes for type-checking ReflectionClass
     * objects returned from implementations.
     */

    protected static final function getDBJ(array $tables, ?DBC &$dbc = null) : DBJ {
        //lazy getter
        $refinedTables = array();
        foreach($tables as $table) {
            if (gettype($table) === 'string') {
                $name = $table;
                $table = static::getDBT($table);
            }
            else if ($table instanceof DBT) {
                $class = get_class($table);
                if ($class === 'DBT' || $class === 'DBJ') {
                    $name = $table->getTableName();

                }  else throw new DBerror('Invalid type for DBJ');

            } else if (gettype($table) === 'array') {
                if (($count = count($table)) === 1) {
                    foreach ($table as $dbt) {
                        if (!($dbt instanceof DBT)) throw new DBerror();
                        $class = get_class($dbt);
                        if ($class !== 'DBT' && $class !== 'DBJ') throw new DBerror();
                        $table = array($dbt);
                        break;
                    }
                } else if ($count > 1) {
                    $table = array(static::getDBJ($table, $dbc));
                }

                $name = $table[0]->getTableName();

            } else throw new DBerror('Invalid type for DBJ');

            if (key_exists($name, $refinedTables)) throw new DBerror();

            $refinedTables[] = $table;
        }

        foreach(DBJ::$joins as $dbj) {
            if ($dbj->tables == $refinedTables) return $dbj;
        }


        $DBJRimplementation = new ReflectionClass(static::class);
        $DBJRreflection = DBJ::$DBJRreflection ??
                (DBJ::$DBJRreflection = new ReflectionClass(DBJR::class));

        if (!($DBJRimplementation->isSubclassOf($DBJRreflection))) {

            echo static::class;
            throw new DBerror('Invoking DBJ:getDBJ from invalid implementation:\n'
                    . $DBJRimplementation);
        }


        return DBJ::$joins[] = new DBJ($refinedTables, $DBJRimplementation, $dbc);

    }


    private array $tables;
    private array $rootTables;

    private array $references;
    private array $nestedReferences;
    private array $dbjReferences; //??
    private array $firstLevelRootTables;
    private string $selectClause;
    private string $escapedJoinStatement;
    private bool $firstLevelJoin = true;



    private ?array $myDescriptors = null;
    private ?array $fieldDescriptors = null;
    private ?array $primaryKeyDescriptors = null;
    private ?array $allDescriptors = null;

    private ReflectionClass $DBJRimplementation;


    private function __construct(array $tables, ReflectionClass $DBJRimplementation,
            ?DBC &$dbc = null) {

        if (!(count($tables) > 0)) throw new DBerror();

        $dbc = $dbc ?? DBC::get();
        $this->tables = $tables;
        $this->DBJRimplementation = $DBJRimplementation;

        $referencesByTable = array();
        $nestedTables = array();
        $allRootTables = array();
        //$firstLevelRootTables = array();
        //$dbjReferences = array();

        foreach ($tables as $index => $table) {
            if (gettype($table) === 'array') {
                $nested = true;
                $this->firstLevelJoin = false;

                if (count($table) > 1)
                    throw new DBerror('Multi-tables nested should be handled by DBJ::getDBJ method');

                $table = $table[0];

            } else {
                $nested = false;
            }


            if ($dbj = ($table instanceof DBJ)) {
                //$dbjReferences[$index] = array();
                $rootTables = $table->getRootTables();

            } else {
                $rootTables = array($table);
            }

            if ($nested) {
                // need to wait to do this until after rootTables is determined
                $nestedTables[$index] = array(
                        'table' => $table,
                        'rootTables' => $rootTables,
                        'index' => $index,
                        'toFromFirstLevel' => array(),
                        'fromToFirstLevel' => array(),
                        'toFromOtherNested' => array(),
                        'fromToOtherNested' => array(),
                        'nullableFrom' => false,
                        'nullableTo' => false,
                        'nested' => array($index)
                    );
            }

            foreach ($rootTables as $rootTable) {
                $name = $rootTable->getTableName();

                if (key_exists($name, $referencesByTable)) {
                    if (!($nested && $referencesByTable[$name]['nested'])) {
                        throw new DBerror('Cannot have a root table on the first level that is also nested in DBJ/array');
                    }

                    $referencesByTable[$name]['index'][] = $index;
                    $referencesByTable[$name]['insideDBJ'][$index] = $dbj;

                } else {
                    $allRootTables[] = $rootTable;
                    //if (!$nested) $firstLevelRootTables[] = $rootTable;

                    $referencesByTable[$name] = array(
                            'table' => $rootTable,
                            'index' => $nested ? array($index) : $index,
                            'to' => array(),
                            'from' => array(),
                            'nullableFrom' => false,
                            'nullableTo' => false,
                            'nested' => $nested,
                            'insideDBJ' => $nested ? array($index => $dbj) : $dbj
                        );
                }
            }
        }

        $this->rootTables = $allRootTables;
        $references = FKreference::getArray($allRootTables, $dbc);
        $useReference = $DBJRimplementation->getMethod('useReference');

        foreach ($references as $reference) {
            $fromTable = $reference->getOriginTable();
            $toTable = $reference->getReferencedTable();

            $to = $toTable->getTableName();
            $from = $fromTable->getTableName();


            // TO DO -- this is sort of a bludgeoning approach... would be good to
            // refine, allow for more precision in how specific references are used
            if (!$useReference->invoke(null, $reference, $from, $to,
                    $referencesByTable[$from]['from'],
                    $referencesByTable[$to]['to']))
                continue;


            $toIsFirstLevel   = !$referencesByTable[$to]['nested'];
            $fromIsFirstLevel = !$referencesByTable[$from]['nested'];

            if ($reference->isNullable()) {
                $nullable = true;
                $referencesByTable[$from]['nullableFrom'] = true;
                $referencesByTable[$to]['nullableTo'] = true;

            } else $nullable = false;

            if ($toIsFirstLevel && $fromIsFirstLevel) {
                $referencesByTable[$to]['to'][] = $reference;
                $referencesByTable[$from]['from'][] = $reference;

            } else if ($toIsFirstLevel) {
                foreach ($nestedTables as &$nestedRef) {
                    if (in_array($fromTable, $nestedRef['rootTables'], true)) {
                        $nestedRef['fromToFirstLevel'][] = $reference;
                        if ($nullable) $nestedRef['nullableFrom'] = true;
                    }
                }

            } else if ($fromIsFirstLevel) {
                foreach ($nestedTables as &$nestedRef) {
                    if (in_array($toTable, $nestedRef['rootTables'], true)) {
                        $nestedRef['toFromFirstLevel'][] = $reference;
                        if ($nullable) $nestedRef['nullableTo'] = true;
                    }
                }

            } else {
                foreach ($nestedTables as &$nestedRef) {
                    if (in_array($fromTable, $nestedRef['rootTables'], true)) {
                        $nestedRef['fromToOtherNested'][] = $reference;
                        if ($nullable) $nestedRef['nullableFrom'] = true;
                    }

                    if (in_array($toTable, $nestedRef['rootTables'], true)) {
                        $nestedRef['toFromOtherNested'][] = $reference;
                        if ($nullable) $nestedRef['nullableTo'] = true;
                    }
                }
            }




        }


        $this->references = $referencesByTable;
        $this->nestedReferences = $nestedTables;



        foreach ($this->references as $tableName => $ref) {

        }


        $this->validateTableHierarchy($referencesByTable, $nestedTables);

        $this->escapedJoinStatement
                = static::writeJoinStatement($referencesByTable, $nestedTables, $dbc);

        $this->selectClause = $this->selectClause($dbc);

    }

    // private FOR NOW...
    // because the table hierarchy validation is not working yet, it is critical that
    // tables / FK-relationships be submitted to the constructor and to
    // writeJoinStatement (respectively) in the correct order, from many to one
    // and organized consistently by table name with 'to' and 'from' subarrays.
    // THIS IS NOT BEING VALIDATED!  Will cause undefined behavior if not properly submitted
    private static function writeJoinStatement(array $referencesByTable,
                                               array $dbjReferences,
                                               ?DBC &$dbc = null) : string {

        //NEXT UP incorporate layered DBJ joins into this

        $dbc = $dbc ?? DBC::get();

        $refsToFirstTable = null;
        $counter = 0;
        $count = count($referencesByTable);

        foreach ($referencesByTable as $tableName => $references) {
            //FOR FIRST-LEVEL ROOT TABLES
            if ($references['nested']) continue;
            $table = $references['table'];

            if ($refsToFirstTable === null) {
                $refsToFirstTable = $references['to'];
                $leftOuter = $references['nullableFrom'];
                $statement = $table->getEscapedTableName(true);
                continue;
            }

            $refsToEnumerate = $references['to'];
            $rightOuter = $references['nullableTo'];
            if (++$counter >= $count && $references['nullableFrom']) {
                //there will not be a next iteration for $leftOuter!
                $rightOuter = true;
            }

            foreach ($references['from'] as $index => $fromRef) {
                $index = array_search($fromRef, $refsToFirstTable, true);
                if ($index !== false) {
                    if (!($fromRef->getOriginTable() === $table)) throw new DBerror();

                    $refsToEnumerate[] = $fromRef;
                    if ($fromRef->isNullable()) $rightOuter = true; // ????? not sure about this, should it be $leftOuter?

                    array_splice($refsToFirstTable, $index, 1);
                }
            }

            if ($leftOuter) {
                if ($rightOuter) {
                    $statement .= ' FULL OUTER JOIN ';
                } else {
                    $statement .= ' LEFT OUTER JOIN ';
                }
            } else if ($rightOuter) {
                $statement .= ' RIGHT OUTER JOIN ';

            } else {
                $statement .= ' JOIN ';
            }

            $statement .= $table->getEscapedTableName(true) . ' ON ';

            foreach ($refsToEnumerate as $reference) {
                $fromName = $reference->getOriginTable()->getEscapedTableName(true);
                $toName = $reference->getReferencedTable()->getEscapedTableName(true);
                $fields = $reference->getReferencedFields();
                foreach ($fields as $toField => $fromField) {
                    $toField = '`' . $dbc->escape_string($toField) . '`';
                    $fromField = '`' . $dbc->escape_string($fromField) . '`';
                    $statement .= "$toName.$toField = $fromName.$fromField AND ";
                }
            }

            $statement = substr($statement, 0, -5); // trim the final ' AND '

            $leftOuter = $references['nullableFrom']; //for the next iteration
        }

        if (count($refsToFirstTable) !== 0) throw new DBerror();

        return $statement;

        /* NOTE -- original code from the constructor for writing table name
        $this->plaintextName = $this->escapedNameNoTicks = $this->escapedNameTicks
        = 'JOIN of tables ';

        <~ foreach table ~> {
            $this->plaintextName .= "$name, ";
            $this->escapedNameNoTicks .= "$escapedName, ";
            $this->escapedNameTicks .= "`$escapedName`, ";
        }

        $this->plaintextName = rtrim($this->plaintextName, ', ');
        $this->escapedNameNoTicks = rtrim($this->escapedNameNoTicks, ', ');
        $this->escapedNameTicks = rtrim($this->escapedNameTicks, ', ');
        */
    }

    private function validateTableHierarchy(array $references, array $nestedTables) {
        foreach ($nestedTables as $ref) {
            if (count($ref['toFromFirstLevel']) < 0 && count($ref['fromToFirstLevel']) < 0)
                throw new DBerror('Nested DBJ must have at least one reference to or from a first-level table');
        }

        return;

        //short-circuiting this method for now... needs work... not enough time

        /*
        $workBackwards = function (string $tableName, FKreference $reference,
                                   array $circularReferenceChecker = array(),
                                    array $tableHierarchy = array()
                                )
                    use ($references, &$workBackwards) {

            $originTable = $reference->getOriginTable()->getTableName();

            if (!($tableName === $reference->getReferencedTable()->getTableName()
                    && key_exists($tableName, $references)
                    && in_array($references[$tableName]['to'], $reference)
                    && in_array($references[$originTable]['from'], $reference))) {
                throw new DBerror();
            }

            if ($origin = $tableHierarchy === null) {
                $tableHierarchy = array();
                $circularReferenceChecker = array();

            } else if (in_array($tableName, $circularReferenceChecker, true)) {
                throw new DBerror('circular references in tables');
            }

            $tableHierarchy[] = $reference;
            $circularReferenceChecker[] = $tableName;

            $myReferences = $references[$tableName]['to'];
            $toCount = count($myReferences);

            if ($toCount === 1) {
                foreach($myReferences as $constraint => $ref) {
                    $nextTable = $ref->getReferencedTable();
                    $nextName = $nextTable->getTableName();
                    $nextRef = $references[$nextName];
                    return $workBackwards($nextName, $nextRef,
                            $circularReferenceChecker, $tableHierarchy);
                }
            } else if ($toCount > 1) {
                $multiRefs = array();
                foreach($myReferences as $constraint => $ref) {
                    $nextTable = $ref->getReferencedTable();
                    $nextName = $nextTable->getTableName();
                    $nextRef = $references[$nextName];
                    $multiRefs[] = $workBackwards($nextName, $nextRef,
                            $circularReferenceChecker); //constructs new array
                }
                $tableHierarchy[] = $multiRefs;
                return $tableHierarchy;

            } else if ($toCount === 0) {
                return $tableHierarchy;

            } else throw new DBerror();
        };



        $tableHierarchy = array();
        foreach($references as $tableName => $refs) {
            if (count($refs['to'] === 0)); //start at an end point... far many-side of all one-to-many relationships
            foreach($refs['from'] as $constraint => $ref) {
                $nextName = $ref->getReferencedTable()->getTableName();
                $tableHierarchy[] = $workBackwards($nextName, $ref);
            }
        }

        //TO DO: Check to make that there is a path to every from every other table ... NO ISLANDS!

        if (count($tableHierarchy) === 1) $tableHierarchy = $tableHierarchy[0];
        else if (count($tableHierarchy) < 1) throw new DBerror();
        */


    }

    public function writeSelectClause(?DBC &$dbc = null) : string {
        //TO DO -- need to incorporate layers of DBJs into the field names e.g. 0.1.fieldName or 1.0.3.fieldname
        //ALSO NEEDS TO BE DONE FOR WRITE WHERE CLAUSE FUNCTIONS
        return $this->selectClause;

    }

    private function selectClause(?DBC &$dbc = null, ?string $prefix = null) : string {
        $dbc = $dbc ?? DBC::get();

        if ($prefix === null) $prefix = '';
        else $prefix = "$prefix.";

        $query = array();
        foreach ($this->tables as $index => $table) {
            if (gettype($table) === 'array') continue;
            if ($table instanceof DBJ) {
                $query[] = $table->selectClause($dbc, "$prefix$index");
                continue;
            }

            $escapedTableName = $table->getEscapedTableName(false);
            $descriptors = $table->getAllDescriptors();
            foreach ($descriptors as $field => $descriptor) {
                $escapedFieldName = $dbc->escape_string($field);
                $query[] = "`$escapedTableName`.`$escapedFieldName` AS `$prefix$index.$escapedFieldName`";
            }
        }
        return implode(', ', $query);
    }

    /*
     * Hypothetically, if there were a validated table hierarchy, with one and only
     * one table on the extreme 'many' side, AND that table had a single primary key...
     * THEN a single scalar primary key here could implicitly signify the PK for
     * that table, since querying for it in a join will produce only a
     * single record across all of the tables.
     *
     * However, until I have a robust table hierarchy validation, this is not
     * possible.... too much to do and so little time with all my classes!!!
     *
     * Instead array must be 2-D:
     *      -first dimension keys = root table names (not escaped)
     *      -second dimension keys = field names
     *
     * NOTE: 'Root table' means a real table (aka DBT) not an theoretical 'join' table (aka DBJ)
     */
    public function writeWhereClause($lookup,
                                     ?string $tableName = null,
                                     bool $requireFullPrimaryKey = true,
                                     ?DBC &$dbc = null) : string {

        // Note the $tableAlias / $tableName parameter serves a slightly different purpose
        // in the DBJ implementation than the DBT implementation... here it specifies
        // a first-level table within the DBJ that the $lookup parameter is specific to.
        // $tableName is root-level normally, OR when $lookup is an instanceof DBR or DBRJ
        // $tableName specifies the table index.
        //
        // If null, then $lookup's first dimension must be the root-level table name,
        // second dimension the field-name/value pair


        if ($lookup instanceof DBR || $lookup instanceof DBJR) {
            if ($this->DBJRimplementation->isInstance($lookup)) {
                $lookup = $lookup->getFirstLevelRootValues();

            } else {
                // ^^ if it IS an instance, then fall through to iterate at bottom of method

                if (key_exists($tableName, $this->tables)) {
                    $tableIndex = $tableName;
                    if ($lookup instanceof DBR) $tableName = $lookup->getTableName();
                    else $tableName = null;

                } else if (key_exists($tableName, $this->references)
                        && $this->references[$tableName]['nested'] === false) {
                    //convert tableName to index
                    $tableIndex = $this->references[$tableName]['index'] . ''; //?? cast to string for consistency?

                } else throw new DBerror("Invalid identifier for table: $tableName");

                if (gettype($this->tables[$tableIndex]) === 'array'
                        || !($this->tables[$tableIndex] instanceof DBT)) { //may be DBT or DBJ
                    throw new DBerror("Cannot write where clause on nested tables");
                    //TO DO, figure out a way to construct a new DBJR with an instance from a nested table
                    // this would probably be done somewhere in DBJR construction
                }

                if (!$this->tables[$tableIndex]
                        ->getDBRimplementationReflection()
                        ->isInstance($lookup)) {
                    throw new DBerror('Invalid instance class for table #' . $tableName);
                }

                return $this->tables[$tableIndex]
                        ->writeWhereClause($lookup, $tableName, $requireFullPrimaryKey, $dbc);
            }

        } else if ($tableName) {
            if (!key_exists($tableName, $this->references)
                    || $this->references[$tableName]['nested']) {
                throw new DBerror();
            }

            return $this->references[$tableName]['table']
                    ->writeWhereClause($lookup, $tableName, $requireFullPrimaryKey, $dbc);;
        }

        // Iterate
        $query = array();
        foreach ($lookup as $tableName => $fieldValues) {
            $query[] = $this
                    ->writeWhereClause($fieldValues, $tableName, $requireFullPrimaryKey, $dbc);
        }
        return implode(' AND ', $query);
    }

    public function writeNextLevelWhereClause(DBJR $lookupFor, int $tableIndex, ?DBC $dbc) {
        if (!key_exists($tableIndex, $this->nestedReferences))
            throw new DBerror();

        $table = $this->tables[$tableIndex][0];

        if (!$this->DBJRimplementation->isInstance($lookupFor))
            throw new DBerror();


        $references = $this->nestedReferences[$tableIndex];
        $query = array();

        foreach ($references['fromToFirstLevel'] as $reference) {
            //TO DO, NEED TO USE INDEXES TO FETCH VALUES, NOT TABLE NAME --
            // WILL THROW ERRORS IN get WHEN AMBIGIOUS

            $toTable = $reference->getReferencedTable()->getTableName();
            $dbr = $lookupFor->get($toTable); //will always be root level
            $query[] = $reference->writeWhereClause($dbr, $dbc);
        }

        foreach ($references['toFromFirstLevel'] as $reference) {
            $fromTable = $reference->getOriginTable()->getTableName();
            $dbr = $lookupFor->get($fromTable); //will always be root level
            $query[] = $reference->writeWhereClause($dbr, $dbc);
        }

        return implode(' AND ', $query);

    }

    public function __toString() {
        return $this->getTableName();
    }

    public function getTableName() : string {
        return $this->getEscapedTableName();
    }

    // addTickMarks has no effect for DBJ
    public function getEscapedTableName(bool $addTickMarks = false) : string {
        return $this->escapedJoinStatement;
    }


    // includes all DBT and DBJ first-level tables
    public function getFirstLevelTables() : array {
        return $this->tables;
    }

    public function getRootTables() : array {
        return $this->rootTables;
    }

    public function getReferences() : array {
        return $this->references;
    }

    public function getTableDescriptors() : array {
        if ($this->myDescriptors) return $this->myDescriptors;

        $descriptors = array();
        foreach ($this->references as $name => $ref) {
            $descriptors[$name] = $ref['table']->getTableDescriptors();
        }
        return $this->myDescriptors = $descriptors;
    }

    public function getAllDescriptors() : array {
        if ($this->allDescriptors) return $this->allDescriptors;

        $descriptors = array();
        foreach ($this->references as $name => $ref) {
            $descriptors[$name] = $ref['table']->getAllDescriptors();
        }
        return $this->allDescriptors = $descriptors;
    }

    public function getFieldDescriptors() : array {
        if ($this->fieldDescriptors) return $this->fieldDescriptors;

        $descriptors = array();
        foreach ($this->references as $name => $ref) {
            $descriptors[$name] = $ref['table']->getFieldDescriptors();
        }
        return $this->fieldDescriptors = $descriptors;
    }

    public function getPrimaryKeyDescriptors() : array {
        if ($this->primaryKeyDescriptors) return $this->primaryKeyDescriptors;

        $descriptors = array();
        foreach ($this->references as $name => $ref) {
            $descriptors[$name] = $ref['table']->getAllDescriptors();
        }
        return $this->primaryKeyDescriptors = $descriptors;
    }

    public function extractPrimaryKeyFromHTTP(?array $values = null) : array {
        $result = array();
        foreach ($this->tables as $index => $table) {
            if ($table instanceof DBR) {
                $tableName = $table->getTableName();

                if (key_exists($tableName, $values)) {
                    if (key_exists($tableName, $result)) throw new DBerror("Ambiguous table identifier $tableName");
                    $result[$tableName] = $table->extractPrimaryKeyFromHTTP($values[$tableName]);

                } else if (key_exists($index, $values)) {
                    if (key_exists($index, $result)) throw new DBerror("Ambiguous table identifier $index");
                    $result[$index] = $table->extractPrimaryKeyFromHTTP($values[$index]);

                } // else continue; //do nothing

            } else if ($table instanceof DBJ) {
                if (!key_exists($index, $values)) continue;

                $array = $table->extractPrimaryKeyFromHTTP($values[$index]);
                foreach ($array as $key => $value) {
                    if (key_exists($key, $result)) throw new DBerror("Ambiguous table identifier $key");
                    $result[$key] = $value;
                }
            } else if (gettype($table) === 'array') continue; //PK only for first-level tables
            else throw new DBerror();
        }
        return $result;
    }

    public function getDBRimplementationReflection() : ReflectionClass {
        return $this->DBJRimplementation;
    }


    public function includesRootTableAtFirstLevel(string $tableName) : bool {
        return key_exists($tableName, $this->references)
                && !$this->references[$tableName]['nested'];
    }

    public function includesRootTable($tableName) : bool {
        return key_exists($tableName, $this->references);
    }

    public function includesRootDBTatFirstLevel(DBT $table) : bool {
        return in_array($table, $this->rootTables, true)
                && in_array($table, $this->tables, true);
    }

    public function includesDBTatFirstLevel(DBT $table) : bool {
        return in_array($table, $this->tables, true);
    }

    public function includesRootDBT(DBT $table) : bool {
        return in_array($table, $this->rootTables, true);
    }

    public function includesDBT(DBT $table) : bool {
        if (in_array($table, $this->tables, true)
                || in_array($table, $this->rootTables, true)) {
            return true;
        }

        return $this->includesDBT_DBJcheck($table);
    }

    // short-circuits the initial check in includesDBT when recursively invoking
    private function includesDBT_DBJcheck($table) : bool {
        if (!($table instanceof DBJ)) return false;
        //else search nested array for matching DBJ
        foreach($this->tables as $tbl) {
            if ($tbl === $table) return true;
            if ($tbl instanceof DBJ) {
                if ($tbl->includesDBT_DBJcheck($table)) return true;
            }
        }
        return false;
    }

    // $table may be DBT or DBJ -- will only return first-level tables
    public function getTableIndex(DBT $table) : int {
        $result = array_search($this->tables, $table, true);
        if ($result === false) throw new DBerror();
        return $result;
    }

    // root tables (DBT) only, no DBJ.  May be first-level or nested
    // nested will return an array of indexes.  First level will return a single integer
    public function getTableIndexByName(string $rootTableName) {
        if ($this->includesRootTable($rootTableName))
            return $this->references[$rootTableName]['index'];
        else throw new DBerror();
    }

    // may return DBT or DBJ, but will always be first-level
    public function getTableByIndex(int $index) {
        if (!key_exists($index, $this->tables)) throw new DBerror();
        return $this->tables[$index];
    }

    // should return DBT only, no DBJ
    public function getRootTableByName(string $name) : DBT {
        if (!key_exists($this->references)) {
            //try {

                if (key_exists($name, static::tableAliases)) {

                    if (key_exists(static::tableAliases[$name], $this->references)) {
                        $name = $this->tables[static::tableAliases[$name]];
                        $name = $name->getTableName();

                    } else throw new DBerror('Invalid index for Alias');
                } else throw new DBerror('Invalid Alias');

            //} catch (Exception $e) {
                    // catch static::tableAliases is nonexistant static property ??? (not sure exception type)
            //}
        }

        if (!$this->includesRootTableAtFirstLevel($name))
            throw new DBerror('cannot access nested tables with this method');

        return $this->references[$name]['table'];
    }
}