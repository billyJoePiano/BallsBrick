<?php
require_once('../db/obscure.php');
obscure(__FILE__);

$user = UserToken::authenticate();
$type = Draft::getDraftTypeCode();

if ($type === null) DraftUpdate::kill(StatusFlags::DRAFT_ID_FAILED
        & ($user ? 0 : StatusFlags::AUTHENTICATION_FAILED));


if ($type === Draft::COPY_BOARD
        && $_GET[Draft::BOARD] . '' ===
        ($boardId = intval($_GET[Draft::BOARD]) . '')) {
    //COPY BOARD INTO A NEW DRAFT

    require_once('Board.php');
    $board = Board::fetchBoardId($boardId);
    if (!$board) {
        DraftUpdate::kill(StatusFlags::DRAFT_ID_FAILED
                & ($user ? 0 : StatusFlags::AUTHENTICATION_FAILED));
    }

    if ($user && $user->getUserId() === $board->get('userId')) {
        $idField = 'boardId';
        $idVal = $boardId;

    } else if ($user && $board->get('public')) {
        $idField = 'userId';
        $idVal = $user->getUserId();

    } else {
        DraftUpdate::kill(StatusFlags::AUTHENTICATION_FAILED);
    }


    Request::writeOrApplyCurrentToDB();
    $requestId = Request::getCurrent()->get('id');

    $copyJSON = new DBVjsonCopyFrom("SELECT board FROM board WHERE id=$boardId");
    $draftId = Draft::fetchTable()->insert(array(
            'created' => DBVtimestampNow::get(),
            'name' => $board->get('name'),
            'draft' => $copyJSON,
            $idField => $idVal,
            'requestId' => $requestId
    ));


    $updateId = DraftUpdate::fetchTable()->insert(array(
            'time' => DBVtimestampNow::get(),
            'draftId' => null,
            'requestId' => null,
            'statusFlags' => new StatusFlags(StatusFlags::COPIED & StatusFlags::NEW_REQUEST_ID)
    ));

    UpdateRequest::fetchTable()->insert(array(
            'updateId'=>$updateId,
            'requestId'=>$requestId,
            'actualDraftId' => $draftId
    ));


    die ('{"request":' . $requestId . ',"draft":' . $draftId
            . ',"board":' . $board->get('board') . '}');



} else if ($type === Draft::BLANK_DRAFT) {
    //CREATE A BLANK DRAFT

    if (!$user) DraftUpdate::kill(StatusFlags::AUTHENTICATION_FAILED);

    Request::writeOrApplyCurrentToDB();
    $updateRequestId = Request::getCurrent()->get('id');
    $draftId = null;

    $actualDraftId = Draft::fetchTable()->insert(array(
            'created' => DBVtimestampNow::get(),
            'draft' => Draft::BLANK_DRAFT_JSON,
            'userId' => $user->getUserId(),
            'requestId' => $updateRequestId,
    ));

    $draft = Draft::fetchDraftId($actualDraftId);
    if ($draft === null) throw new DBerror();

    $statusFlags = new StatusFlags(StatusFlags::NEW_REQUEST_ID & StatusFlags::COPIED);


} else {
    // READ, COPY, CONTINUE ON, OR RECLAIM AN ESTABLISHED DRAFT

    $draftId = intval($_GET[Draft::DRAFT_CODES[$type]]);

    if ($draftId . '' !== $_GET[Draft::DRAFT_CODES[$type]] . '')
        DraftUpdate::kill(StatusFlags::DRAFT_ID_FAILED
            & ($user ? 0 : StatusFlags::AUTHENTICATION_FAILED));


    $draft = Draft::fetchDraftId($draftId);

    if ($draft === null) DraftUpdate::kill(StatusFlags::DRAFT_ID_FAILED
            & ($user ? 0 : StatusFlags::AUTHENTICATION_FAILED));

    $userId = $draft->get('userId');
    $boardId = $draft->get('boardId');


    if ($userId !== null) {
        if ($user && $user->getUserId() === $user->get('id')) {
            $draftIdField = 'userId';
            $draftIdVal = $userId;
        } else {
            DraftUpdate::kill(StatusFlags::AUTHENTICATION_FAILED);
        }


    } else if ($boardId !== null) {
        require_once('Board.php');
        $board = Board::fetchBoardId($boardId);

        if ($user && $user->getUserId() === $board->get('userId')) {
            $draftIdField = 'boardId';
            $draftIdVal = $boardId;
        } else {
            DraftUpdate::kill(StatusFlags::AUTHENTICATION_FAILED);
        }

    } else throw new DBerror();


    Request::writeOrApplyCurrentToDB();
    $updateRequestId = Request::getCurrent()->get('id');

    if ($type === Draft::READ_ONLY) {
        die($draft->get('draft'));


    } else if ($type === Draft::COPY_DRAFT
            || ($draft->get('requestId') !== null
                    && $type !== Draft::RECLAIM_DRAFT)) {

        // MAKE A COPY OF THE DRAFT
        //could do some additional userAgent/copy-history checking here, like in POST section... no time though

        $actualDraftId = Draft::fetchTable()->insert(array(
                'created' => DBVtimestampNow::get(),
                'name' => $draft->get('name'),
                'draft' => $draft->get('draft'), //use DBVcopyJson here?  maybe not, in case of concurrent access, race conditions?
                'boardId' => $draft->get('boardId'),
                'userId' => $draft->get('userId'),
                'requestId' => $updateRequestId
        ));
        $statusFlags = new StatusFlags(StatusFlags::NEW_REQUEST_ID & StatusFlags::COPIED);

    } else {
        $draft->set('requestId', $updateRequestId);
        $draft->set('clientCheck', DBVtimestampNow::get());

        $actualDraftId = $draftId;
        $statusFlags = new StatusFlags(StatusFlags::NEW_REQUEST_ID);
    }
}

$updateId = DraftUpdate::fetchTable()->insert(array(
        'time' => DBVtimestampNow::get(),
        'draftId' => $draftId,
        'requestId' => null,
        'statusFlags' => $statusFlags
    ));

UpdateRequest::fetchTable()->insert(array(
        'updateId' => $updateId,
        'requestId' => $updateRequestId,
        'actualDraftId' => $actualDraftId
    ));

die ('{"request":' . $updateRequestId . ',"draft":' . $actualDraftId
        . ',"board":' . $draft->get('draft') . '}');
?>