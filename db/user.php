<?php
require_once('obscure.php');
obscure(__FILE__);

require_once('DButil.php');
require_once('DBJR.php');
require_once('HTMLform.php');

class LoginFailed extends FieldValidationError {
    const MESSAGE = 'Login failed.  Invalid Username or Password';
}

class UserNameTaken extends FieldValidationError {
    const MESSAGE = 'Sorry, the username $ is already taken!';
    public function __construct($username) {
        $message = str_replace ('$', $username, static::MESSAGE);
        parent::__construct($message);
    }
}

class InvalidPassword extends FieldValidationError  {
    const MESSAGE = 'Password does not meet password policies';
}

class PasswordConfirmationFailed extends FieldValidationError {
    const MESSAGE = 'Password confirmation did not match';
}


class User extends DBR {
    use QuickTable;
    const TABLE = 'user';
    const USERNAME = 'username';
    const PASSWORD = 'password';
    const ID = 'id';
    const PASSWORD_MIN_LEN = 8;

    private static ?FieldValidationError $passwordErr = null;
    private static array $idIndex = array();
    private static array $usernameIndex = array();

    private function indexUser(User $user) : User {
        static::$idIndex[$user->get(static::ID)] = $user;
        static::$usernameIndex[$user->get(static::USERNAME)] = $user;
        return $user;
    }

    public static function fetchUsername(string $username, ?DBC &$dbc = null) : User {
        if (key_exists($username, static::$usernameIndex)) {
            return static::$usernameIndex[$username];
        }
        return static::indexUser(new static(array(static::USERNAME => $username), $dbc));

    }

    public static function fetchUserId(int $id, ?DBC &$dbc = null) : User {
        if (key_exists($id, static::$idIndex)) {
            return static::$idIndex[$id];
        }
        return static::indexUser(new static(array(static::ID => $id), $dbc));
    }

    public static function createInstanceFromValues(array $values, ?DBC &$dbc = null) : User {
        if (!key_exists(static::ID, $values)) throw new DBerror();

        if (!key_exists($values[static::ID], static::$idIndex)) {
            return static::indexUser(parent::createInstanceFromValues($values, $dbc));
        }

        $return = static::$idIndex[$values[static::ID]];
        if (!$return->validateAgainstDBvalues($values, true)) throw new DBerror();
        return $return;
    }

    public function __toString() : string {
        $descriptors = $this->getFieldDescriptors();
        $string = '<table class="userProfile"><tbody>';
        foreach ($this as $field => $value) {
            if ($field === static::PASSWORD) continue;
            $string .= '<tr><td>' . htmlEscape($descriptors[$field]['label'])
                    . '</td><td>' . htmlEscape($value) . '</td></tr>';
        }
        return $string . '</tbody></table>';
    }

    public static function signup(?DBC &$dbc = null) {
        $form = new HTMLform(static::fetchTable($dbc));
        $passwordLabel = $form->getInput(static::PASSWORD)->label;
        $form->setInput(static::PASSWORD,
                new PasswordConfirm(static::PASSWORD, $passwordLabel));

        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            static::confirmPassword(); //checks the confirmation field


            $newUserKey = $form->validateAndInsert(null, $dbc);

            if ($newUserKey !== null) {
                return UserToken::generateNew(new User($newUserKey, $dbc), $dbc);
            }
        }

