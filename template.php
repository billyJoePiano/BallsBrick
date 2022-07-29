<?php
require_once('db/obscure.php');
obscure(__FILE__);

try {
    require_once('links.php');
    //links.php is a declaration of constants which the Header class uses to
    // construct the navigation links

} catch (Error $e) {
    require_once('../links.php');
    //allows for different header links based on what part of the site you're on
}


require_once(__DIR__ . '/db/user.php');

class Header {
    public static bool $closeDbcSessionOnOutput = true;

    public static string $head = '';
    public static array $stylesheets = array(
            '/stylesheets/main.css',
        );

    public static array $scripts = array();

    public static function output(string $title = '', ?bool $closeDbcSession = null) {
        if (Header::$done !== false) throw new Exception();
        Header::$done = true;

        $userToken = UserToken::getCurrentAuthenticated();

        $closeDbcSession ??= static::$closeDbcSessionOnOutput;
        if ($closeDbcSession) DBC::closeSession();

        $title = htmlEscape(trim($title));

        ?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title><?= $title ?></title>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
<?php
        foreach (Header::$stylesheets as $stylesheet) {
            $stylesheet = htmlEscape(Request::getActualPath($stylesheet)) . '?' . rand(100000, 999999);
            echo '<link rel="stylesheet" type="text/css" href="' . $stylesheet
                    . '">' . "\n";
        }
        foreach (Header::$scripts as $scriptName) {
            $scriptPath = "/js/$scriptName.js";
            $scriptPath = htmlEscape(Request::getActualPath($scriptPath)) . '?' . rand(100000, 999999);
            echo '<script src="' . $scriptPath . '"></script>' . "\n";
        }
        echo static::$head;
?>
</head>
<body>
<header>
    <!-- header stuff here -->
    <div><h3>Welcome to Bill's Balls 'N Bricks Game</h3>
<?php
        if ($title) {
            echo "<h2>$title</h2>";
        }
        echo '</div><nav>';

        foreach(array_merge(NAV_LINKS_GENERAL,
                        isset($userToken) ? NAV_LINKS_LOGGED_IN : NAV_LINKS_LOGGED_OUT)
                    as $filename => $linkText) {
            if($filename === '/logout') {
                $logoutAction = true;
                $basename = basename($_SERVER['SCRIPT_NAME']);
                if (key_exists($basename, REDIRECT_ON_LOGOUT)) {
                    $logoutAction = REDIRECT_ON_LOGOUT[$basename];
                }

                if (gettype($logoutAction) === 'string') {
                    if (substr($logoutAction, -1, 1) === '?') //add current query string
                        $logoutAction .= parse_url($_SERVER['REQUEST_URI'], PHP_URL_QUERY);

                    $filename .= '?page=' . urlencode($logoutAction);

                } else if ($logoutAction === true) {
                    $filename .= '?page=' . urlencode(basename($_SERVER['REQUEST_URI']));

                } else if ($logoutAction !== false)  throw new DBerror();
            }

            $filename = Request::getActualPath($filename);

        ?>
            <a href="<?= $filename ?>">
            <?= $linkText ?>
            </a><?php
        } ?>
        </nav>
        <?php

        if ($userToken) {  ?>
            <span id="loggedInNotification"><span>You are logged in as:</span>
            <?php
            if($name = $userToken->getDisplayName()) {  ?>
                <span class="displayname"><?= $name ?></span>
                <?php
            }               ?>
            <span class="username">
                <?= htmlEscape($userToken->getUsername()); ?>
            </span>
            </span><?php
        }
    ?>
</header>
<main>
    <hr />
        <?php
    }

    private static bool $done = false;
    public static function wasOutputed() : bool {
        return Header::$done;
    }

    public static function outputIfNotAlready(?bool $closeDbcSession = null) {
        if (!Header::$done) {
            if (basename($_SERVER['SCRIPT_NAME']) === 'index.php') {
                $title = pathinfo($_SERVER['SCRIPT_NAME'], PATHINFO_DIRNAME);
                $title = substr($title, strrpos($title, '/') + 1);


            } else {
                $title = pathinfo($_SERVER['SCRIPT_NAME'], PATHINFO_FILENAME);
            }

            $title[0] = strtoupper($title[0]);

            static::output($title, $closeDbcSession);
        }
    }

    private function __construct() {
        throw new Exception();
        // no instances allowed
    }
}

class Footer {
    //automatically outputs the Footer upon exiting the document, via the instance's destructor
    public function __destruct() {
        Header::outputIfNotAlready(false);

        Footer::$done = true;
        ?>
</main>
<footer>
    <hr />
    Website made by Bill Anderson, Spring 2021 Intro to PHP class
    <br />
    (PHP Web Development with MySQL, Tue/Thur 12:30pm - 2:10pm)
</footer>
        <?php
    }


    private static ?Footer $instance = null;
    private static bool $done = false;

    public static function output() {
        if (Footer::$done === true || Footer::$instance === null) throw new Exception();
        $instance = null; //calls the destruct method
    }

    private function __construct() {
        if (Footer::$instance !== null || Footer::$done !== false)
            throw new Exception();
    }

    public static function arm() {
        if (Footer::$instance) throw new DBerror();
        Footer::$instance = new Footer();
    }
}


//initialize...
(function() {
    Footer::arm();


    $stylesheet = 'stylesheets/' . pathinfo($_SERVER['PHP_SELF'], PATHINFO_FILENAME)
            . '.css';
    if (file_exists($stylesheet)) {
        Header::$stylesheets[] = $stylesheet;
    }
})();

?>