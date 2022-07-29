<?php
require_once('../db/obscure.php');
obscure(__FILE__);

require_once('Draft.php'); //includes DBV via DBT


class UpdateRequest extends DBR {
    use QuickTable;
    const TABLE = 'updateRequest';

    private Request $request;
    private DraftUpdate $update;
    private ?Draft $draft;

    /*
    private function __construct($values, ?DBC &$dbc = null,
                                   bool $alreadyQueried = false) {

        parent::__construct($values, $dbc, $alreadyQueried);
    }
    */


    public function getRequest() : Request {
        return $this->request;
    }

    public function getUpdate() : DraftUpdate {
        return $this->update;
    }

    public function getDraft() : ?Draft {
        return $this->draft;
    }


    // NOTE: caller needs to require_once for Draft.php if calling this function

    // searches draftUpdates and updateRequest to find a current
    // branch of the client's draftId & requestId.  Returns null if none found
    // otherwise constructs a Draft object with the result
    public static function findCopyDrafts(int $draftId, int $requestId,
                                         ?DBC &$dbc = null) : Traversable {

        $bitmask = StatusFlags::COPIED + StatusFlags::NEW_REQUEST_ID; //bit mask for copy operations
        $securityCutoff = StatusFlags::SECURITY_CUTOFF;

        $query = <<<sql
SELECT ur.* FROM draftUpdate du
    JOIN updateRequest ur ON ur.updateId = du.id 
    WHERE statusFlags & $bitmask = $bitmask
        AND du.statusFlags < $securityCutoff
        AND du.draftId = $draftId
        AND du.requestId = $requestId
        AND ur.actualDraftId IS NOT NULL
        AND ur.requestId != du.requestId
    ORDER BY id DESC
sql;

        //echo $query;

        $dbc ??= DBC::get();
        $result = $dbc->query($query);
        if (!$result) throw new QueryError($query);

        return (function(mysqli_result $result) {
            while($value = $result->fetch_array(MYSQLI_ASSOC)) {
                $value = new static ($value, $dbc, true);
                $value->request = Request::fetchRequestId($value->get('requestId'));
                $value->update = DraftUpdate::fetchId($value->get('updateId'));
                $value->draft = Draft::fetchDraftId($value->get('actualDraftId'))
                        ?? Draft::fetchByRequestId($value->get('requestId'));

                if (!($value->request && $value->update)) throw new DBerror();


                $update = $value->getUpdate();
                $request = $value->getRequest();

                if (!($update->get('time')->equalTo($request->get('time')))) {
                    throw new DBerror('time stamps did not match for update and request');
                }

                yield $value;
            }
        })($result);

    }
}


class DraftUpdate extends DBR {
    use QuickTable;
    const TABLE = 'draftUpdate';

    const FIELD_ATTRIBUTES = array(
            'statusFlags' => array(
                    'phpType' => 'object',
                    'DBVclass' => 'StatusFlags'
                )
        );
    const REQUEST_FIELDS_TO_COMPARE = array(
            //true/false indicates object vs scalar
            'session' => false,
            'sessionToken' => false,
            'cookieToken' => false,
            'userAgent' => false,
            'ipv4' => true,
            'ipv6network' => true,
            'ipv6host' => true,
        );

    // note: user.php required for this function... caller must require_once, as this file does not
    public static function compareRequests(?Request $origin) : bool {
        if ($origin === null) return false;

        $current = Request::getCurrent();
        if ($current === null) return false;

        foreach (static::REQUEST_FIELDS_TO_COMPARE as $field => $isObject) {
            $o = $origin->get($field);
            $c = $current->get($field);
            if ($isObject) {
                if ($o !== null) $o = $o->toSQLstring();
                if ($c !== null) $c = $c->toSQLstring();
            }
            if ($o !== $c) return false;
        }
        return true;
    }

    public static function fetchId(int $id, ?DBC &$dbc = null) : ?DraftUpdate {
        try {
            return new static($id, $dbc);

        } catch (NonexistentRecord $e) {
            return null;
        }
    }

    public function __construct($primaryKey, ?DBC &$dbc = null, bool $alreadyQueried = false) {
        parent::__construct($primaryKey, $dbc, $alreadyQueried);
    }

    // no authentication, draft, or request failures
    public function wasSecure() : bool {
        return $this->get('statusFlags')->isSecure();
    }