        return $form;
    }

    public static function confirmPassword() {
        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            if (key_exists(static::PASSWORD, $_POST)
                    && key_exists(static::PASSWORD . 'Confirm', $_POST)
                    && $_POST[static::PASSWORD] === $_POST[static::PASSWORD . 'Confirm']) {

                unset($_POST[static::PASSWORD . 'Confirm']);

            } else {
                static:: $passwordErr = new PasswordConfirmationFailed();
                //this will be thrown when trying to insert or update
            }
        }
    }


    // returns either an HTMLform or a UserToken
    public static function login(?DBC &$dbc = null) {
        if ($_SERVER['REQUEST_METHOD'] === 'POST'
                && key_exists(static::USERNAME, $_POST)
                && key_exists(static::PASSWORD, $_POST)) {

            $user = null;
            try {
                $user = static::fetchUsername($_POST[static::USERNAME]);

            } catch (NonexistentRecord $e) { }

            if ($user && $user->authenticate($_POST[static::PASSWORD]))
                return UserToken::generateNew($user);

            static::$passwordErr = new LoginFailed();
            $form = new HTMLform(static::fetchTable($dbc));
            $form->getInput(static::USERNAME)->setDefaultValue($_POST[static::USERNAME]);

        } else {
            $form = new HTMLform(static::fetchTable($dbc));
        }

        if (key_exists('expired', $_GET)) {
            $form->addInformational(new Informational(
                    'Sorry, it seems you were either logged out, or there was a '
                    . 'technical issue with your login session. Sometimes this happens '
                    . 'when your web browser has just installed an application update. '
                    . 'Please login again.'));

        }


        foreach($form as $field => $input) {
            if ($field === static::PASSWORD) {
                $passwordInput = new PasswordInput($field, $input->label);
                $passwordInput->error = static::$passwordErr;
                $form->setInput($field, $passwordInput);

            } else if ($field !== static::USERNAME) {
                $form->setInput($field, null);
            }
        }

        return $form;
    }

    public function authenticate(string $password) : bool {
        return password_verify($password, $this->get(static::PASSWORD));
    }

    public function getUsername() : string {
        return $this->get(static::USERNAME);
    }

    // Can be overridden for password minimum complexity requirements.
    // Returns whether the password meets minimum requirements, and causes
    // validateUpdate to throw an InvalidPassword error if false.
    // Overridden function could also throw the error itself with a specific
    // message.
    public static function generalPasswordPolicy(string $password, bool $newUser = false) : bool {
        if (strlen($password) < static::PASSWORD_MIN_LEN)
            throw new InvalidPassword('Password must be at least '
                    . static::PASSWORD_MIN_LEN . ' characters long');

        return true;
    }

    // User-instance specific password policy
    // (e.g. cannot be the same password as the previous 3 passwords)
    public function userPasswordPolicy(string $password) : bool {
        return static::generalPasswordPolicy($password);
    }


    public static function validateInsert(string $field, $value, array $valuesArray) {
        if ($field === static::PASSWORD) {
            if (static::$passwordErr) throw static::$passwordErr;
            static::generalPasswordPolicy($value, true);

            return password_hash($value, PASSWORD_DEFAULT);

        } else if ($field === static::USERNAME) {
            try {
                new User(array(static::USERNAME => $value));
                throw new UserNameTaken($value);

            } catch (NonexistentRecord $e) {
                return $value;
            }


        } else if (gettype($value) === 'string') {
            $value = trim($value);
            if ($value === '') $value = null;
        }

        return $value;
    }
}

class Token extends DBR {
    use QuickTable;
    const TABLE = 'token';
}

class UserAgent extends DBR {
    use QuickTable;
    const TABLE = 'userAgent';
    const FIELD_ATTRIBUTES = array(
            'majorVersion' => array('phpType' => 'integer'),
            'minorVersion' => array('phpType' => 'integer')
        );

    const BROWSER_FIELDS = array(
            //translates the return from get_browser to the db field names
            // dbField => get_browserField
            'browser' => 'browser',
            'platform' => 'platform',
            'maker' => 'browser_maker',
            'majorVersion' => 'majorver',
            'minorVersion' => 'minorver',
            'deviceType' => 'device_type',
            'pointingMethod' => 'device_pointing_method',
            'isMobile' => 'ismobiledevice',
            'isTablet' => 'istablet',
            'isCrawler' => 'crawler'
        );


    public function __construct($lookup = null, ?DBC &$dbc = null, bool $alreadyQueried = false) {
        if ($alreadyQueried) {
            $string = false;

        } else if ($lookup === null) {
            $lookup = array('userAgent' => $_SERVER['HTTP_USER_AGENT']);
            $string = true;

        } else if (gettype($lookup) === 'string') {
            $lookup = array('userAgent' => $lookup);
            $string = true;

        } else {
            $string = false;
        }

        try {
            return parent::__construct($lookup, $dbc, $alreadyQueried);

        } catch (NonexistentRecord $e) {
            if ($string === false) throw $e;
        }

        $id = $this->getTable($dbc)->insert($lookup);
        parent::__construct($id);
        if ($this->get('userAgent') !== $lookup['userAgent']) throw new DBerror();

        try {
            $browser = get_browser($this->get('userAgent'), true);
        } catch (Exception $e) {
            return;
        }
        $values = array();
        foreach (static::BROWSER_FIELDS as $dbField => $brField) {
            $values[$dbField] = $browser[$brField];
        }
        $this->update($values);
    }
}

