<?php
require_once('debug.php');

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    outputVar(parse_url($_POST['path']), 'parse_url');
    outputVar(pathinfo ($_POST['path']), 'pathinfo');
    outputVar(array(
            'basename(path)' => basename($_POST['path']),
            'file_exists' => file_exists($_POST['path']),
            'file_exists(basename)' => file_exists(basename($_POST['path'])),
            'realpath' => realpath($_POST['path']),
            'realpath(basename)' => realpath(basename($_POST['path'])),
            'file_exists(parse_url(basename)[path])' => file_exists(parse_url(basename($_POST['path']))['path'])
        ));
}
?>
<form action="<?= $_SERVER['REQUEST_URI'] ?>" method="post">
    <input type="text" name="path" />
    <input type="submit" name="submit" />
</form>

<?php
outputVar($_SERVER, '$_SERVER');

outputVar(explode('/', $_SERVER['PHP_SELF']), 'PHP_SELF');
outputVar(explode('/', $_SERVER['SCRIPT_NAME']), 'SCRIPT_NAME');
?>
