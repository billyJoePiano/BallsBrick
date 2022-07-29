<?php
require_once('obscure.php');
obscure(__FILE__);

require_once('debug.php');

class DBerror extends FormattedException {
    const MESSAGE = 'Database Error';

    public function __construct(string $message = '', int $code = 0,
                                ?Throwable $previous = null) {
        if ($message === '') $message = static::MESSAGE;
        parent::__construct($message, $code, $previous);
    }
}
class DBtypeMismatch extends DBerror { }

class QueryError extends DBerror { }
class NonexistentRecord extends DBerror { }
class MultipleRecords extends DBerror { }

class FieldValidationError extends DBerror {
    const MESSAGE = 'Field Validation Error';
}

abstract class ValidationErrorArray extends FieldValidationError {
    public array $errors = array();
    public ?array $values = null;

    public function __toString() : String {
        $str = parent::__toString();
        foreach($this->errors as $field => $err) {
            $str .= "\n\n$field: " . $err;
        }
        return $str;
    }
}

class InsertError extends ValidationErrorArray { }
class UpdateError extends ValidationErrorArray { }


// polyfill
function str_contains(string $haystack, string $needle) : bool {
    return strpos($haystack, $needle) !== false;
}

trait QuickTable {
    protected static ?DBT $table = null;
}

//convenience function for escaping html output strings
function htmlEscape($string) : string {
    return filter_var($string . '', FILTER_SANITIZE_STRING);
}

const JS_ESCAPE_CHARS = array(
        '\\' => '\\\\',
        '"'  => '\\"',
        "'"  => "\\'",
        '`'  => '\\`',
        '\n' => '\\n',
        '\t' => '\\t',
        '\r' => '\\r',
        //potentially others ???
    );

//for escaping strings to be dynamically injected (by php) into JS scripts
function jsEscape(string $string) : string {
    return strtr($string, JS_ESCAPE_CHARS);
}

const NONSTANDARD_NUMBER_TYPES = array(
        'int unsigned' => array(
                'phpType' => 'double',
                'minVal' => 0,
                'maxVal' => 4294967295
            ),
        'bigint unsigned' => array(
                'phpType' => 'double',
                'minVal' => 0,
                'maxVal' => 18446744073709551615
            ),
        'smallint unsigned' => array(
                'phpType' => 'integer',
                'minVal' => 0,
                'maxVal' => 65535
            ),
    );


?>