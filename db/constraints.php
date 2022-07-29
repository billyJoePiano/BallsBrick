<style>
    table {
        border-collapse: collapse;
        border: solid grey 2px;
    }

    td, th {
        border: solid #CCC 1px;
        padding: 0.5em;
    }

    small {
        font-size: 0.7em;
        color: #999;
    }
</style>

<?php

    include('DBC.php');
    $dbc = DBC::get();

    $result = $dbc->query("SELECT * FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = '" . DBC::DATABASE . "'");

    $row = $result->fetch_array(MYSQLI_ASSOC);
    echo '<pre><table><thead><tr>';
    $metaheaders = array('CONSTRAINT_', 'TABLE_', '', 'REFERENCED_');

    foreach($metaheaders as $header) {
        echo '<th colspan="3">' . htmlEscape($header) . '</th>';
    }
    echo '</tr><tr>';
    $metaIndex = 0;

    foreach($row as $field => $value) {
        $metaheader = $metaheaders[floor($metaIndex++ / 3)];
        echo '<th>' . htmlEscape(substr($field, strlen($metaheader))) . '</th>';
    }

    echo '</tr></thead><tbody>';

    do {
        echo '<tr>';
        foreach($row as $value) {
            if ($value === null) echo '<td><small><i>NULL</i></small></td>';
            else echo '<td>' . htmlEscape($value) . '</td>';
        }
        echo '</tr>';

    } while ($row = $result->fetch_array(MYSQLI_ASSOC));

    echo '</tbody></table></pre>';

?>