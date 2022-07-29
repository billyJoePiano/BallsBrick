<?php

require_once('../blogDB.php');
require_once('../quill/quillInput.php');

$userToken = UserToken::authenticate(null, true);

$edit = PostUser::edit();

if ($edit instanceof HTMLform) {
    Header::output('Edit post');
    echo $edit;

} else if($edit instanceof PostUser) {
    $id = $edit->getPostId();
    $path = Request::getActualPath("../view/?id=$id");
    header("Location: $path");
}


?>