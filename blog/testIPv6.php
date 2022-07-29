<?php
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $_SERVER['REMOTE_ADDR'] = $_POST['REMOTE_ADDR'];
        echo $_SERVER['REMOTE_ADDR'];
    }
    require_once('../db/user.php');
    UserToken::authenticate();
    $request = Request::getCurrent();
    if ($ipv6 = $request->get('ipv6network'))
        echo 'ipv6: ' . $ipv6->toSQLstring() . ' : '
                . $request->get('ipv6host')->toSQLstring();
    else
        echo 'ipv4: ' . $request->get('ipv4')->toSQLstring();

    outputVar($request);
?>

<form action="<?= $_SERVER['PHP_SELF'] ?>" method="post">
    <input type="text" name="REMOTE_ADDR" value="<?= htmlEscape($_SERVER['REMOTE_ADDR']) ?>"/>
    <input type="submit" />
</form>
