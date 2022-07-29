<?php
require_once('obscure.php');
obscure(__FILE__);

require_once('DButil.php');

// For Database Values other than int, float/double, and string... e.g. datetime
// The value of DBV objects should be immutable and set at construction
abstract class DBV {
    abstract function __construct(?string $value, bool $fromHTMLinput = false);
    abstract public function toHTMLoutput() : string;
    abstract public function toHTMLinput() : string;
    abstract public function toSQLstring(?DBC &$dbc = null) : string;

    abstract protected function equals(?DBV $other) : bool;
            // called by equalsTo and compared against $other->equals($this)

    public function __toString() : string {
        return $this->toHTMLoutput();
    }


    //these can be overridden by subclass, but provided as a convenience here

    public static function fromDB(string $value) : DBV {
        return new static($value, false);
    }

    public static function fromHTML(string $value) : DBV {
        return new static($value, true);
    }

    public static function getHTMLinput(string $name, string $label,
                                        ?string $value = null) : HTMLinput {
        if (!(static::$inputReflection instanceof ReflectionClass)) {
            static::$inputReflection = new ReflectionClass(static::$inputReflection);
        }

        $input = static::$inputReflection->newInstance($name, $label);
        if ($value !== null) $input->setDefaultValue($value);
        return $input;
    }

    public final function equalTo(?DBV $other) : bool {
        $result = $this->equals($other);
        if ($other !== null && $result !== $other->equals($this)) throw new DBerror();
        return $result;
    }

}

class DBVdatetime extends DBV {
    // for functions within SQL queries, e.g. STR_TO_DATE
    const SQL_FORMAT = '%m/%d/%Y %H:%i:%s';
    const PHP_TO_SQL_FORMAT = 'm/d/Y H:i:s'; //used together to construct SQL


    const SQL_TO_PHP_FORMAT = ''; // to be determined...


    public static string $phpToHtmlOutputFormat = 'g:ia D, M jS, Y';
    const PHP_TO_HTML_INPUT_FORMAT = 'Y-m-d\TH:i';
    const HTML_INPUT_TO_PHP_FORMAT = 'Y-m-d H:i';


    protected static $inputReflection = 'DatetimeInput'; //will be converted to ReflectionClass when needed
    private ?DateTimeImmutable $datetime = null;

    public function __construct(?string $value, bool $fromHTMLinput = false) {
        $this->datetime = new DateTimeImmutable($value);
    }

    public function getDatetime() : DateTimeImmutable {
        return $this->datetime;
    }

    public function toHTMLoutput() : string {
        return $this->datetime->format(static::$phpToHtmlOutputFormat);
    }

    public function toHTMLinput() : string {
        return $this->datetime->format(static::PHP_TO_HTML_INPUT_FORMAT);
    }

    public function toSQLstring(?DBC &$dbc = null) : string {
        $dbc = $dbc ?? DBC::get();

        return "STR_TO_DATE('" . $dbc->escape_string(
                $this->datetime->format(static::PHP_TO_SQL_FORMAT))
                . "', '" . static::SQL_FORMAT . "')";
    }

    protected function equals(?DBV $other): bool {
        if (!($other instanceof DBVdatetime)) return false;
        return $this->getDatetime() == $other->getDatetime();
    }
}

class_alias('DBVdatetime', 'DBVtimestamp');

class DBVdate extends DBVdatetime {
    const SQL_FORMAT = '%m/%d/%Y';
    const PHP_TO_SQL_FORMAT = 'm/d/Y';

    const PHP_TO_HTML_INPUT_FORMAT = 'Y-m-d';
    const HTML_INPUT_TO_PHP_FORMAT = 'Y-m-d'; // ??? not positive
    public static string $phpToHtmlOutputFormat = 'D, M jS, Y';

    public static function getHTMLinput(string $name, string $label,
            ?string $value = null) : HTMLinput {

        $input = new DateInput($name, $label);
        if ($value !== null) $input->setDefaultValue($value);
        return $input;
    }
}

/* Doubleton class with lazy getter. Use get(bool) to get one of the instances.
 * Either uses the SQL NOW() function with get(false), or the time of the server
 * request from the php $_SERVER superglobal with get(true)
 */
