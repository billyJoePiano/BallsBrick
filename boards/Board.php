<?php
require_once(__DIR__ . '/../db/obscure.php');
obscure(__FILE__);

require_once(__DIR__ . '/../db/DBR.php');

try {
    Header::$scripts[] = 'initialize';
    Header::$stylesheets[] = '/stylesheets/board.css';

} catch (Error $noHeader) { }

class Board extends DBR {
    use QuickTable;
    const TABLE = 'board';
    const JSON_PATH = '/boards';

    public static function fetchBoardId(int $id) : ?Board {
        try {
            return new static($id);

        } catch (NonexistentRecord $e) {
            return null;
        }
    }


    //the below assume that user.php is require_once 'd
    static function generatePreloadLink(int $id) : string {
        $path = Request::getActualPath(static::JSON_PATH);
        return <<<html
        <link rel="preload" href="$path?id=$id" as="fetch" type="application/json" crossorigin="anonymous" />
html;
    }

    static function generateCanvasWithLink(int $id, string $name) : string {
        $name = '<input type="hidden" value="' . htmlEscape($name) . '" id="'
                . $id . '" />';
        $link = static::generatePreloadLink($id);
        return <<<html
    <canvas class="board" width="500" height="750" class="board">$link $name</canvas>
html;

    }

    public function __toString() : string {
        return static::generateCanvasWithLink($this->get('id'), $this->get('name'));
    }

    static function generateNavButtons(bool $loggedIn) : string {
        if ($loggedIn) {
            return <<<html
    <div class="editor nav">
        <button onclick="navMyBoards()">My Boards</button>
        <button onclick="navMyDrafts()">My Drafts</button>
        <button onclick="navHomePage()">Homepage</button>   
        <button onclick="navBlog()">Blog</button>
        <button onclick="navLogout()">Log out</button> 
    </div>
html;

        } else {
            return <<<html
    <div class="editor nav">
        <button onclick="navHomePage()">Homepage</button>
        <button onclick="navBlog()">Blog</button>
        <button onclick="navLogin()">Login</button>
        <button onclick="navSignup()">Signup</button>
    </div>
html;
        }
    }
}

?>