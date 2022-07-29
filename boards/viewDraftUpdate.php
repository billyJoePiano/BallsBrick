<style>
    span {
        display: inline-block;
        padding: 0.25em;
        background: #DDD;
        border: 1px solid #999;
    }

    span.error {
        border: 2px solid darkred;
        color: darkred;
        background-color: pink;
    }

    span.warning {
        background-color: lightgoldenrodyellow;
    }
    td, th {
        border: 1px solid #999;
        padding: .2em .3em;
    }
    table {
        margin: 1em 20px 0 0;
        border-collapse: collapse;
        font-size: 90%;
    }

</style>

<table><thead><tr>

<?php
require_once('DraftUpdate.php');
require_once('../db/user.php');
Request::$logCurrent = false;
Request::$overrideLogCurrentForDBCcount = false;


$dbc = DBC::startSession();


$duFields = DraftUpdate::fetchTable($dbc)->getAllDescriptors();

$rqFields = Request::fetchTable($dbc)->getAllDescriptors();
foreach ($duFields as $field => $descriptor) {
    $label = $descriptor['label'];
    echo "<th>$label</th>";
}

echo '<th>Actual draft id</th>';

foreach ($rqFields as $field => $descriptor) {
    if (substr($field, 0, 4) === 'ipv6' || $field === 'dbConnections' || $field === 'port') {
        unset($rqFields[$field]);
    } else {
        $label = $descriptor['label'];
        echo "<th>$label</th>";
    }
}

?>

</tr></thead><tbody>

<?php

DBVdatetime::$phpToHtmlOutputFormat = 'g:i:sa';

$result = $dbc->query('SELECT * FROM draftUpdate ORDER BY time DESC, id DESC');

$select = Request::fetchTable($dbc)->writeSelectClause($dbc) . ', ur.actualDraftId';

while ($row = $result->fetch_array(MYSQLI_ASSOC)) {
    $du = DraftUpdate::createInstanceFromValues($row, $dbc);
    echo '<tr>';
    foreach($duFields as $field => $descriptor) {
        echo '<td>' . $du->get($field) . '</td>';
    }
    $id = $du->get('id');

    $subresult = $dbc->query("SELECT $select FROM updateRequest ur JOIN request r ON ur.requestId = r.id WHERE ur.updateId = $id");
    while ($row = $subresult->fetch_array(MYSQLI_ASSOC)) {
        echo '<td>' . $row['actualDraftId'] .'</td>';
        unset($row['actualDraftId']);
        $rq = Request::createInstanceFromValues($row, $dbc);
        foreach($rqFields as $field => $descriptor) {
            echo '<td>' . $rq->get($field) . '</td>';
        }
    }
    echo '</tr>';
}

?>
</tbody></table>