<?php
require_once('../db/user.php');
require_once('../template.php');

UserToken::authenticate(false);
$loginForm = User::login();

Header::output('Login');

//something about signing up here...

echo $loginForm;

?>