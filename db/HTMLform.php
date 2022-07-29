<?php
require_once('obscure.php');
obscure(__FILE__);

require_once('HTMLinputs.php');

class HTMLform implements IteratorAggregate {
    private static int $formCount = 0;

    private int $formNum;
    public ?string $formTitle = null;

    private ?DBT $table = null;
    private array $inputs = array();
    private array $buttons = array();
    private ?bool $submissionError = null;
    private array $infos = array();
    public ?string $action;
    public ?string $method = 'post';

    public function __construct(?DBT $table = null) {
        $this->formNum = ++HTMLform::$formCount;
        $this->action = $_SERVER['PHP_SELF'];
        $this->buttons[] = new SubmitButton();
        $this->buttons[] = new ResetButton();

        if (!$table instanceof DBT || get_class($table) !== 'DBT') return;

        $this->table = $table;
        $descriptors = $table->getAllDescriptors();

        foreach ($descriptors as $field => $descriptor) {
            if ($descriptor['auto_increment'] || $descriptor['phpType'] === null) {
                $input = null;
            } else {
                switch ($descriptor['phpType']) {
                    case 'string': //case 'null':
                        $input = new TextInput($field, $descriptor['label']);
                        if (key_exists('maxLen', $descriptor)) {
                            $input->maxlength = $descriptor['maxLen'];
                        }
                        if (key_exists('minLen', $descriptor) && $descriptor['minLen'] > 0) {
                            $input->required = true;
                        }

                        break;

                    case 'integer': case 'double':
                    $input = new NumberInput($field, $descriptor['label']);
                    $input->max = $descriptor['maxVal'];
                    $input->min = $descriptor['minVal'];

                    if (key_exists('rightDigits', $descriptor)
                            && $descriptor['rightDigits'] > 0) {
                        $input->step = floatval('0.'
                                . str_repeat('0', $descriptor['rightDigits'] - 1)
                                . '1');
                    }

                    break;

                    case 'boolean':
                        $input = new SelectionList($field, $descriptor['label']);
                        $input->options = array(
                                0 => 'No',
                                1 => 'Yes'
                        );
                        break;

                    case 'object':
                        $input = $descriptor['reflectionClass']
                                ->getMethod('getHTMLinput')
                                ->invoke(null, $field, $descriptor['label']);
                        break;

                    default:
                        throw new DBerror('input not setup for this type yet: ' . $descriptor['phpType']);
                }
            }

            $input = $table->getDBRimplementationReflection()->getMethod('validateHTMLinput')
                    ->invoke(null, $field, $input, $descriptors);

            if ($input !== null) {
                if(!($input instanceof HTMLinput)) throw new DBerror();
                $inputs[$field] = $input;
            }
        }
        $this->inputs = $inputs;
    }

    public function __toString() :string {
        if ($this->formTitle) {
            $id = 'Form' . ($this->formNum);
            $title = htmlEscape($this->formTitle);
            $string = "<fieldset id=\"$id\">"
                    . "<div><label for=\"$id\"><h3>$title</h3></label></div>";
        } else {
            $string = "<fieldset>";
        }

        $string .= '<form';
        if ($this->method !== null) {
            $string .= " method=\"$this->method\"";
        }
        if ($this->action !== null) {
             $string .= ' action="'. htmlEscape($this->action) . '"';
        }

        $string .= '>';

        if (count($this->infos) > 0) {
            $string .= '<div>' . implode('</div><div>', $this->infos) . '</div>';
        }

        if (count($this->inputs) > 0) {
            $string .= '<div class="input">'
                    . implode('</div><div class="input">', $this->inputs) . '</div>';
        }

        if (count($this->buttons) > 0) {
            $string .= '<div class="buttons">' . implode('', $this->buttons) . '</div>';
        }

        return $string . '</form></fieldset>';;
    }

    //defaults to $_POST superglobal if $values not provided
    public function validateAndInsert(?array $values = null, ?DBC &$dbc = null) {
        if ($values === null) {
            $values = $_POST;
            //unset($values['submit']);
        }

        $key = null;

        try {
            $key = $this->table->insert($values, $dbc);
            $this->submissionError = false;

        } catch(InsertError $e) {
            $this->submissionError = true;

            foreach ($e->values as $field => $value) {
                if(key_exists($field, $this->inputs)) {
                    $this->inputs[$field]->setDefaultValue($value);
                }


            }

            foreach ($e->errors as $field => $error) {
                if (key_exists($field, $this->inputs))
                    $this->inputs[$field]->error = $error;
                else $this->infos[] = new ErrorInformational($error);
            }
        }

        return $key;
    }

