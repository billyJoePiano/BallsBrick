<?php
require_once('template.php');
require_once('boards/BoardNoJSON.php');

UserToken::authenticate();

$boards = BoardNoJSON::fetchRecentBoards();

Header::$scripts[] = 'view';

Header::output('The Brick Breaker');

foreach($boards as $board) {
    echo $board;
}


?>