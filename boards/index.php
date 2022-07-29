<?php
header('Content-type: application/json');
require_once('Board.php');
require_once('../db/user.php');


if ($_SERVER['REQUEST_METHOD'] === 'GET'
        && key_exists('id', $_GET)
        && $_GET['id'] . '' === ($id = intval($_GET['id']) . '')
        && ($board = Board::fetchBoardId($id))) {

    if (!$board->get('public')) {

        if ($token = UserToken::authenticate()) {
            if ($token->getUserId() === $board->get('userId')) {
                die ($board->get('board'));
            }

        }

    } else {
        die ($board->get('board'));
    }
}

echo '{}';

?>