    public function fetchInstance(?DBC &$dbc = null) : ?DBR {
        switch ($_SERVER['REQUEST_METHOD']) {
            case 'GET':
                $values = $_GET;
                break;

            case 'POST':
                $values = $_POST;
                //unset($values['submit']);
                break;

            default:
                throw new DBerror('Request method ' . $_SERVER['REQUEST_METHOD']
                        . ' not setup yet.');
        }

        try {
            $primaryKey = $this->table->extractPrimaryKeyFromHTTP($values);

        } catch (DBerror $e) {
            $this->submissionError = true;
            $this->infos[] = new ErrorInformational($e);;
            return null;
        }

        try {
            return $this->table->getDBRimplementationReflection()
                    ->getMethod('fetchInstanceFromLookupKey')
                    ->invoke(null, $primaryKey, $dbc);

        } catch (NonexistentRecord $e) {
            // Multiple records should never happen if this is in fact a primary key
            // (which is validated by extractPrimaryKeyFromHTTP)
            $this->infos[] = new ErrorInformation(new NonexistentRecord(
                    'Sorry, there was a database error trying to find that record for updating'));
            $this->inputs[] = $errInfo;
            return null;
        }
    }

    public function validateAndUpdate(DBR $instance, ?array $values = null,
                                      ?DBC &$dbc = null) : bool {

        if ($values === null) {
            $values = $_POST;
            //unset($values['submit']);
        }

        // doing this check here rather than in the DBR instance, because some
        // fields which are existent and non-PK should also be un-editable by the user
        // via form / post hacking.
        foreach ($values as $field => $value) {
            if (!key_exists($field, $this->inputs)) {
                $this->infos[] = new FieldValidationError("Invalid or nonexistent field `$field`");
                unset($values[$field]);
            }
        }

        $valuesNoPK = $values;
        foreach ($instance->getPrimaryKeyValues() as $field => $value) {
            unset($valuesNoPK[$field]);
        }

        try {
            $instance->update($valuesNoPK, $dbc);
            $this->submissionError = false;
            return true;

        } catch (UpdateError $updateError) {
            // values returned from the UpdateError are prioritized over raw values
            foreach ($updateError as $field => $value) {
                $values[$field] = $value;
            }

            foreach ($updateError->errors as $field => $error) {
                if (key_exists($field, $this->inputs))
                    $this->inputs[$field]->error = $error;
                else $this->infos[] = new ErrorInformational($error);
            }
        }

        $this->submissionError = true;
        $instanceVals = $instance->getAllValues();

        foreach ($this->inputs as $field => $input) {


            if(key_exists($field, $values))
                $this->inputs[$field]->setDefaultValue($values[$field]);

            // values from the $_POST (or w/e is passed) are prioritized over old instance values
            else if (key_exists($field, $instanceVals))
                $this->inputs[$field]->setDefaultValue($instanceVals[$field]);
        }

        return false;

    }

    public function setValuesFromInstance(DBR $instance) {
        if (!$this->table->getDBRimplementationReflection()->isInstance($instance))
            throw new DBerror();

        $this->setValuesFromArray($instance->getAllValues());
    }

    //defaults to $_POST if $values not passed
    public function setValuesFromArray(?array $values = null) {
        if ($values === null) $values = $_POST;

        foreach ($values as $field => $value) {
            if (!key_exists($field, $this->inputs)) continue;
            if (gettype($value) === 'object') {
                if (!($value instanceof DBV)) throw new DBerror();
                $value = $value->toHTMLinput();
            }
            $this->inputs[$field]->setDefaultValue($value);
        }
    }

    public function getIterator() : Traversable {
        return (function() {
            foreach($this->inputs as $key => $value) {
                yield $key => $value;
            }
        })();
    }

    public function getInputs() : array {
        return $this->inputs;
    }

    public function clearInputs() {
        $this->inputs = array();
    }

    public function getInput(string $field) : HTMLinput {
        if (!key_exists($field, $this->inputs))
            throw new DBerror("Field $field does not exist in this form.");

        return $this->inputs[$field];
    }

    public function setInput(string $field, ?HTMLinput $input) {
        if ($input === null) {
            unset($this->inputs[$field]);

        } else {
            $this->inputs[$field] = $input;
        }
    }

    public function getButtons() : array {
        return $this->buttons;
    }

    public function clearButtons() {
        $this->buttons = array();
    }

    public function addButton(InputButton $button) {
        $this->buttons[] = $button;
    }

    public function getButton(string $field) : HTMLinput {
        if (!key_exists($field, $this->buttons))
            throw new DBerror("Button $field does not exist in this form.");

        return $this->buttons[$field];
    }

    public function setButton($key, ?InputButton $button) {
        if ($button === null) {
            unset($this->buttons[$key]);

        } else {
            $this->buttons[$key] = $button;
        }
    }

    public function getInformationals() : array {
        return $this->infos;
    }

    public function clearInformationals() {
        $this->infos = array();
    }

    public function addInformational(Informational $info) {
        $this->infos[] = $info;
    }

    public function getInformational(string $field) : HTMLinput {
        if (!key_exists($field, $this->infos))
            throw new DBerror("Informational $field does not exist in this form.");

        return $this->infos[$field];
    }

    public function setInformational($key, ?InputButton $button) {
        if ($button === null) {
            unset($this->infos[$key]);

        } else {
            $this->infos[$key] = $button;
        }
    }

    public function hadSubmissionError() : ?bool {
        return $this->submissionError;
    }
}


?>