class UserToken extends DBJR {
    const COOKIE = DBC::DATABASE . '_token';
    const COOKIE_ID = UserToken::COOKIE . 'Id';
    const LOGIN = '/login'; //  '/' means relative to home directory
    const LOGIN_LANDING = '/blog/viewProfile'; //default landing after login
    const LOGOUT_LANDING = '/';

    public static function fetchTable(?DBC &$dbc = null): DBJ {
        return static::getDBJ(array(
                User::fetchTable($dbc),
                Token::fetchTable($dbc),
                UserAgent::fetchTable($dbc)
            ));
    }

    private static ?UserToken $currentAuthenticated = null;
    public static function getCurrentAuthenticated() : ?UserToken {
        return static::$currentAuthenticated;
    }

    public function getUsername() : string {
        return $this->get(0)->getUsername();
    }

    public function getDisplayName() : ?string {
        return $this->get(0)->get('name');
    }

    public function getUserId() : int {
        return $this->get(0)->get('id');
    }

    public function getUserAgent() : string {
        return $this->get(2)->get('userAgent');
    }

    public function getExpired() : ?DBVtimestamp {
        return $this->get(1)->get('expired');
    }

    public function setExpired(?DBC &$dbc = null) {
        if ($this->get(1)->get('expired') === null) {
            $this->get(1)->set('expired', DBVtimestampNow::get());
            $this->get(1)->applyUpdates($dbc);
        }
    }

    public function getTokenHash() : string {
        return $this->get(1)->get('token');
    }

    public function getTokenId() : int {
        return $this->get(1)->get('id');
    }

    protected function setCookie() {
        setcookie(static::COOKIE,
                $this->getTokenHash(),
                time() + 2592000,
                Request::getHomePath() . '/'
            );
    }

    protected static function clearCookie() {
        setcookie(static::COOKIE, '', 0, Request::getHomePath() . '/');
    }

    public static function generateNew(User $user, ?DBC &$dbc = null) : UserToken {
        $tokenHash = time() . $user->getUsername() . $_SERVER['REMOTE_ADDR']
                . $_SERVER['HTTP_USER_AGENT'] . rand(100000, 999999);
        $tokenHash = password_hash($tokenHash, PASSWORD_DEFAULT);

        $userAgent = new UserAgent(null, $dbc);

        $key = Token::fetchTable($dbc)->insert(array(
                'user' => $user->get('id'),
                'token' => $tokenHash,
                'created' => DBVtimestampNow::get(),
                'userAgent' => $userAgent->get('id')
            ));

        $userToken = new static(array(
                0 => $user,
                'token' => array('id' => $key),
                2 => $userAgent
            ), $dbc);

        $userToken->setCookie();
        $_SESSION[static::COOKIE_ID] = $userToken->getTokenId();
        static::$currentAuthenticated = $userToken;
        Request::getCurrent()->set('sessionToken', $userToken->getTokenId());

        static::redirectFromLogin();
    }


