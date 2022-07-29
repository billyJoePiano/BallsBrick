<?php
require_once('obscure.php');
obscure(__FILE__);

require_once('DButil.php');

if (!isset($_SERVER['REQUEST_URI'])) $_SERVER['REQUEST_URI'] = $_SERVER['PHP_SELF'] . '?DEBUG';
if (!isset($_SERVER['REMOTE_ADDR'])) $_SERVER['REMOTE_ADDR'] = '0.0.0.1';
if (!isset($_SERVER['REMOTE_PORT'])) $_SERVER['REMOTE_PORT'] = '0';
if (!isset($_SERVER['REQUEST_METHOD'])) $_SERVER['REQUEST_METHOD'] = 'GET';
if (!isset($_SERVER['HTTP_USER_AGENT'])) $_SERVER['HTTP_USER_AGENT'] = 'phpStorm Debugger';

if (!isset($_SERVER['HTTP_USER_AGENT'])) $_SERVER['HTTP_USER_AGENT'] = 'phpStorm Debugger';


class FormattedException extends Exception {
    public function __toString() :string {
        echo '<pre>';
        return parent::__toString();
    }
}

class StackTrace extends FormattedException { };

function stackTrace(?string $message = null) {
    try {
        throw new StackTrace;

    } catch (StackTrace $e) {
        if ($message !== null) $message .= '<br />';
        else $message = '';
        echo '<pre>' . $message . $e . '</pre></pre><br />';
    }
}


function outputVar($object, ?string $varName = 'Variable', $recursive = true) {

        $path = '/projects/project4/BallsBricks/stylesheets/debug.css';

        ?><link rel="stylesheet" type="text/css" href="<?= $path ?>" /><pre><?php

    if ($recursive) {
        if ($recursive === true) {
            // root level
            $recursive = array();

        } else if ($key = array_search($object, $recursive, true)) {
            // already described
            echo '<i>(Object already described at <b>' . htmlEscape($key)
                    . '</b>&nbsp;)</i>';
            return;
        }

        $recursive[$varName] = $object;
    }

    $varName = htmlEscape($varName);

    $type = gettype($object);
    $typeText = $type;

    switch ($type) {
        case 'object':
            $typeText .= ' ' . htmlEscape(get_class($object));
            break;

        case 'array':
            $typeText .= '(' . count($object) . ')';
    }

    echo <<<html
<p><b>$varName</b> <i>$typeText</i></p><table class="debug">
html;

    foreach($object as $key => $value) {
        $type = gettype($value);
        $typeText = $type;

        switch ($type) {
            case 'object':
                $typeText .= '<br />' . htmlEscape(get_class($value));
                break;

            case 'array':
                $typeText .= '(' . count($value) . ')';
                break;

            case 'string':
                $typeText .= '(' . strlen($value) . ')';
        }

        echo '<tr><td><b>' . htmlEscape($key)
                . "</b></td><td><i>$typeText</i></td><td>";

        if ($recursive && ($type === 'array'
                || ($type === 'object' && $value instanceof Traversable))) {
            outputVar($value, "$varName->$key", $recursive);

        } else if ($value === null) {
            echo '<u>null</u>';

        } else if ($type === 'boolean') {
            echo '<u>' . ($value ? 'true' : 'false') . '</u>';

        } else if ($type === 'string') {
            echo '"' . htmlEscape($value) . '"';
        } else {
            echo htmlEscape($value . '');
        }

        echo '</td></tr>';
    }
    echo '</table></pre>';
}

function generateValue() {
    switch (rand(0, 5)) {
        case 0:
            return rand(-100, 100);

        case 1:
            return password_hash('test', PASSWORD_DEFAULT);

        case 2:
            return rand(0, 1) ? true : false;

        case 3:
            return array('key' => 'value', 'field' => 'record');

        case 4:
            return new DBVdatetime('now');

        case 5:
            return null;
    }
}
?>