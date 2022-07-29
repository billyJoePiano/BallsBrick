<?php
require_once('../db/obscure.php');
obscure(__FILE__);

$user = UserToken::authenticate();

ignore_user_abort(true);
// ^^^ TO DO -- configure this with a small DB table that will handle multi-threaded situations / race conditions


$statusFlags = StatusFlags::createDynamic();
$returnVal = array();

// validate draft id
$draftId = null;
$draft = null;
if (!(key_exists('draft', $_POST)
        && ($_POST['draft'] . '' === ($draftId = intval($_POST['draft'])) . '')
        && ($draft = Draft::fetchDraftId($draftId)))) {

    $statusFlags->setDraftIdFailed(true);
}


// validate authentication
if ($user === null) {
    $userId = null;
    $statusFlags->setAuthenticationFailed(true);

} else {
    $userId = $user->getUserId();
}

if ($draft === null) {
    $draftUserId = null;
    $draftBoardId = null;

} else if (($draftBoardId = $draft->get('boardId')) !== null) {
    require_once('Board.php');
    $draftUserId = Board::fetchBoardId($draftBoardId)->get('userId');

    if ($draftUserId !== $userId) {
        $statusFlags->setAuthenticationFailed(true);
    }

} else if (($draftUserId = $draft->get('userId')) !== null) {
    if ($draftUserId !== $userId) {
        $statusFlags->setAuthenticationFailed(true);
    }

} else throw new DBerror();

// validate request id


$requestToLink = Request::getCurrent();; //default when new request id is flagged
// this is changed to an established request under some circumstances, see line 264

if (key_exists('request', $_POST)
        && ($_POST['request'] . '' === ($requestId = intval($_POST['request'])) . '')) {

    $request = Request::fetchRequestId($requestId);
    if ($devicesMatch = DraftUpdate::compareRequests($request)) {
        //stackTrace();
        // still at the same ip address, session, and token... no need to log full request
        Request::$logCurrent = false;
        if ($statusFlags->getAuthenticationFailed()) throw new DBerror();

    } else if (!$statusFlags->getAuthenticationFailed()) {
        //stackTrace();
        $statusFlags->setNewRequestId(true);
        // ip address, session, or token has changed...
        // this flag determines more action at the end
    }



    if ($draft) $establishedRequestId = $draft->get('requestId');
    else $establishedRequestId = false;

    if ($requestId === $establishedRequestId) {
        if ($request === null) throw new DBerror();
        //do nothing... we are validated!!


    } else if ($request && (    ($draft === null && $draftId !== null)
                    || $establishedRequestId === null // ?? maybe not ??
                    || $requestId < $establishedRequestId  )
            && DraftUpdate::verifyDraftRequestHistory($draftId, $requestId)) {
        // VALIDATE ^^ with the earliest historical DraftUpdate with this RequestId
        // to make sure it corresponds to the draftId
        //stackTrace();


        if ($statusFlags->getAuthenticationFailed()) {
            //stackTrace();
            // do nothing.  This is not a requestId failure, but we will
            // not change requestId or copy the draft

        } else if ($establishedRequestId === null) {
            //stackTrace();
            $statusFlags->setNewRequestId(true);
            //use the current request and draft, but instruct userAgent to
            //change request id

        } else if ($devicesMatch && $establishedRequestId !== false) {
            //stackTrace();
            $statusFlags->setNewRequestId(true);
            $requestToLink = Request::fetchRequestId($establishedRequestId);

        } else {

            //stackTrace();
            $statusFlags->setNewRequestId(true);

            $tempDr = null;

            foreach(UpdateRequest::findCopyDrafts($draftId, $requestId) as $copy) {
                $tempDr = $copy->getDraft();
                $tempRq = $copy->getRequest();

                if ($tempDr) {
                    if (!($tempDr->get('boardId') === $draftBoardId ||
                            $tempDr->get('userId') === $draftUserId)) {
                        throw new DBerror('Logic error making copies of drafts... boardId/userId, or security flags');
                    }

                } else continue;



                if (DraftUpdate::compareRequests($tempRq)) {
                    $draft = $tempDr; //?? maybe do this no matter what?
                    break;

                } else $tempDr = null;
            }



            //proxy for DraftUpdate::compareRequests
            if ($tempDr) {
                //stackTrace();
                $draft = $tempDr;

                Request::$logCurrent = false;
                $requestToLink = $tempRq;

                $returnVal['draft'] = $draft->get('id');
                //resendBoard ??


            } else {
                //stackTrace();
                Request::$logCurrent = true;
                $statusFlags->setCopiedDraft(true);
            }
        }

        if ($statusFlags->getCopiedDraft()) {
            //stackTrace();
            //copy the draft
            $statusFlags->setNewRequestId(true);
            $returnVal['resendBoard'] = true;


            //copy draft code adapted from 'GET' section above
            Request::$logCurrent = true;
            Request::writeOrApplyCurrentToDB();

            //resend board return flag marked when json status flag evaluated

            if ($draft) {
                $copyValues = array(
                        'created' => DBVtimestampNow::get(),
                        'clientCheck' => DBVtimestampNow::get(),
                        'draft' => $draft->get('draft'),
                    // ^^ possibly the same as client's, but could be different
                        'boardId' => $draft->get('boardId'),
                        'userId' => $draft->get('userId'),
                        'requestId' => Request::getCurrent()->get('id')
                );
            } else {
                $copyValues = array(
                        'created' => DBVtimestampNow::get(),
                        'clientCheck' => DBVtimestampNow::get(),
                        'draft' => '{}', //client will need to send json back
                        'boardId' => null,
                        'userId' => $user->getUserId(),
                        'requestId' => Request::getCurrent()->get('id')
                );
            }

            $newDraftId = Draft::fetchTable()->insert($copyValues);
            $draft = Draft::fetchDraftId($newDraftId);

            if ($draft->get('id') !== $newDraftId) throw new DBerror();

            $returnVal['draft'] = $newDraftId;

        }

    } else {
        $statusFlags->setNewRequestId(false);
        $statusFlags->setRequestIdFailed(true);
    }


} else {
    $requestId = null;
    $request = null;
    $statusFlags->setRequestIdFailed(true);
}