class DBVtimestampNow extends DBVtimestamp {
    private static ?DBVtimestampNow $sqlNow = null;
    private static ?DBVtimestampNow $serverRequestTime = null;

    //instance variable
    private bool $useServer = true;

    public function __construct(?string $value, bool $serverRequestTime = false) {
        if ($value === null) {
            if ($serverRequestTime && DBVtimestampNow::$serverRequestTime === null) {
                parent::__construct(date("Y-m-d H:i:s", $_SERVER['REQUEST_TIME']));
                DBVtimestampNow::$serverRequestTime = $this;
                return;

            } else if (DBVtimestampNow::$sqlNow === null) {
                $this->useServer = false;
                DBVtimestampNow::$sqlNow = $this;
                return;
            }
        }

        throw new Execption("Doubleton class!  Get instance from static get()");
    }

    public static function get(bool $serverRequestTime = true) : DBVtimestampNow {
        if($serverRequestTime) {
            return DBVtimestampNow::$serverRequestTime ?? new DBVtimestampNow(null, true);

        } else {
            return DBVtimestampNow::$sqlNow ?? new DBVtimestampNow(null, false);
        }
    }

    public function toSQLstring(?DBC &$dbc = null) : string {
        if($this->useServer) {
            return parent::toSQLstring($dbc);

        } else {
            return 'NOW()';
        }
    }

    public function toHTMLoutput() : string {
        if ($this->useServer) return parent::toHTMLoutput();
        else DBCtimestampNow::get(true)->toHTMLoutput();
    }

    public function toHTMLinput() : string {
        throw new DBerror('Cannot call toHTMLinput on DBVtimestampNow');
    }
}

abstract class IP extends DBV {
    public static function fromString(string $ipString) : array {
        try {
            $ipv4 = new DBVipv4($ipString);
            $ipv6host = null;
            $ipv6network = null;

        } catch (DBerror $e4) {
            $ipv4 = null;
            try {
                $ipv6 = new IPv6($ipString);
                $ipv6host = $ipv6->getHost();
                $ipv6network = $ipv6->getNetwork();

            } catch (DBerror $e6) {
                $ipv4 = new DBVipv4('0.0.0.0');
                $ipv6host = null;
                $ipv6network = null;
            }
        }

        return array (
                'ipv4' => $ipv4,
                'ipv6network' => $ipv6network,
                'ipv6host' => $ipv6host,
            );
    }
}

class DBVipv4 extends IP {
    private array $octets;

    public function __construct(?string $ipString, bool $fromSERVERinput = true) {
        if ($fromSERVERinput) {
            $octets = explode('.', $ipString);
            if (count($octets) !== 4) throw new DBerror();
            foreach ($octets as &$oct) {
                $str = $oct;
                $oct = intval($oct);
                if ($str !== ($oct . '') || $oct < 0 || $oct > 255)
                    throw new DBerror();
            }
            $this->octets = $octets;

        } else if (substr($ipString, 0, 2) === '0x') {
            //sql code -- SELECT *, CONCAT(CONV(SUBSTR(LPAD(HEX(ipv4), 8, '0'), -8, 2), 16, 10), '.', CONV(SUBSTR(LPAD(HEX(ipv4), 8, '0'), -6, 2), 16, 10), '.',  CONV(SUBSTR(LPAD(HEX(ipv4), 8, '0'), -4, 2), 16, 10), '.',  CONV(SUBSTR(LPAD(HEX(ipv4), 8, '0'), -2, 2), 16, 10)) AS `IPv4` FROM request;
            $ipString = substr($ipString, 2);

            if (strlen($ipString) > 8) throw new DBerror();
            $ipString = str_pad($ipString, 8, '0', STR_PAD_LEFT);
            while ($ipString !== '') {
                $octetHex = substr($ipString, 0, 2);
                $ipString = substr($ipString, 2);
                $octet = hexdec($octetHex);

                if ($octet < 0 || $octet > 255
                        || $octetHex !== str_pad(strtoupper(dechex($octet)), 2, '0', STR_PAD_LEFT)) {
                    throw new DBerror();
                }

                $octets[] = $octet;
            }

            if (count($octets) !== 4) throw new DBerror();
            $this->octets = $octets;

        } else throw new DBerror('ipv4 must be selected as a hex representation from the DB');

    }

