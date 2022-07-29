<?php
require_once(__DIR__ . '/../db/obscure.php');
obscure(__FILE__);

require_once('Draft.php');


class DraftNoJSON extends Draft {
    use QuickTable;
    const SELECT_FIELDS = array('id', 'name', 'created', 'clientCheck', 'boardId', 'userId', 'requestId');
    const FIELD_ATTRIBUTES = array('draft' => array('use' => false));
    public static bool $viewer = true;
    private ?int $drafts = null;
    private ?string $boardName = null;

    public static function fetchUserDrafts(int $userId) : array {
        $select = 'draft.id, draft.name, draft.created, clientCheck, boardId, '
                . 'draft.userId, requestId, board.name as boardName';
        $query = "SELECT $select FROM draft LEFT OUTER JOIN board "
                . "ON draft.boardId = board.id "
                . "WHERE draft.userId = $userId OR board.userId = $userId "
                . "ORDER BY created DESC";

        $dbc = DBC::get();
        $result = $dbc->query($query);
        if (!$result) throw new QueryError($query);
        $drafts = array();
        while ($row = $result->fetch_array(MYSQLI_ASSOC)) {
            $boardName = $row['boardName'];
            unset($row['boardName']);
            $draft = new static($row, $dbc, true);
            $draft->boardName = $boardName;
            $drafts[] = $draft;
        }
        return $drafts;
    }

    public static function fetchBoardDrafts(int $boardId, int $userId) {
        $select = 'draft.id, draft.name, draft.created, clientCheck, boardId, '
                . 'draft.userId, requestId, board.name as boardName';
        $query = "SELECT $select FROM draft LEFT OUTER JOIN board "
                . "ON draft.boardId = board.id "
                . "WHERE board.id = $boardId AND board.userId = $userId "
                . "ORDER BY created DESC";

        $dbc = DBC::get();
        $result = $dbc->query($query);
        if (!$result) throw new QueryError($query);
        $drafts = array();
        while ($row = $result->fetch_array(MYSQLI_ASSOC)) {
            $boardName = $row['boardName'];
            unset($row['boardName']);
            $draft = new static($row, $dbc, true);
            $draft->boardName = $boardName;
            $drafts[] = $draft;
        }
        return $drafts;
    }

    public function __toString() : string {
        if (static::$viewer) {
            $name = $this->get('name');
            if ($name) $name = '<h2>' . htmlEscape($name) . '</h2>';
            else $name = '<h2 class="untitled">(untitled)</h2>';

            $parent = parent::__toString();
            $home = Request::getHomePath();
            $id = $this->get('id');

            // reclaim abandonded draft
            $copy = '<a href="$home/edit?copy=' . $id
                    . '">Or make a copy... the old one will still be here</a>';

            if ($this->get('requestId') === null) {
                $continue = '<a href="$home/edit?continue=' . $id . '">'
                        . 'Start editing this draft</a>';

                $message = '';

            } else {
                $timeDiff = $this->get('clientCheck') ?? $this->get('created');

                $timeDiff = $timeDiff->getDatetime()
                        ->diff(DBVtimestampNow::get()->getDatetime(), true);

                if (!$timeDiff) throw new DBerror();

                $continue = 'Restart editing this draft';

                if ($timeDiff->y > 0 || $timeDiff->m > 0 || $timeDiff->d > 0) {
                    $message = 'Abandoned... looks there was a bad internet connection from a while ago';

                } else if ($timeDiff->h > 0 || $timeDiff->i >= 9) {
                    $message = 'Abandoned... Did you lose your internet connection in the past day?';

                } else if ($timeDiff->i >= 1) {
                    $message = 'Did you just lose your connection a few minutes ago? '
                            . 'Or are you still connected on another device or browser tab?';

                    $continue = 'Restart editing this draft anyways';

                } else {
                    $message = 'It looks like there is currently another device or browser tab working on this draft';
                    $continue = 'TAKE CONTROL HERE ANYWAYS!';
                }

                $continue = '<a href="$home/edit?reclaim=' . $id . '">'
                        . $continue . '</a>';

                $message = '<p>' . $message . '</p>';

            }

            $accessed = $this->get('clientCheck');
            $accessed = $accessed ? 'Last accessed ' . $this->get('clientCheck')
                                : 'Not accessed since being created';

            $message = '<p>Draft created ' . $this->get('created')
                    . "</p><p>$accessed</p>$message";

            //board link
            if ($this->get('boardId') !== null) {
                $boardAnchor = '<a href="' . Request::getHomePath()
                        . '/play?id=' . $this->get('boardId') . '" />Started from board: '
                        . htmlEscape($this->boardName) . '</a>';
            } else {
                $boardAnchor = '';
            }

            return <<<html
  <div class="boardViewer">
    $name
    $parent
    $message
    $continue
    $copy$boardAnchor
  </div>;
html;

        } else return parent::__toString();
    }
}