if ($statusFlags->isSecure()) {
    $returnVal['connected'] = true;

    $draft->set('clientCheck', DBVtimestampNow::get());

    if (key_exists('board', $_POST)) {
        $statusFlags->setJSONincluded(true);
        try {
            $draft->set('draft', $_POST['board']);
            $draft->applyUpdates();
            $returnVal['valid'] = true;

        } catch (UpdateError $e) {
            //invalid JSON
            $statusFlags->setJSONinvalid(true);
            $draft->cancelUpdate();
            $draft->set('clientCheck', DBVtimestampNow::get());
            $returnVal['valid'] = false;
        }

    } else if ($statusFlags->getCopiedDraft()) {
        $returnVal['resendBoard'] = true;
    }

    if (key_exists('finalize', $_POST)) {
        $statusFlags->setFinalized(true);
        if ($statusFlags->getJSONincluded() && $statusFlags->getJSONinvalid()) {
            $returnVal['resendBoard'] = true;
            if (!$statusFlags->getCopiedDraft()) {
                $statusFlags->setNewRequestId(false); //needs to stay true if just copied
            }

        } else if ($statusFlags->getCopiedDraft() && !$statusFlags->getJSONincluded()) {
            $returnVal['resendBoard'] = true;

        } else {
            $draft->set('requestId', null);
            $returnVal['goodbye'] = true;
            if (!$statusFlags->getCopiedDraft()) {
                $statusFlags->setNewRequestId(false); //needs to stay true if just copied
            }
        }
    }

} else {
    $returnVal['connected'] = false;
}

$draftUpdate = DraftUpdate::fetchTable();

if (($request === null && $requestId !== null)
        || ($draft === null && $draftId !== null)) {

    //note, in the first case, it is *possible* the requestId is valid,
    //but probably not worth checking... easier to just disable FK checks
    $draftUpdate->setCheckForeignKey(false);
}

$updateId = $draftUpdate->insert(array(
        'time' => DBVtimestampNow::get(),
        'draftId' => $draftId,
        'requestId' => $requestId,
        'statusFlags' => $statusFlags
));

if ($draft && $draftId !== $draft->get('id')) $actualDraftId = $draft->get('id');
else $actualDraftId = null;


if(!$statusFlags->isSecure()) {
    //Authentication, Request Id, and Draft Id failures -- security-related
    // ALWAYS write the full request and link to the draft update record
    Request::$logCurrent = true;
    Request::writeOrApplyCurrentToDB();

    UpdateRequest::fetchTable()->insert(array(
            'updateId' => $updateId,
            'requestId' => Request::getCurrent()->get('id'),
            'actualDraftId' => $actualDraftId
    ));

} else if (Request::$logCurrent || $statusFlags->getNewRequestId() || $actualDraftId !== null) {

    if ($requestToLink === Request::getCurrent()) {
        Request::$logCurrent = true;
        Request::writeOrApplyCurrentToDB();
    }

    $requestToLinkId = $requestToLink->get('id');
    UpdateRequest::fetchTable()->insert(array(
            'updateId' => $updateId,
            'requestId' => $requestToLinkId,
            'actualDraftId' => $actualDraftId
    ));

    if ($statusFlags->getNewRequestId()) {
        //need to assign a new requestId to this draft session
        if ($draft === null || !$statusFlags->isSecure()) throw new DBerror();
        $draft->set('requestId', $requestToLinkId);
        $returnVal['request'] = $requestToLinkId;
    }

}

ignore_user_abort(false);
//TO DO ^^^ configure for multi-threaded

echo json_encode($returnVal);

?>