    // $redirect = true redirect TO login on failure
    // $redirect = false redirect FROM login on success
    // $redirect = null, do nothing except authenticate
    public static function authenticate(?bool $redirect = null, ?DBC &$dbc = null) : ?UserToken {
        $dbc = $dbc ?? DBC::get();

        $sessionToken = null;
        $cookieToken = null;

        $badToken = false;

        if (key_exists(static::COOKIE_ID, $_SESSION)) {
            $tokenId = intval($_SESSION[static::COOKIE_ID]);
            if ($tokenId . '' !== $_SESSION[static::COOKIE_ID] . '') throw new DBerror();
            $sessionToken = new static(array(
                    'token' => array(
                            'id' => $tokenId
                        )
                    ), $dbc);

            if ($_SERVER['HTTP_USER_AGENT'] !== $sessionToken->getUserAgent()) {
                $badToken = true;
                $actualUserAgent = new UserAgent(null, $dbc);
                Request::getCurrent()->set('userAgent', $actualUserAgent->get('id'));
            }

            if ($sessionToken->getExpired() !== null) $badToken = true;
        }

        if (key_exists(static::COOKIE, $_COOKIE) && $_COOKIE[static::COOKIE] !== '') {
            if ($sessionToken) {
                if ($sessionToken->getTokenHash() === $_COOKIE[static::COOKIE]) $cookieToken = true;
                else $badToken = true;
            }

            if (!$cookieToken) {
                try {
                    $cookieToken = new static(array(
                            'token' => array(
                                    'token' => $_COOKIE[static::COOKIE]
                                )
                            ), $dbc);

                    if ($_SERVER['HTTP_USER_AGENT'] !== $cookieToken->getUserAgent()) {
                        $badToken = true;
                        if (!isset($actualUserAgent)) {
                            $actualUserAgent = new UserAgent(null, $dbc);
                            Request::getCurrent()->set('userAgent', $actualUserAgent->get('id'));
                        }
                    }

                    if ($cookieToken->getExpired() !== null) $badToken = true;

                } catch(NonexistentRecord $e) {
                    $badToken = true;
                }
            }
        }

        if ($sessionToken) {
            Request::getCurrent()->set('sessionToken', $sessionToken->getTokenId());
        }

        if ($cookieToken instanceof UserToken) {
            Request::getCurrent()->set('cookieToken', $cookieToken->getTokenId());

        } else if ($cookieToken === true) {
            Request::getCurrent()->set('cookieToken', $sessionToken->getTokenId());
            //indicates there was a matching cookie token present
        }


        if ($badToken) {
            //echo 'BAD TOKEN';
            if ($sessionToken) $sessionToken->setExpired($dbc);
            if ($cookieToken instanceof UserToken) $cookieToken->setExpired($dbc);

            unset($_SESSION[static::COOKIE_ID]);
            static::clearCookie();

            //session_destroy();
            //session_write_close();

            if ($redirect === true) static::redirectToLogin(true);
            else return null;
        }

        $goodToken = null;

        if ($sessionToken) $goodToken = $sessionToken;
        else if ($cookieToken instanceof UserToken) $goodToken = $cookieToken;

        if ($goodToken) {
            //put a time check in here?  for tokens that haven't been accessed in a certain time period???

            $goodToken->setCookie();
            $_SESSION[static::COOKIE_ID] = $goodToken->getTokenId();
            static::$currentAuthenticated = $goodToken;

            //session_write_close();

            if ($redirect === false) static::redirectFromLogin();
            else return $goodToken;
        }

        //session_write_close();

        //echo 'NO TOKEN';

        if ($redirect === true) static::redirectToLogin(false);
        else return null;
    }

    public static function redirectToLogin(bool $expiredToken = false) {
        $url = Request::getActualPath(static::LOGIN)
                . ($expiredToken ? '?expired&page=' : '?page=')
                . urlencode(basename($_SERVER['REQUEST_URI']));

        header('Location: ' .  $url);

        global $title;
        $title = 'Redirecting to Login';

        $url = htmlEscape($url);

        try {
            Header::outputIfNotAlready();
        } catch (Error $noHeader) { }

        die('<h1><a href="' . $url . '">Redirecting to login page...</a></h1>');
    }

    public static function redirectFromLogin() {
        if (key_exists('page', $_GET)) {
            $url = basename($_GET['page']);

            if (!file_exists(parse_url($url)['path'])) {
                // MAJOR SECURITY RED-FLAG!!!!  SHOULD PROBABLY LOG THIS
                $url = Request::getActualPath(static::LOGIN_LANDING);
            }
        } else $url = Request::getActualPath(static::LOGIN_LANDING);

        header('Location: ' .  $url);

        $url = htmlEscape($url);

        global $title;
        $title = 'Logged In ... Redirecting';

        try {
            Header::outputIfNotAlready();
        } catch (Error $user_dot_PhpNotIncluded) { }

        die('<h1><a href="' . $url . '">Redirecting ...</a></h1>');
    }