    public function toSQLstring(?DBC &$dbc = null) : string {
        $result = '';
        foreach ($this->octets as $oct) {
            $oct = dechex($oct);
            if (strlen($oct) === 1) $oct = '0' . $oct;
            if (strlen($oct) !== 2) throw new DBerror();
            $result .= $oct;
        }
        if (strlen($result) !== 8) throw new DBerror();
        return "0x$result";
    }

    public function toHTMLoutput() : string {
        return implode('.', $this->octets);
    }

    public function toHTMLinput() : string {
        return $this->toHTMLoutput();
    }

    protected function equals(?DBV $other): bool {
        if (!($other instanceof DBVipv4)) return false;
        return     $this->octets[0] === $other->octets[0]
                && $this->octets[1] === $other->octets[1]
                && $this->octets[2] === $other->octets[2]
                && $this->octets[3] === $other->octets[3];
    }
}

class IPv6 {
    private IPv6half $host;
    private IPv6half $network;
    public function __construct($ipString) {
        $hextets = explode('::', $ipString);

        if (count($hextets) === 1) {
            $hextets = explode(':', $hextets[0]);
            if (count($hextets) !== 8) throw new DBerror();

        } else if (count($hextets) === 2) {
            $first = explode(':', $hextets[0]);
            $second = explode(':', $hextets[1]);

            $firstCount = count($first);
            $secondCount = count($second);

            if ($firstCount === 1 && $first[0] === '') {
                unset($first[0]);
                $firstCount = 0;
            }
            if ($secondCount === 1 && $second[0] === '') {
                unset($second[0]);
                $secondCount = 0;
            }

            $totalCount = $firstCount + $secondCount;
            if ($totalCount >= 8) throw new DBerror();

            $hextets = array_fill(0, 8 - $totalCount, null);
            $hextets = array_merge($first, $hextets, $second);

        } else throw new DBerror();

        $hextets = array_chunk($hextets, 4);

        if (count($hextets) !== 2) throw new DBerror();
        $this->network = IPv6Half::constructHalf($hextets[0], true,
                                                    $hextets[0][3] === null
                                                &&  $hextets[1][0] !== null);

        $this->host = IPv6Half::constructHalf($hextets[1], false,
                                                    $hextets[1][3] === null);
    }

    public function getNetwork(): IPv6Half {
        return $this->network;
    }

    public function getHost(): IPv6Half {
        return $this->host;
    }

    public function __toString() : string {
        return $this->network . $this->host;
    }
}

class IPv6Half extends IP {
    private array $hextets;
    //private static ?string $PROTECTOR = null;
    private bool $networkHalf;
    private bool $endsWithLastNull;

    public function __construct(?string $DO_NOT_INVOKE, bool $NOPE = false) {
        if ($DO_NOT_INVOKE !== static::$PROTECTOR && $NOPE !== true) throw new DBerror();
    }

    public static function constructHalf(array $hextets,
                                         bool $isNetworkHalf,
                                         bool $endsWithLastNull) {

        if (count($hextets) !== 4) throw new DBerror();
        if ($endsWithLastNull && $hextets[3] !== null) throw new DBerror();
        if ($hextets[3] === null && !($endsWithLastNull || $isNetworkHalf))
            throw new DBerror();


        if (static::$PROTECTOR === null)
            static::$PROTECTOR = password_hash(random_int(1000000, 9999999), PASSWORD_DEFAULT);

        $instance = new IPv6half(static::$PROTECTOR, true);

        $instance->networkHalf = $isNetworkHalf;
        $instance->endsWithLastNull = $endsWithLastNull;

        foreach ($hextets as $hextet) {
            switch (gettype($hextet)) {
                case 'string':
                    $str = $hextet;
                    $hextet = intval($str, 16);
                    if (base_convert($hextet, 10, 16) !== $str) throw new DBerror();
                    //fall through

                case 'integer':
                    if ($hextet < 0 || $hextet > 65535) throw new DBerror();
                    // fall through

                case 'NULL':
                    $instance->hextets[] = $hextet;
                    break;

                default:
                    throw new DBerror('not a valid hextet');
            }
        }

        return $instance;
    }


