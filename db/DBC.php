<?php
require_once('obscure.php');
obscure(__FILE__);

require_once('DButil.php');

class DBC extends mysqli {
    const SERVER = 'localhost';
    const USERNAME = 'game';
    const PASSWORD = 'CMgck93euty2Pbs4fTXNFRgpLHqYCf7J86t3kDdu9U7UgC5P8Qsfv953v5N8h8n3';
    const DATABASE = 'game';
    private static int $counter = 0;

    private bool $FKchecksDisabled = false;
    private bool $session = false;
    private int $dbcNum;

    private function __construct() {
        parent::__construct(DBC::SERVER, DBC::USERNAME, DBC::PASSWORD, DBC::DATABASE);
        $this->dbcNum = static::$counter++;
        //echo 'DBC open: ' . $this->dbcNum;
    }

    //Ensures that the connection closes as soon as the variable becomes inaccessible.
    // Seems php is aggressive about garbage collection, according to my tests...
    // Also means it is super-easy to close a connection... just change the value of the
    // only variable holding it, and BOOM, it closes automatically :-D
    function __destruct() {
        if ($this->FKchecksDisabled) $this->enableForeignKeyChecks();
        Request::writeOrApplyCurrentToDB($this);
        if ($this->session) static::$dbcSession = null;
        static::$tempSession = null;
        mysqli_close($this);

        //echo 'DBC closed: ' . $this->dbcNum;
    }

    //DBC functions, ensure efficient use of a database connection, and that it is
    // closed when not in use.

    private static ?DBC $dbcSession = null;
    private static ?WeakReference $tempSession = null;

    // Call this when a series of consecutive functions using a DBC are about
    // to be invoked, so they can all use the same DBC, rather than opening and
    // closing a bunch of seperate connections in succession
    public static function startSession() : DBC {
        static::$dbcSession ??= static::get();
        static::$dbcSession->session = true;
        return static::$dbcSession;
    }

    // Returns an open DBC session, or creates a temporary DBC if an open
    // session doesn't exist.  In the latter case, the connection will close
    // as soon as its destructor is called (i.e. when the invoking function exits)
    public static function get() : DBC {
        if (static::$dbcSession) return static::$dbcSession;
        if (!(static::$tempSession && ($temp = static::$tempSession->get()))) {
            $temp = new static();
            static::$tempSession = WeakReference::create($temp);
        }
        return $temp;
    }


    // returns the static variable to null.  The connection will not actually
    // close until all references to the variable are unset, or the close method
    // is manually called
    public static function closeSession() {
        if (!static::$dbcSession) throw new DBerror('Cannot close nonexistent DBC session');
        static::$dbcSession = null;
    }



    //should improve this to account for multiple databases and connection hosts...
    private ?array $tables = null;
    private ?array $tablesEscaped = null;

    public function getTables(?DBC &$dbc = null) : array {
        if ($this->tables !== null) return $this->tables;

        if (!($result = $this->query('SHOW TABLES'))) {
            throw new DBerror();
        }

        $tables = array();
        $tablesEscaped = array();

        while($row = $result->fetch_array(MYSQLI_NUM)) {
            $tables[] = $row[0];
            $tablesEscaped[] = '`' . $this->escape_string($row[0]) . '`';
        }

        $this->tables = &$tables;
        $this->tablesEscaped = &$tablesEscaped;

        return $tables;
    }

    public function getTablesEscaped(?DBC &$dbc = null) : array {
        if ($this->tablesEscaped === null) $this->getTables($dbc);
        return $this->tablesEscaped;
    }

    public function lockTable($table, bool $write = false) {
        if ($table instanceof DBT) $table = $table->getEscapedTableName();
        if (gettype($table) !== 'string' || $table === '') throw new DBerror();

        // NEED MORE CODE HERE
    }

    public function unlockTables() {
        if (!$this->query('UNLOCK TABLES')) throw new DBerror('Error unlocking tables');
    }

    /*
     * Locks ALL tables in the DBC to prevent anything from being inserted.
     * In multi-threaded situations, this ensures the integrity of the
     * auto_increment primaryKey returned by mysqli->insert_id, as well as
     * foreign keys if foreign key checks have been temporarily disabled for a special insert.
     *
     * Note that only the table being inserted into is locked for WRITE. All others
     * are READ locks, allowing other connections to also read but preventing any
     * inserts into those tables, thus preventing race-conditions with (e.g.)
     * mysqli->insert_id or re-enabling foreign key checks
     */
    public function lockToInsert(DBT $table) {
        $tables = $this->getTablesEscaped();
        $escapedName = $table->getEscapedTableName(true);

        $index = array_search($escapedName, $tables, true);
        if ($index === false) {
            outputVar($tables);
            echo $escapedName;
            throw new InsertError('Table ' . $table->getTableName()
                    . ' not found in SHOW TABLES');
        }
        unset($tables[$index]);

        if (count($tables) > 0) {
            $lockQuery = 'LOCK TABLES ' . implode(' READ,', $tables)
                    . " READ, $escapedName WRITE";

        } else {
            $lockQuery = "LOCK TABLES $escapedName WRITE";
        }

        if (!$this->query($lockQuery)) {
            throw new QueryError($lockQuery);
        }
    }

    //not sure if there is a purpose for this function... leaving just in case???
    public function lockAllForWrite() {
        $tables = $this->getTablesEscaped();
        $lockQuery = 'LOCK TABLES ' . implode(' WRITE,', $tables)
                . ' WRITE';

        if (!$this->query($lockQuery)) {
            throw new QueryError($lockQuery);
        }
    }


    // WARNING: only use when ALL TABLES ARE LOCKED
    public function disableForeignKeyChecks() {
        $disableFKquery = 'SET FOREIGN_KEY_CHECKS=0';
        if (!$this->query($disableFKquery)) throw new QueryError($disableFKquery);
        $this->FKchecksDisabled = true;
    }

    public function enableForeignKeyChecks() {
        $disableFKquery = 'SET FOREIGN_KEY_CHECKS=1';
        if (!$this->query($disableFKquery)) throw new QueryError($disableFKquery);
        $this->FKchecksDisabled = false;
    }

    public static function getCount() : int {
        return static::$counter;
    }
}



?>