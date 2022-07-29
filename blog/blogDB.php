<?php
require_once(__DIR__ . '/../db/obscure.php');
obscure(__FILE__);

require_once(__DIR__ . '/../db/user.php');
require_once(__DIR__ . '/../template.php');

Header::$stylesheets[] = '/stylesheets/blogreader.css';

// NOTE: quillInput.php is not being included because it adds extra JS scripts to the webpage
// while blog classes only need it when being edited.  You must be sure to require_once quillInput.php
// AFTER require_once on this page, in blog pages where an editor is desired or there will be
// exceptions and no editor!!


class Post extends DBR {
    use QuickTable;
    const TABLE = 'post';
    const FIELD_ATTRIBUTES = array(
            'moderate' => array('label' => 'Moderate comments before publishing them')
        );

    private ?int $commentCount = null;
    private ?bool $published = null;
    public ?string $topNote = null; // error or success message from comment subsmission form

    protected function __construct($key, ?DBC &$dbc = null, $alreadyQueried = false) {
        if ($alreadyQueried && key_exists('commentCount', $key)) {
            $this->commentCount = intval($key['commentCount']);
            if ($this->commentCount < 0 || $this->commentCount . '' !== $key['commentCount'] . '')
                throw new DBerror();
            unset($key['commentCount']);
        }
        parent::__construct($key, $dbc, $alreadyQueried);
    }


    public function getCommentCount(?DBC &$dbc = null) : int {
        if ($this->commentCount !== null) return $this->commentCount;

        $dbc = $dbc ?? DBC::get();
        $query = 'SELECT COUNT(*) FROM ' . Comment::TABLE . ' WHERE accepted = true AND '
                . Comment::fetchTable($dbc)->writeWhereClause(array(
                        'postId' => $this->get('id')
                    ));

        $result = $dbc->query($query);
        if (!$result) throw new QueryError($query);
        if ($result->num_rows !== 1) throw new DBerror($query);
        $row = $result->fetch_array(MYSQLI_NUM);
        $this->commentCount = intval($row[0]);
        if ($this->commentCount . '' !== $row[0] . '') throw new DBerror();
        return $this->commentCount;
    }


    //checks that the date isn't in the future
    public function isPublished() : bool {
        if ($this->published !== null) return $this->published;
        $this->published = $this->get('date')->getDatetime()
                                ->diff(DBVtimestampNow::get()->getDatetime())
                                ->invert === 0;
        return $this->published;
    }

}

class Comment extends DBR {
    use QuickTable;
    const TABLE = 'comment';
}

trait UserHyperlink {
    public function getHyperlink(): string {
        $user = $this->get(1);
        $name = $user->get('name');
        $username = '<i>' . htmlEscape($user->getUsername()) . '</i>';
        if ($name === null || $name === '') {
            $name = $username;
            $username = '';
        } else {
            $name = htmlEscape($name);
            $username = " ($username)";
        }
        $id = $user->get('id');
        return <<<html
<a href="viewProfile.php?id=$id" class="userLink"><b>$name</b>$username</a>
html;


    }
}

class PostUser extends DBJR {
    use UserHyperlink;

    const UNAUTHORIZED_EDIT = <<<html
<div class="error">
<h1>ERROR</h1>
<p>Sorry, this post does not exist or you do not have permission to edit it</p>
</div>
html;

    public static function fetchTable(?DBC &$dbc = null): DBJ {
        return static::getDBJ(array(
                Post::fetchTable($dbc),
                User::fetchTable($dbc)
            ));
    }

    public static function fetchPostId(int $id, ?DBC &$dbc = null) : ?PostUser {
        try {
            return new static(array('post' => array('id' => $id)), $dbc);

        } catch (NonexistentRecord $e) {
            return null;
        }
    }

    public static function fetchRecent(int $number,
                                       ?string $whereCondition = null,
                                       bool $onlyShowPublished = true, // doesn't show forward-dated
                                       ?DBC &$dbc = null) : array {

        $table = static::fetchTable($dbc);
        $select = $table->writeSelectClause($dbc);
        $select .= ', `counter`.`count` as `0.commentCount`';
        $join = $table->getEscapedTableName(true);
        $join .= ' LEFT OUTER JOIN (SELECT COUNT(*) as `count`, postId FROM comment'
                . ' WHERE accepted = true GROUP BY postId)'
                . '  as `counter` on `post`.`id` = `counter`.`postId`';


        if ($whereCondition) {
            if ($onlyShowPublished)
                $whereCondition = " WHERE `post`.`date` <= NOW() AND ($whereCondition)";
            else
                $whereCondition = " WHERE $whereCondition";
        } else {
            if ($onlyShowPublished)
                $whereCondition = " WHERE `post`.`date` <= NOW()";
            else
                $whereCondition = '';
        }

        if ($number > 0) $limit = " LIMIT $number";
        else $limit = '';

        $query = "SELECT $select FROM $join$whereCondition ORDER BY `post`.`date` DESC$limit";
        $dbc = $dbc ?? DBC::get();
        if (!($result = $dbc->query($query))) throw new QueryError($query);

        $arr = array();
        while ($row = $result->fetch_array(MYSQLI_ASSOC)) {
            if ($row['0.commentCount'] === null) $row['0.commentCount'] = 0;
            $arr[] = new static($row, $dbc, true);
        }

        return $arr;
    }

