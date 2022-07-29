<?php
require_once('../template.php');
require_once('../boards/BoardNoJSON.php');

$user = UserToken::authenticate(true);

$boards = BoardNoJSON::fetchForUser($user->getUserId(), false);

Header::$scripts[] = 'view';
Header::output('My Boards');

foreach($boards as $board) {
    echo $board;
}

?>