    public function logout(bool $redirect = true, ?DBC &$dbc = null) {
        $token = $this->get(1);
        $token->set('expired', DBVtimestampNow::get());
        $token->applyUpdates($dbc);

        static::clearCookie();
        $_SESSION[static::COOKIE_ID] = '';
        unset ($_SESSION[static::COOKIE_ID]);

        if (UserToken::$currentAuthenticated !== $this) throw new DBerror();
        UserToken::$currentAuthenticated = null;

        if ($redirect) static::redirectFromLogout();
    }

    public static function redirectFromLogout() {
        if (!(key_exists('page', $_GET)
                && file_exists(parse_url($url = basename($_GET['page']))['path']))) {
                // LATTER CASE IS MAJOR SECURITY RED-FLAG!!!!  SHOULD PROBABLY LOG THIS
                $url = Request::getActualPath(static::LOGOUT_LANDING);
        }

        header('Location: ' .  $url);

        $url = htmlEscape($url);

        global $title;
        $title = 'Logged Out ... Redirecting';

        try {
            Header::outputIfNotAlready();

        } catch(Error $e) { }

        die('<h1><a href="' . $url . '">Redirecting ...</a></h1>');
    }
}

class Session extends DBR {
    use QuickTable;
    const TABLE = 'session';

    private static ?Session $current = null;

    public function getCurrent(?DBC &$dbc = null) : Session {
        return Session::$current ?? (Session::$current = new static(null, $dbc));
    }

    private function __construct(?array $values = null, ?DBC &$dbc = null) {
        //stackTrace("\nCONSTRUCTING SESSION<br />\n");
        if ($values !== null) return parent::__construct($values, $dbc, true);

        session_start();
        $arr = array('phpSessId' => session_id());

        try {
            parent::__construct($arr, $dbc);

        } catch (NonexistentRecord $e) {
            $id = $this->getTable($dbc)->insert($arr);
            parent::__construct($id);
        }
    }

    public function __destruct() {
        session_write_close();
        //parent::__destruct();
    }

    public function getSessionId(int $id, ?DBC &$dbc = null) : ?Session {
        try {
            return new static($id, $dbc);

        } catch (NonexistentRecord $e) {
            return null;
        }
    }

    public static function createInstanceFromValues(array $values, ?DBC &$dbc = null) : DBT {
        $current = Session::getCurrent();
        if ($current->validateAgainstDBvalues($values)) return $current;

        stackTrace('UNEXPECTED SESSION INSTANCE, NOT CURRENT SESSION');
        return new static($dbc, $values);
    }
}

class Request extends DBR {
    use QuickTable;
    const TABLE = 'request';
    const HOME_DIR = '';
    const SELECT_FIELDS = array('*',
            "CONCAT('0x', hex(ipv4)) as ipv4",
            "CONCAT('0x', hex(ipv6network)) as ipv6network",
            "CONCAT('0x', hex(ipv6host)) as ipv6host"
        );
    const FIELD_ATTRIBUTES = array (
            'ipv4' => array (
                    'phpType' => 'object',
                    'DBVclass' => 'DBVipv4'),
            'ipv6network' => array (
                    'phpType' => 'object',
                    'DBVclass' => 'IPv6Half'),
            'ipv6host' => array (
                    'phpType' => 'object',
                    'DBVclass' => 'IPv6Half'),
            'dbConnections' => array (
                    'phpType' => 'object',
                    'DBVclass' => 'DBint'),
        );

    public static bool $logCurrent = true;
    public static bool $overrideLogCurrentForDBCcount = true;

    private static ?Request $current = null;

    public static function getCurrent(?DBC &$dbc = null) : Request {
        if (Request::$current) return Request::$current;

        $ip = IP::fromString($_SERVER['REMOTE_ADDR']);
        $uri = $_SERVER['REQUEST_URI'];
        $homeDir = Request::getHomePath();

        if (substr($uri, 0, strlen($homeDir)) === $homeDir) {
            $uri = '~' . substr($uri, strlen($homeDir));
        }

        $arr = array(
                'id' => -1,
                'time' => DBVtimestampNow::get(),
                'uri' => $uri,
                'session' => Session::getCurrent($dbc)->get('id'),
                'sessionToken' => null,
                'cookieToken' => null,
                'userAgent' => null,
                'ipv4' => $ip['ipv4'],
                'ipv6network' => $ip['ipv6network'],
                'ipv6host' => $ip['ipv6host'],
                'port' => intval($_SERVER['REMOTE_PORT']),
                'method' => $_SERVER['REQUEST_METHOD'],
                'dbConnections' => new CurrentDBconnectionsCount('current', true)
            );

        Request::$current = new static($arr, $dbc, true);
        Request::$current->currentWritten = false;
        return Request::$current;
    }