    public function __toString() : string {
        return $this->writeString();
    }

    public function preview() : string {
        return $this->writeString(true);
    }

    private function writeString(bool $preview = false) : string {
        $post = $this->get(0);

        $title = $post->get('title');
        if ($title) $title = '<h1>' . htmlEscape($title) . '</h1>';
        else $title = '<div class="error">(no title)</div>';

        if ($preview) {
            $id = $this->getPostId();
            $commentCount = $this->get(0)->getCommentCount();
            $preview = ' preview';

            $title = <<<html
<a href="view.php?id=$id">$title</a>
html;
            $footer = <<<html
<div class="commentCount">$commentCount comments</div>
html;


        } else {
            if ($topNote = $this->get(0)->topNote)
                $title = $topNote . $title;
            $footer = '';
            $preview = '';
        }

        $userToken = UserToken::getCurrentAuthenticated();
        if ($userToken && $userToken->get(User::TABLE) === $this->get(User::TABLE)) {
            $title = '<a href="editPost.php?id=' . $this->getPostId()
                    . '" class="edit-post">Edit this post</a>' . $title;
        }

        $body = $post->get('body');
        $date = $post->get('date');
        $user = $this->getHyperlink();

        return <<<html
<div class="post">
  $title
  <h3 class="postUser">by $user</h3>
  <h3 class="postDate">$date</h3>
  <div class="postBody blog-reader$preview">$body</div>$footer
</div>
html;

    }


    protected static function getEditor(bool $postId, ?DBC &$dbc = null) : htmlForm {
        $form = new htmlForm(Post::fetchTable($dbc));
        $form->setInput('userId', null);
        $form->setInput('body', new QuillInput('body', ''));
        $form->setButton(1, null);
        if ($postId) $form->setInput('id', new HiddenInput('id', ''));
        return $form;
    }


    //returns either a form (no post), or an array with the form and an instance (post)
    public static function edit(?DBC &$dbc = null) {
        $token = UserToken::getCurrentAuthenticated();

        $form = static::getEditor(true, $dbc);

        $postInstance = $form->fetchInstance();

        if ($postInstance) {
            $instance = new static(array(
                    'post' => $postInstance,
                ), $dbc);
            $valid = $token !== null
                    && $token->get(User::TABLE) === $instance->get(User::TABLE);
        } else {
            $valid = false;
        }

        switch ($_SERVER['REQUEST_METHOD'] . ($valid ? '1' : '0')) {
            case 'GET1':
                $form->setValuesFromInstance($postInstance);
                return $form;

            case 'POST1':
                //unset($_POST['submit']);
                return $form->validateAndUpdate($postInstance, $_POST, $dbc)
                        ? $instance : $form;

            case 'GET0':
                return static::UNAUTHORIZED_EDIT;

            case 'POST0':
                $form->addInformational(new Informational(static::UNAUTHORIZED_EDIT));
                $form->setValuesFromArray($_POST);
                return $form;

            default:
                throw new DBerror('Request method ' . $_SERVER['REQUEST_METHOD']
                        . ' not setup yet.');
        }
    }

    public static function create(?DBC &$dbc = null) {
        $userToken = UserToken::getCurrentAuthenticated();
        if ($userToken === null) throw new DBerror();

        $form = static::getEditor(false, $dbc);

        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            $postWithUserId = $_POST;
            $postWithUserId['userId'] = $userToken->getUserId();
            $key = $form->validateAndInsert($postWithUserId, $dbc);
            if ($key !== null) return $key;
        }

        return $form;
    }

    public function getPostId() {
        return $this->get(0)->get('id');
    }

    public function isPublished() : bool {
        return $this->get(0)->isPublished();
    }
}

class CommentUser extends DBJR {
    use UserHyperlink;
    public static function fetchTable(?DBC &$dbc = null): DBJ {
        return static::getDBJ(array(
                Comment::fetchTable($dbc),
                User::fetchTable($dbc)
            ));
    }

