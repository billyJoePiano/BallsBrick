<?php

require_once('../blogDB.php');

$userToken = UserToken::authenticate();

require_once('../../template.php');



$postUser = null;
if (key_exists('id', $_GET) && ($id = intval($_GET['id'])) . '' === $_GET['id'] . '') {
    $postUser = PostUser::fetchPostId($id);
    if ($postUser) {
        if (!($userToken && $userToken->get(User::TABLE) === $postUser->get(User::TABLE))) {
            if (!$postUser->isPublished()) {
                $postUser = null;
            }
        }

        if ($postUser) {
            $comments = PostComments::fetchForPost($postUser->get('post'));
            $commentsForm = $comments->comment($postUser);
        }
    }
}


if ($postUser !== null) {
    Header::output('');
    echo $postUser;
    echo $comments;
    echo $commentsForm;
} else {
    Header::output('');
    echo "<h1 class=\"error\">Sorry, we couldn't find that blog post</h1>";
}

?>