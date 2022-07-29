<?php
require_once('../db/obscure.php');
obscure(__FILE__);

require_once('DraftUpdate.php');
require_once('../db/user.php');


// This is for joining on the established requestId of the draft,
// NOT the joining table for irregular update requests (table name: `updateRequest`)

class DraftUpdateRequest extends DBJR {
    public static function fetchTable(?DBC &$dbc = null): DBJ {
        return static::getDBJ(array(
                Request::fetchTable($dbc),
                array(DraftUpdate::fetchTable($dbc))
            ));
    }

    /*
    public function __construct($values, ?DBC &$dbc = null, bool $alreadyQueried = false) {
        parent::__construct($values, $dbc, $alreadyQueried);
    }
    */

    /*
    public static function fetchFromRequest(Request $request) : DraftUpdateRequest {
        // need to fix DBJ writeSelectClause for ipv4 hex returns
        return new static(array('request' => $request));
    }
    */
}