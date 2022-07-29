<?php
require_once('../template.php');

$userToken = UserToken::authenticate();

if ($userToken) $userToken->logout();

UserToken::redirectFromLogout(); //happens automatically from logout(), but in case there is no token

?>