    // ensures that a missing/deleted draft or expired draftId/requestId are legit
    // by finding the records for it
    public static function verifyDraftRequestHistory(int $draftId,
                                                     int $requestId,
                                                     ?DBC &$dbc = null) : bool {
        //stackTrace();
        $securityCutoff = StatusFlags::SECURITY_CUTOFF;
        $bitmask = StatusFlags::NEW_REQUEST_ID;
        $query = <<<sql
SELECT draftUpdate.*, updateRequest.actualDraftId FROM draftUpdate
JOIN updateRequest ON updateRequest.updateId = draftUpdate.id
JOIN request ON updateRequest.requestId = request.id
WHERE draftUpdate.statusFlags < $securityCutoff
    AND draftUpdate.statusFlags & $bitmask = $bitmask
    AND (draftUpdate.requestId = $requestId
             OR (request.method = 'GET'
                 AND request.id = $requestId))
    AND request.time = draftUpdate.time
ORDER BY time
sql;
        //Note: SQL could also include a condition for at least one of Session/Cookie tokens
        // being not null.
        // However, draftUpdate's statusFlags (security cutoff) should take care of that
        // plus, there is program check below

        //echo $query;

        $dbc ??= DBC::get();
        $result = $dbc->query($query);
        if (!$result) throw new QueryError($query);

        if ($result->num_rows < 1) return false;
        /*
        if ($result->num_rows > 1) throw new DBerror('Should not have more than one update record return '
                . 'because of timestamp comparison');
        */
        $row = $result->fetch_array(MYSQLI_ASSOC);
        $actualDraftId = $row['actualDraftId'];
        unset($row['actualDraftId']);

        $oldUpdate = new DraftUpdate($row, $dbc, true);

        if (!$oldUpdate->wasSecure()) throw new DBerror('status flags logic error');
        $request = Request::fetchRequestId($requestId);
        if ($request->get('sessionToken') === null && $request->get('cookieToken') === null)
            throw new Error('Logic error in setting status flags... request does not have authentication tokens!');
                        // ...probably has to do with index.php logic ???


        return ($oldUpdate->get('draftId') ?? intval($actualDraftId)) === $draftId;
    }

    public static function kill(?int $statusFlags = null,
                                bool $joinToCurrentRequest = true,
                                ?int $draftId = null,
                                ?int $requestId = null,
                                ?int $updateRequestId = null,
                                ?int $actualDraftId = null) {

        $statusFlags = new StatusFlags($statusFlags ?? 0);
        $table = static::fetchTable();
        $table->setCheckForeignKey(false);
        $id = $table->insert(array(
                'time' => DBVtimestampNow::get(),
                'draftId' => $draftId,
                'requestId' => $requestId,
                'statusFlags' => $statusFlags
            ));

        if ($joinToCurrentRequest) {
            if ($updateRequestId !== null)
                throw new DBerror();

            Request::writeOrApplyCurrentToDB();
            $updateRequestId = Request::getCurrent()->get('id');
            UpdateRequest::fetchTable()->insert(array(
                    'updateId' => $id,
                    'requestId' => $updateRequestId,
                    'actualDraftId' => $actualDraftId
                ));


        } if ($updateRequestId !== null) {
            UpdateRequest::fetchTable()->insert(array(
                    'updateId' => $id,
                    'requestId' => $updateRequestId,
                    'actualDraftId' => $actualDraftId
                ));

        } else if ($actualDraftId !== null) throw new DBerror();


        die('{}');
    }

}

class StatusFlags extends DBV {
    private int $value = 0;
    private bool $dynamic = false;

    //bit masks  TO DO -- apply these to the functions, rather than number literals
    const AUTHENTICATION_FAILED = 128;
    const DRAFT_ID_FAILED = 64;
    const REQUEST_ID_FAILED = 32;
    const JSON_INVALID = 16;
    const COPIED = 8;
    const NEW_REQUEST_ID = 4;
    const FINALIZED = 2;
    const JSON = 1;

    const SECURITY_CUTOFF = StatusFlags::REQUEST_ID_FAILED;


    public function __construct(?string $value, bool $fromHTMLinput = false) {
        $intval = intval($value);
        if ($intval . '' !== $value || $intval < 0 || $intval > 255) throw new DBerror();
        $this->value = $intval;
    }

    public function getValue() : int {
        return $this->value;
    }

    public function isSecure() : bool {
        return $this->value < static::SECURITY_CUTOFF;
    }

