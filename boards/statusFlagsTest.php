<style>
    span {
        display: inline-block;
        padding: 0.25em;
        background: #DDD;
        border: 1px solid #999;
    }

    span.error {
        border: 2px solid darkred;
        color: darkred;
        background-color: pink;
    }

    span.warning {
        background-color: lightgoldenrodyellow;
    }

</style>

<?php
require_once('DraftUpdate.php');

require_once('DraftUpdateRequest.php');

$anyFailure = false;

for($i = 0; $i < 256 /*($_GET['num'] ?? 1)*/; $i++) {

    $jsonIncluded= (bool)($i & 1);
    $finalized= (bool)($i & 2);
    $newRequestId= (bool)($i & 4);
    $copiedDraft= (bool)($i & 8);
    $jsonInvalid= (bool)($i & 16);
    $requestIdFailed= (bool)($i & 32);
    $draftIdFailed= (bool)($i & 64);
    $authenticationFailed= (bool)($i & 128);

    $test0 = StatusFlags::createStatusFlags( //control
            $jsonIncluded, //= (bool)random_int(0, 1),
            $finalized, //= (bool)random_int(0, 1),
            $newRequestId, //= (bool)random_int(0, 1),
            $copiedDraft, //= (bool)random_int(0, 1),
            $jsonInvalid, //= (bool)random_int(0, 1),
            $requestIdFailed, //= (bool)random_int(0, 1),
            $draftIdFailed, //= (bool)random_int(0, 1),
            $authenticationFailed //= (bool)random_int(0, 1),
    );

    $test1 = StatusFlags::createDynamic();
    $test1->setJSONincluded($jsonIncluded);
    $test1->setNewRequestId($newRequestId);
    $test1->setFinalized($finalized);
    $test1->setJSONinvalid($jsonInvalid);
    $test1->setAuthenticationFailed($authenticationFailed);
    $test1->setRequestIdFailed($requestIdFailed);
    $test1->setDraftIdFailed($draftIdFailed);
    $test1->setCopiedDraft($copiedDraft);
    
    $test2 = StatusFlags::createDynamic(255); //start with all flags true
    $test2->setJSONincluded($jsonIncluded);
    $test2->setNewRequestId($newRequestId);
    $test2->setFinalized($finalized);
    $test2->setJSONinvalid($jsonInvalid);
    $test2->setAuthenticationFailed($authenticationFailed);
    $test2->setRequestIdFailed($requestIdFailed);
    $test2->setDraftIdFailed($draftIdFailed);
    $test2->setCopiedDraft($copiedDraft);

    $test3 = StatusFlags::createDynamic();
    if ($jsonIncluded) $test3->setJSONincluded($jsonIncluded);
    if ($newRequestId) $test3->setNewRequestId($newRequestId);
    if ($finalized) $test3->setFinalized($finalized);
    if ($jsonInvalid) $test3->setJSONinvalid($jsonInvalid);
    if ($authenticationFailed) $test3->setAuthenticationFailed($authenticationFailed);
    if ($requestIdFailed) $test3->setRequestIdFailed($requestIdFailed);
    if ($draftIdFailed) $test3->setDraftIdFailed($draftIdFailed);
    if ($copiedDraft) $test3->setCopiedDraft($copiedDraft);

    $test4 = StatusFlags::createDynamic(255);  //start with all flags true
    if (!$jsonIncluded) $test4->setJSONincluded($jsonIncluded);
    if (!$newRequestId) $test4->setNewRequestId($newRequestId);
    if (!$finalized) $test4->setFinalized($finalized);
    if (!$jsonInvalid) $test4->setJSONinvalid($jsonInvalid);
    if (!$authenticationFailed) $test4->setAuthenticationFailed($authenticationFailed);
    if (!$requestIdFailed) $test4->setRequestIdFailed($requestIdFailed);
    if (!$draftIdFailed) $test4->setDraftIdFailed($draftIdFailed);
    if (!$copiedDraft) $test4->setCopiedDraft($copiedDraft);

    foreach (array($test0, $test1, $test2, $test3, $test4) as $test) {
        $success = true;
        if ($jsonIncluded !== $test->getJSONincluded()) $success = false;
        if ($newRequestId !== $test->getNewRequestId()) $success = false;
        if ($finalized !== $test->getFinalized()) $success = false;
        if ($jsonInvalid !== $test->getJSONinvalid()) $success = false;
        if ($authenticationFailed !== $test->getAuthenticationFailed()) $success = false;
        if ($requestIdFailed !== $test->getRequestIdFailed()) $success = false;
        if ($draftIdFailed !== $test->getDraftIdFailed()) $success = false;
        if ($copiedDraft !== $test->getCopiedDraft()) $success = false;

        echo $success ? 'SUCCESSFUL<br />' : '<span class="error">FAILED</span>';
        echo $test . '<br />';

        if (!$success) $anyFailure = true;
    }

}

if ($anyFailure) echo '<h1><span class="error">THERE WAS A FAILURE</span></h1>';
else echo '<h1><span>NO FAILURES</span></h1>';

?>
