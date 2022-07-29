<?php
require_once('../db/obscure.php');
obscure(__FILE__);

require_once('../db/DBR.php');
require_once('Board.php');


class Draft extends DBR {
    use QuickTable;
    const TABLE = 'draft';

    const READ_ONLY = -1;
    const BLANK_DRAFT = 0;
    const CONTINUE_DRAFT = 1; //for 'finalized' drafts (i.e. save confirmed)
    const RECLAIM_DRAFT = 2; // for abandoned drafts
    const COPY_DRAFT = 3;
    const COPY_BOARD = 4;

    const READ = 'read';
    const NEW = 'new';
    const CONTINUE = 'continue';
    const RECLAIM = 'reclaim';
    const DRAFT = 'draft';
    const BOARD = 'board';

    const DRAFT_PATH = '/boards/drafts.php';
    const BLANK_DRAFT_JSON = '{"__class":"BoardTemplate","__constructorArgs":[[]]}';

    const DRAFT_CODES = array(
            self::READ_ONLY => self::READ,
            self::BLANK_DRAFT => self::NEW,
            self::CONTINUE_DRAFT => self::CONTINUE,
            self::RECLAIM_DRAFT => self::RECLAIM,
            self::COPY_DRAFT => self::DRAFT,
            self::COPY_BOARD => self::BOARD
        );

    public static function fetchDraftId(int $id) : ?Draft {
        try {
            return new static($id);
        } catch (NonexistentRecord $e) {
            return null;
        }
    }

    public static function fetchByRequestId(int $id) : ?Draft {
        try {
            return new static(array('requestId' => $id));
        } catch (NonexistentRecord $e) {
            return null;
        }
    }


    //the below assume that user.php is require_once 'd
    static function generatePreloadLink(int $id, int $type) : string {
        if (!key_exists($type, self::DRAFT_CODES)) throw new DBerror('invalid type: ' . $type);


        $query = self::DRAFT_CODES[$type];
        $path = Request::getActualPath(self::DRAFT_PATH);
        return <<<html
        <link rel="preload" href="$path?$query=$id" as="fetch" type="application/json" crossorigin="anonymous" />
html;
    }

    static function generateCanvasWithLink(int $id, int $type, ?string $name = null) : string {
        $link = self::generatePreloadLink($id, $type);
        $name ??= '';
        $name = '<input type="hidden" value="' . htmlEscape($name) . '" id="'
                . $id . '" />';
        return <<<html
    <canvas class="board" width="500" height="750" class="board">$link $name</canvas>
html;

    }

    // array defaults to $_GET super-global
    public static function getDraftTypeCode(?array $array = null) : ?int {
        $array ??= $_GET;

        $type = null;
        foreach (Draft::DRAFT_CODES as $code => $query) {
            if (key_exists($query, $array)) return $code;
        }
        return null;
    }

    public function __toString() : string {
        return static::generateCanvasWithLink($this->get('id'), static::READ_ONLY, $this->get('name'));
    }
}

?>