<?php
header('Content-type: application/json');

require_once('Board.php');
require_once('../db/user.php');

$board = Board::fetchBoardId(3);
$boardJson = $board->get('board');
//outputVar($boardJson);

echo json_encode(array('boolTestTrue' => true,
                        'boolTestFalse' => false,
                        'nullTest' => null,
                        'intTest' => random_int(-2147483648, 2147483647),
                        'floatTest' => mt_rand(0, mt_getrandmax() - 1) / mt_getrandmax(),
                        'stringTest' => ' This is a string with leading and trailing spaces ',
                        'objectTest' => $boardJson->__toString()
                    ));

?>
