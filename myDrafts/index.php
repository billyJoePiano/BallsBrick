<?php
require_once('../template.php');
require_once('../boards/DraftNoJSON.php');

$user = UserToken::authenticate(true);

if (key_exists('board', $_GET)
        && ($boardId = $_GET['board']) . '' === $_GET['board'] . '') {
    $drafts = DraftNoJSON::fetchBoardDrafts($boardId, $user->getUserId());

} else {
    $drafts = DraftNoJSON::fetchUserDrafts($user->getUserId());
}

if (count($drafts) > 0) {
    Header::$scripts[] = 'view';

} else {
    $drafts[0] = "<h2 class=\"error\">Sorry we couldn't find any drafts that matched</h2>";
}

Header::output('My Drafts');

foreach($drafts as $draft) {
    echo $draft;
}


?>