<?php
require_once('../db/user.php');

UserToken::authenticate();
//echo $_SERVER['HTTP_USER_AGENT'];
//outputvar(get_browser(null, true));

?>

<style>
    div {
        padding: 0.5em;
    }
    label, button, span.header {
        display: block;
    }

    pre {
        padding: 0.5em;
        border: 1px solid black;
    }

    iframe {
        width: 100%;
        padding: 0;
        margin: 1em 0;
        height: 600px;
    }

    pre > button {
        margin-top: 1em;
    }

    pre table {
        white-space: break-spaces;
    }
</style>
<script src="../js/xhr.test.js" defer></script>

<form id="form">
    <div>
        <label for="draft">draftId</label>
        <input type="number" name="draft" id="draft" />
        <input type="checkbox" id="draftInclude" />
    </div>
    <div>
        <label for="request">requestId</label>
        <input type="number" name="request" id="request" />
        <input type="checkbox" id="requestInclude" />
    </div>

    <div>
        <label for="board">Board JSON</label>
        <textarea name="board" id="board"></textarea>
        <input type="checkbox" id="boardInclude" />
    </div>
    <div>
        <input type="hidden" value="" name="finalize" />
        <label for="finalizeInclude">Finalize</label>
        <input type="checkbox" id="finalizeInclude" id="finalize"/>
    </div>

    <button id="submit">Submit</button>

</form>