    public function __toString() : string {
        $comment = $this->get(0);
        $title = $comment->get('title');
        if ($title) $title = '<h2>' . htmlEscape($title) . '</h2>';
        else $title = '';

        $body = htmlEscape($comment->get('body'));
        $date = $comment->get('date');
        $user = $this->getHyperlink();

        return <<<html
<div class="comment">
  $title
  <div class="commentBody blog-reader">$body</div>
  <div class="commentDate">$date</div>
  <div class="commentUser">$user</div>
</div>
html;

    }

    public function isAccepted() : bool {
        return $this->get(0)->get('accepted') === true;
    }

    public function needsModeration() : bool {
        return $this->get(0)->get('accepted') === null;
    }

    public function isRejected() : bool {
        return $this->get(0)->get('accepted') === false;
    }


}

class PostComments extends DBJR {
    private ?CommentUser $newComment = null;

    protected static array $referencesToUse = array(
            'post' => array(
                    'user' => false
                )
        );

    public static function fetchTable(?DBC &$dbc = null): DBJ {
        return static::getDBJ(array(
                Post::fetchTable($dbc),
                array(CommentUser::fetchTable($dbc))
            ));
    }

    public static function fetchForPost(Post $post) : PostComments {
        return new static(array($post));
    }

    public function __toString() : string {
        $output = '<hr />';
        $comments = $this->get(1);
        if ($this->newComment) $comments[] = $this->newComment;

        foreach($comments as $comment) {
            if ($comment->isAccepted())
                $output .= $comment;
        }
        return $output;
    }

    public function getPostId() : int {
        return $this->get(0)->get('id');
    }

    public function comment(PostUser $postUser, ?DBC &$dbc = null) : HTMLform {
        $userToken = UserToken::getCurrentAuthenticated();
        $postId = $this->getPostId();
        $form = new HTMLform(Comment::fetchTable($dbc));
        $form->formTitle = 'Post a comment';

        if (!$userToken) {
            $form->clearInputs();
            $form->clearButtons();
            $form->action = '';
            $form->method = '';
            $info = <<<html
<a href="login.php?page=$postId">Login</a> or
<a href="signup.php?page=$postId">Signup</a> to post a comment
html;
            $form->addInformational(new Informational($info));
            return $form;
        }

        $form->action .= '?id=' . $postId;
        $form->setInput('body', new TextArea('body', 'Comment'));
        $form->setInput('userId', null);
        $form->setInput('postId', null);
        $form->setInput('date', null);
        $form->setInput('accepted', null);

        $moderate = $this->getModerate();
        if ($postUser->get(User::TABLE) === $userToken->get(User::TABLE)) {
            // if the commenter is also the post author, no moderation messages are displayed
            $moderate = null;
        }


        if ($moderate) $form->addInformational(new Informational(
                'All comments are moderated by the author of this blog post before they are published'));

        else if ($moderate === false) $form->addInformational(new Informational(
                'Comments are automatically published, but may be removed by the author of this blog post.'));

        switch ($_SERVER['REQUEST_METHOD']) {
            case 'GET':
                return $form;

            case 'POST':
                $values = $_POST;
                $values['postId'] = $postId;
                $values['userId'] = $userToken->getUserId();

                if (!$moderate) {
                    $values['accepted'] = true;
                }
                $values['date'] = DBVtimestampNow::get();
                $key = $form->validateAndInsert($values, $dbc);
                $post = $this->get(0);

                if ($form->hadSubmissionError()) {
                    if ($key !== null) throw new DBerror();
                    $post->topNote = '<div class="topNote error">There was an error posting your comment</div>';
                    return $form;


                } else if ($key === null) {
                    throw new DBerror();

                }

                $newComment = Comment::fetchInstanceFromLookupKey($key, $dbc);
                /** @noinspection PhpFieldAssignmentTypeMismatchInspection */
                $this->newComment = CommentUser::createInstanceFromValues(array(
                        'comment' => $newComment,
                        'user' => $userToken->get(User::TABLE)
                    ));

                if ($moderate) {
                    $post->topNote = '<div class="topNote success">Your comment was submitted for moderation</div>';

                } else {
                    $post->topNote = '<div class="topNote success">Your comment was successfully posted</div>';
                }


                return $form;

            default:
                throw new DBerror('Request method ' . $_SERVER['REQUEST_METHOD']
                        . ' not setup yet.');
        }
    }


    public function getModerate() : bool {
        return $this->get(0)->get('moderate');
    }
}

?>