    public static function fetchRequestId(int $id, ?DBC &$dbc = null) : ?Request {
        try {
            return new static($id, $dbc);

        } catch (NonexistentRecord $e) {
            return null;
        }
    }


    private ?bool $currentWritten = null;
        // null = NOT current Request
        // false = current request, but not yet written
        // true = current request and written to DB
    private static string $writtenDBCs;

    public function __destruct() {
        if ($this->currentWritten !== null) {
            $this->writeToDB();
        } else {
            parent::__destruct();
        }
    }

    public static function writeOrApplyCurrentToDB(?DBC &$dbc = null) {
        static::$current->writeToDB($dbc);
    }

    private function writeToDB(?DBC &$dbc = null) {
        if ($this->currentWritten === null) throw new DBerror();

        if ($this->currentWritten === true) {
            if (static::$writtenDBCs !== $this->get('dbConnections')->toSQLstring()) {
                if (!$this->hasUpdatePending()) {
                    $this->set('dbConnections', new CurrentDBconnectionsCount('current', true));
                    if (!$this->hasUpdatePending()) throw new DBerror();
                    // compel DBR to think the value has changed, with a new instance
                }
                $this->applyUpdates($dbc);
            }

        } else if (static::$logCurrent
                    || (static::$overrideLogCurrentForDBCcount
                            && DBC::getCount() > 1              )           ) {

            $this->currentWritten = true;
            session_write_close();
            if ($this->get('sessionToken') === null
                    && $this->get('cookieToken') === null
                    && $this->get('userAgent') === null) {
                $this->set('userAgent', (new UserAgent(null, $dbc))->get('id'));
            }
            $id = $this->getTable($dbc)->insert($this->getFieldValues(), $dbc);
            $this->overridePrimaryKey(array('id' => $id));

        } else return;

        static::$writtenDBCs = static::$current->get('dbConnections')->toSQLstring();
    }

    /* path formatting functions */
    private static ?int $pathDiff = null; //difference between PHP_SELF and SCRIPT_NAME paths
    private static ?string $homePath = null;

    private static function calcPathDiff() : int {
        Request::constructHomePath();
        return Request::$pathDiff;
    }

    //finds the home directory of the current application based on HOME_DIR constant
    private static function constructHomePath() {
        $selfDir = explode('/', $_SERVER['DOCUMENT_URI']);
        //$selfDir = explode('/', $_SERVER['PHP_SELF']);
        $scriptDir = explode('/', $_SERVER['SCRIPT_NAME']);
        Request::$pathDiff = count($selfDir) - count($scriptDir);
        if ($scriptDir[0] !== ''
                || $selfDir[0]   !== ''
                || Request::$pathDiff < 0) {
            //echo Request::$pathDiff . "\n";
            //outputVar($_SERVER);
            throw new DBerror();
        }
            



        $homePath = '';
        $homeLevel = array_search(static::HOME_DIR, $scriptDir);
        for ($i = 1; $i <= $homeLevel; $i++) {
            if ($selfDir[$i] !== $scriptDir[$i] || $selfDir[$i] === '') throw new DBerror();
            $homePath .= '/' . $selfDir[$i];
        }

        return $homePath;
    }

    // accounts for browser relative-path behavior when there are directories listed after the filename in its url
    public static function getActualPath(string $path) : string {

        Request::$homePath ??= static::getHomePath();
        if (substr($path, 0, 1) === '/') return Request::$homePath . $path;
        else return str_repeat('../', Request::$pathDiff) . $path;

    }

    public static function getHomePath() {
        return Request::$homePath ??= static::constructHomePath();
    }

    //difference in directory levels between the path of the script running and what the browser requested
    public static function getPathDifference() : int {
        return Request::$pathDiff ??= static::calcPathDiff();
    }
}

DBC::startSession();
Request::getCurrent();