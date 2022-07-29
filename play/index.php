<?php
require_once('../db/user.php');
require_once('../boards/BoardNoJSON.php');
require_once('../boards/Draft.php');

$user = UserToken::authenticate();
Request::writeOrApplyCurrentToDB();
DBC::closeSession();

if (!(key_exists('id', $_GET)
        && $_GET['id'] . '' === ($boardId = intval($_GET['id']) . '' )
        && ($board = BoardNoJSON::fetchBoardId($boardId)))) {

    if ($user) {
        UserToken::redirectFromLogin();
    } else {
        UserToken::redirectFromLogout();
    }
}

$path = Request::getHomePath();
BoardNoJSON::$viewer = false;

?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="stylesheet" type="text/css" href="<?= $path ?>/stylesheets/board.css" />
    <script type="text/javascript" src="<?= $path ?>/js/initialize.js" defer></script>
    <script type="text/javascript" src="<?= $path ?>/js/play.js" defer></script>

</head>
<body>
    <?= $board ?>
    <?= Board::generateNavButtons((bool)$user) ?>
</body>
</html>
