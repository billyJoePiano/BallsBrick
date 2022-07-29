<?php
require_once('../db/obscure.php');
obscure(__FILE__);

const NAV_LINKS_GENERAL = array(
        '/' => "Brick Breaker",
        '/blog' => 'Blog Home'
);

const NAV_LINKS_LOGGED_IN = array(
        '/blog/viewProfile' => 'View My Blog Posts',
    //'editProfile.php' => 'Edit Profile',
        '/blog/createPost' => 'Create New Blog Post',
        '/logout' => 'Logout',
);

const NAV_LINKS_LOGGED_OUT = array(
        '/login' => 'Log In',
        '/signup' => 'Sign up'
);

//if not listed, default is assumed true which means redirect to the current $_SERVER['REQUEST_URI']
// false means no redirect instruction (use the logout default)

const REDIRECT_ON_LOGOUT = array(
        '/blog/createPost' => false,
        '/blog/editPost' => '/blog/view?', // ? means append current get query string
);

?>