    public function toHTMLoutput(): string {
        $string = '';
        $previousNull = false;

        foreach($this->hextets as $index => $hextet) {
            if ($hextet === null) {
                $previousNull = true;
                if ($this->networkHalf && $index === 0) $string .= ':';
                continue;

            } else if ($previousNull) {
                $string .= ':';
                $previousNull = false;

            }

            $string .= dechex($hextet) . ':';
        }

        if($this->endsWithLastNull) return $string . ':';
        else if (!$this->networkHalf) $string = substr($string, 0, -1);
        return $string;
    }

    public function toHTMLinput(): string {
        return $this->toHTMLoutput();
    }

    public function toSQLstring(?DBC &$dbc = null): string {
        $string = '';
        foreach ($this->hextets as $hextet) {
            if ($hextet === null && $string === '') continue;
            $hexStr = dechex($hextet ?? 0);

            $pad = 4 - strlen($hexStr);
            if ($pad < 0) throw new DBerror();
            else if ($pad > 0 && $string !== '') {
                $hexStr = str_repeat('0', $pad) . $hexStr;
            }

            $string .= $hexStr;
        }

        if ($string === '') $string = '0';
        return "0x$string";
    }

    protected function equals(?DBV $other): bool {
        if (!(($other instanceof IPv6Half)
                && $this->networkHalf === $other->networkHalf)) return false;

        foreach ($this->hextets as $index => $hextet) {
            if ($hextet === 0 || $hextet === null) {
                if ($other->hextets[$index] !== 0 || $other->hextets !== null) return false;

            } else {
                if ($other->hextets[$index] !== $hextet) return false;
            }
        }
        return true;
    }
}


class DBint extends DBV {
    private ?int $num = null;

    public function __construct(?string $value, bool $fromHTMLinput = false) {
        $this->num = intval($value);
        if ($this->num . '' !== $value) throw new DBerror();
    }

    public function toHTMLoutput(): string {
        return $this->num ?? '';
    }

    public function toHTMLinput(): string {
        return $this->num ?? '';
    }

    public function toSQLstring(?DBC &$dbc = null): string {
        return $this->num ?? 'NULL';
    }

    public function equals(?DBV $other) : bool {
        if (!($other instanceof DBint)) return false;
        return $this->num === $other->num;
    }
}

class CurrentDBconnectionsCount extends DBint {
    public function __construct(?string $value, bool $fromHTMLinput = false) {
        if ($value !== 'current' || !$fromHTMLinput) throw new DBerror();
    }

    public function toHTMLoutput(): string {
        return DBC::getCount();
    }

    public function toHTMLinput(): string {
        return DBC::getCount();
    }

    public function toSQLstring(?DBC &$dbc = null): string {
        return DBC::getCount();
    }

    public function equals(?DBV $other) : bool {
        return false;
    }
}

class DBVjson extends DBV {
    private ?string $value;

    public function __construct(?string $value, bool $fromHTMLinput = false) {
        $this->value = $value;
    }

    public function toHTMLoutput(): string {
        return $this->value;
    }

    public function toHTMLinput(): string {
        return $this->value;
    }

    public function toSQLstring(?DBC &$dbc = null): string {
        return "'" . ($dbc ??= DBC::get())->escape_string($this->value) . "'";
    }

    public function equals(?DBV $other) : bool {
        if (!($other instanceof DBVjson)) return false;
        return $this->value === $other->value;
    }
}

class DBVjsonCopyFrom extends DBVjson {
    //TO DO -- flesh this out more... make more than just a query string (e.g. table, field, where clause, etc)
    public function __construct(?string $query, bool $fromHTMLinput = false) {
        parent::__construct($query, $fromHTMLinput);
    }

    public function toSQLstring(?DBC &$dbc = null): string {
        return '(' . $this->toHTMLoutput() . ')';
    }

    public function equals(?DBV $other) : bool {
        if (!($other instanceof DBVjsonCopyFrom)) return false;
        return parent::equals($other);
    }
}

?>