<?php
require_once('blogDB.php');

UserToken::authenticate();

$posts = PostUser::fetchRecent(20);

Header::output('Recent blog posts');
foreach($posts as $post) {
    echo $post->preview();
}
?>