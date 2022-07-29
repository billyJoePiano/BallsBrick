<?php

require_once('../blogDB.php');
require_once('../quill/quillInput.php');

$userToken = UserToken::authenticate(true);

$create = PostUser::create();

if ($create instanceof HTMLform) {
    Header::output('Create post');
    echo $create;

} else if(gettype($create) === 'integer') {
    header("Location: view.php?id=$create");

} else throw new DBerror();



?>