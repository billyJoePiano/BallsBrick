<?php
require_once('../db/user.php');

UserToken::authenticate(true);
Request::writeOrApplyCurrentToDB();
DBC::closeSession();

require_once('../boards/Draft.php');

$type = Draft::getDraftTypeCode();

if ($type === null) {
    UserToken::redirectFromLogin();
}

$boardId = intval($_GET[Draft::DRAFT_CODES[$type]]);
if ($boardId . '' !== $_GET[Draft::DRAFT_CODES[$type]] . '') {
    UserToken::redirectFromLogin();
}

$path = Request::getHomePath();

?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="stylesheet" type="text/css" href="<?= $path ?>/stylesheets/board.css" />
    <script type="text/javascript" src="<?= $path ?>/js/initialize.js" defer></script>
    <script type="text/javascript" src="<?= $path ?>/js/edit.js" defer></script>

</head>
<body>
    <?= Draft::generateCanvasWithLink($boardId, $type) ?>
    <?= Board::generateNavButtons(true); ?>
</body>
</html>