    public function toHTMLoutput() : string {
        if ($this->value === 0) return '<span>Check-in</span>';
        $str = '';
        //most severe to most mild
        if ($this->value & 128) $str .= '<span class="error">Authentication Failed</span> ';
        if ($this->value & 64) $str .= '<span class="error">Draft Id Failed</span> ';
        if ($this->value & 32) $str .= '<span class="error" title="no id or id was *newer* than established">Request Id Failed</span> ';
        if ($this->value & 16) $str .= '<span class="error">JSON Invalid</span> ';
        if ($this->value & 8) $str .= '<span class="warning" title="for older session hijacked by a newer session">Copied draft</span> ';
        if ($this->value & 4) $str .= '<span class="warning" title="when ip address, PHPSESSID, or authentication token changes, or a draft must be copied">New Request Id</span> ';
        if ($this->value & 2) $str .= '<span>Finalized</span> ';
        if ($this->value & 1) $str .= '<span>JSON Included</span> ';

        return rtrim($str);
    }

    public function toHTMLinput() : string {
        throw new DBerror('there should not be html input for the field statusFlags');
    }

    public function toSQLstring(?DBC &$dbc = null) : string {
        return $this->value;
    }

    protected function equals(?DBV $other): bool {
        if (!(other instanceof StatusFlags)) return false;
        return $this->value === $other->value;
    }

    public static function createStatusFlags(bool $jsonIncluded,
                                             bool $finalized = false,
                                             bool $newRequestId = false,
                                             bool $copiedDraft = false,
                                             bool $jsonInvalid = false,
                                             bool $requestIdFailed = false,
                                             bool $draftIdFailed = false,
                                             bool $authenticationFailed = false
                                                            ) : StatusFlags {
        $value  = $jsonIncluded * 1
                + $finalized * 2
                + $newRequestId * 4
                + $copiedDraft * 8
                + $jsonInvalid * 16
                + $requestIdFailed * 32
                + $draftIdFailed * 64
                + $authenticationFailed * 128;
        return new static($value, true);
    }

    public static function createDynamic(?int $value = 0) : StatusFlags {
        if ($value < 0 || $value > 255) throw new DBerror();
        $new = new static($value, true);
        $new->dynamic = true;
        return $new;
    }
    
    public function setJSONincluded(bool $val) {
        if (!$this->dynamic) throw new DBerror();
        if ($val) {
            $this->value |= 0b00000001;
        } else {
            $this->value &= 0b11111110;
        }
    }

    public function setFinalized(bool $val) {
        if (!$this->dynamic) throw new DBerror();
        if ($val) {
            $this->value |= 0b00000010;
        } else {
            $this->value &= 0b11111101;
        }
    }

    public function setNewRequestId(bool $val) {
        if (!$this->dynamic) throw new DBerror();
        if ($val) {
            $this->value |= 0b00000100;
        } else {
            $this->value &= 0b11111011;
        }
    }

    public function setCopiedDraft(bool $val) {
        if (!$this->dynamic) throw new DBerror();
        if ($val) {
            $this->value |= 0b00001000;
        } else {
            $this->value &= 0b11110111;
        }
    }


    public function setJSONinvalid(bool $val) {
        if (!$this->dynamic) throw new DBerror();
        if ($val) {
            $this->value |= 0b00010000;
        } else {
            $this->value &= 0b11101111;
        }
    }

    public function setRequestIdFailed(bool $val) {
        if (!$this->dynamic) throw new DBerror();
        if ($val) {
            $this->value |= 0b00100000;
        } else {
            $this->value &= 0b11011111;
        }
    }

    public function setDraftIdFailed(bool $val) {
        if (!$this->dynamic) throw new DBerror();
        if ($val) {
            $this->value |= 0b01000000;
        } else {
            $this->value &= 0b10111111;
        }
    }

    public function setAuthenticationFailed(bool $val) {
        if (!$this->dynamic) throw new DBerror();
        if ($val) {
            $this->value |= 0b10000000;
        } else {
            $this->value &= 0b01111111;
        }
    }


    public function getJSONincluded() : bool {
        return $this->value & 1;
    }

    public function getFinalized() : bool {
        return $this->value & 2;
    }

    public function getNewRequestId() : bool {
        return $this->value & 4;
    }

    public function getCopiedDraft() : bool {
        return $this->value & 8;
    }

    public function getJSONinvalid() : bool {
        return $this->value & 16;
    }

    public function getRequestIdFailed() : bool {
        return $this->value & 32;
    }

    public function getDraftIdFailed() : bool {
        return $this->value & 64;
    }

    public function getAuthenticationFailed() : bool {
        return $this->value & 128;
    }

}

?>
