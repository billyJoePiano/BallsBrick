<?php
require_once(__DIR__ . '/../db/obscure.php');
obscure(__FILE__);

require_once('Board.php');


class BoardNoJSON extends Board {
    use QuickTable;
    const SELECT_FIELDS = array('id', 'userId', 'name', 'created', 'modified', 'public');
    const FIELD_ATTRIBUTES = array('board' => array('use' => false));
    public static bool $viewer = true;
    private ?int $drafts = null;
    private ?string $username = null;

    public static function fetchRecentBoards(int $limit = 20) : array {
        if ($limit < 1) throw new DBerror();
        $table = static::fetchTable();
        $select = $table->writeSelectClause();
        $query = "SELECT $select FROM board WHERE public = true ORDER BY created DESC LIMIT $limit";

        $dbc = DBC::get();
        $result = $dbc->query($query);
        if (!$result) throw new QueryError($query);
        $boards = array();
        while ($row = $result->fetch_array(MYSQLI_ASSOC)) {
            $boards[] = new static($row, $dbc, true);
        }
        return $boards;
    }

    public function __toString() : string {
        if (static::$viewer) {
            if ($this->drafts) {
                $footer = '<a href="' . Request::getHomePath()
                    . '/myDrafts?board=' . $this->get('id') . '" />'
                    . $this->drafts . ' draft(s)</a>';

            } else {
                $footer = '';
            }

            return '<div class="boardViewer"><h2>' . htmlEscape($this->get('name'))
                    . '</h2>' . parent::__toString() . $footer . '</div>';

        } else return parent::__toString();
    }

    public static function fetchForUser(int $userId, bool $public) : array {
        $table = static::fetchTable();
        $select = $table->writeSelectClause();
        $where = $public ? 'public = TRUE AND ' : '';

        if ($public) {
            $where = "public = TRUE AND userId = $userId";
            $join = '';
        } else {
            $select .= ', drafts';
            $join = " LEFT OUTER JOIN (SELECT COUNT(*) as drafts, boardId FROM draft "
                    . "GROUP BY boardId) as draft ON board.id = draft.boardId ";

            $where.= "userId = $userId";
        }


        $query = "SELECT $select FROM board$join WHERE $where ORDER BY created DESC";
        $dbc = DBC::get();
        $result = $dbc->query($query);
        if (!$result) throw new QueryError($query);
        $array = array();
        while ($row = $result->fetch_array(MYSQLI_ASSOC)) {
            if (!$public) {
                $draftCount = $row['drafts'];
                if (!key_exists('drafts', $row)) throw new DBerror($query);
                else if ($draftCount === null) $draftCount = 0;
                else if (($draftCount = intval($draftCount)) . ''
                            !== $row['drafts'] . '')
                    throw new DBerror($query);

                unset($row['drafts']);
                $board = new static($row, $dbc, true);
                $board->drafts = $draftCount;
                $array[] = $board;

            } else {
                $array[] = new static($row, $dbc, true);
            }
        }

        return $array;
    }
}