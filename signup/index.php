<?php
require_once('../template.php');

UserToken::authenticate(false);
$signupForm = User::signup();

Header::output('Signup');

//something about logging in if already a user here...
echo $signupForm;

?>