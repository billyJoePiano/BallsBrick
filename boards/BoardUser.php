<?php
require_once('../db/obscure.php');
obscure(__FILE__);

require_once('Board.php');
require_once('../db/user.php');

class BoardUser extends DBJR {

    public static function fetchTable(?DBC &$dbc = null): DBJ {
        return static::getDBJ(array(
                Board::fetchTable($dbc),
                User::fetchTable($dbc),
            ));
    }

    public static function fetchBoardId(int $id) : ?BoardUser {
        try {
            return new static(array('board' => $id));
        } catch (NonexistentRecord $e) {
            return null;
        }
    }
}

?>