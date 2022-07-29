<?php

require_once('../blogDB.php');

$userToken = UserToken::authenticate();

$viewingOwn = false;

if (key_exists('id', $_GET)) {
    $id = intval($_GET['id']);
    if ($id . '' === $_GET['id'] . '') {
        try {
            $user = User::fetchUserId($id);

        } catch (NonexistentRecord $e) {
            $user = null;
        }
    }
    else $user = null;

} else {
    if ($userToken) {
        $user = $userToken->get(User::TABLE);
        $viewingOwn = true;

    } else $user = null;
}


if ($user) {
    $posts = PostUser::fetchRecent(0,
            $user->writeWhereClause($user->getPrimaryKeyValues(), $user->getTableName()),
            !$viewingOwn);

    Header::output('View user profile');
    echo $user;
    foreach ($posts as $post) {
        echo $post->preview();
    }

} else {
    Header::output('View user profile');
    echo '<div class="error"><h1>Error: Sorry we could not find that user</h1></div>';
}

?>