<?php
//obscures pages that are not supposed to be user-facing by sending a 404
obscure(__FILE__);

function obscure(string $file) {
    $len = -min(strlen($file), strlen($_SERVER['SCRIPT_NAME']));
    if(substr($_SERVER['SCRIPT_NAME'], $len) === substr($file, $len)) {
        http_response_code(404);
        //SEND CUSTOM 404 PAGE HERE.  Should appear the same as 'normal' 404 error
        die();
    }
}

?>