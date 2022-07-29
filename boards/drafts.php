<?php
require_once('Draft.php');
require_once('DraftUpdate.php');
require_once('../db/user.php');


header('Content-type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    require_once('draftsGet.php');

} else if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    require_once('draftsPost.php');

} else {
    echo 'NOT CONFIGURED TO HANDLE REQUEST METHOD: ' . $_SERVER['REQUEST_METHOD'];
}

?>