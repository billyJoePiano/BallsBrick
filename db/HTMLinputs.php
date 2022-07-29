<?php
require_once('obscure.php');
obscure(__FILE__);

//not actually an input
class Informational {
    private string $str;

    public function __construct(string $html) {
        $this->str = $html;
    }

    public function __toString() {
        return $this->str;
    }
}

class ErrorInformational extends Informational {
    private Exception $error;

    public function __construct(Exception $error) {
        $this->error = $error;
    }

    public function __toString() {
        return '<span class="formValidationError">'
                . htmlEscape($this->error->getMessage()) . '</span>';
    }
}

abstract class InputButton {
    public ?string $name = null;
    public ?string $value = null;
    //public ?string $jsOnClick = null; //TO DO -- code this
    public ?string $id = null;

    public function __toString() : string {
        $str = '<input type="' . static::INPUT_TYPE . '"';
        if ($this->name !== null) $str .= ' name="' . htmlEscape($this->name) . '"';
        if ($this->value !== null) $str .= ' value="' . htmlEscape($this->value) . '"';
        if ($this->id !== null) $str .= ' id="' . htmlEscape($this->id) . '"';
        return $str . ' />';
    }
}

class SubmitButton extends InputButton {
    const INPUT_TYPE = 'submit';
}

class ResetButton extends InputButton {
    const INPUT_TYPE = 'reset';
}


abstract class HTMLinput {
    public string $label;
    public ?string $title = null;
    public ?DBerror $error = null;

    abstract function __construct(string $name, string $label);
    //public abstract function getName() : string;
    protected abstract function toHTMLstring() : string;
    public abstract function setDefaultValue($value);

    public final function __toString() {
        $output = $this->toHTMLstring();

        if ($this->error) {
            $output .= '<span class="fieldValidationError">'
                    . htmlEscape($this->error->getMessage()) . '</span>';
        }

        return $output;
    }
}

class HiddenInput extends HTMLinput {
    private string $name;
    private string $value;
    public function __construct(string $name, string $value) {
        $this->name = $name;
        $this->value = $value;
    }
    public function setDefaultValue($value) {
        $this->value = $value;
    }
    public function toHTMLstring() : string {
        return '<input type="hidden" name="' . htmlEscape($this->name) .
                '" value="' . htmlEscape($this->value) . '" />';
    }


}

class TextInput extends HTMLinput {
    protected string $name;

    public ?string $value = null;
    public ?int $maxlength = null;
    public ?int $size = null;
    public ?string $pattern = null;
    public ?string $placeholder = null;
    public bool $required = false;
    public bool $disabled = false;
    public bool $readonly = false;


    function __construct(string $name, string $label) {
        $this->name = $name;
        $this->label = $label;
    }

    function setDefaultValue($value) {
        $this->value = $value;
    }

    function getName() : string {
        return $this->name;
    }

    function toHTMLstring() : string {
        $name = htmlEscape($this->name);
        $label = htmlEscape($this->label);
        $string = "<label for=\"$name\">$label</label><input type=\"text\" name=\"$name\" id=\"$name\" ";


        if ($this->value !== null)
            $string .= 'value="' . htmlEscape($this->value) . '" ';

        if ($this->title !== null)
            $string .= 'title="' . htmlEscape($this->title) . '" ';

        if ($this->placeholder !== null)
            $string .= 'placeholder="' . htmlEscape($this->placeholder) . '" ';

        if ($this->pattern !== null)
            $string .= 'pattern="' . htmlEscape($this->pattern) . '" ';

        if ($this->maxlength !== null)
            $string .= 'maxlength="' . $this->maxlength . '" ';

        if ($this->size !== null)
            $string .= 'size="' . $this->size . '" ';

        if ($this->required) $string .= 'required ';

        if ($this->disabled) $string .= 'disabled ';

        if ($this->readonly) $string .= 'readonly ';

        $string .= '/>';

        return $string;
    }
}

class TextArea extends TextInput {
    function toHTMLstring() : string {
        $name = htmlEscape($this->name);
        $label = htmlEscape($this->label);
        $string = "<label for=\"$name\">$label</label><textarea name=\"$name\" id=\"$name\"";


                if ($this->placeholder !== null)
            $string .= ' placeholder="' . htmlEscape($this->placeholder) . '"';


        if ($this->maxlength !== null)
            $string .= ' maxlength="' . $this->maxlength . '"';

        if ($this->size !== null)
            $string .= ' size="' . $this->size . '"';

        if ($this->required) $string .= ' required';

        if ($this->disabled) $string .= ' disabled';

        if ($this->readonly) $string .= ' readonly';

        $string .= '>';

        if ($this->value !== null)
            $string .= htmlEscape($this->value);

        return "$string</textarea>";
    }
}

class NumberInput extends HTMLinput {
    private string $name;
    public ?string $units = null;

    public ?float $value = null;
    public ?float $step = null;
    public ?float $min = null;
    public ?float $max = null;

    public bool $required = false;
    public bool $disabled = false;
    public bool $readonly = false;


    function __construct(string $name, string $label) {
        $this->name = $name;
        $this->label = $label;
    }

    function setDefaultValue($value) {
        if ($value === null) {
            $this->value = null;

        } else {
            if ($value !== (($cast = doubleval($value)) . '')) $cast = null;
                /*throw new FieldValidationError($value
                        . ' could not be interpretted as a valid number.');*/
            $this->value = $cast;
        }
    }

    function toHTMLstring() : string {
        $name = htmlEscape($this->name);
        $label = htmlEscape($this->label);
        $string = "<label for=\"$name\">$label</label><input type=\"number\" name=\"$name\" id=\"$name\" ";


        if ($this->value !== null)
            $string .= 'value="' . $this->value . '" ';

        if ($this->title !== null)
            $string .= 'title="' . htmlEscape($this->title) . '" ';

        if ($this->step !== null)
            $string .= 'step="' . $this->step . '" ';

        if ($this->min !== null)
            $string .= 'min="' . $this->min . '" ';

        if ($this->max !== null)
            $string .= 'max="' . $this->max . '" ';


        if ($this->required) $string .= 'required ';

        if ($this->disabled) $string .= 'disabled ';

        if ($this->readonly) $string .= 'readonly ';

        $string .= '/>';

        if ($this->units) {
            $string .= '<span class="numberUnits">' . htmlEscape($this->units)
                    . '</span>';
        }

        return $string;
    }
}

class DatetimeInput extends HTMLinput {
    const INPUT_TYPE = "datetime-local";
    private string $name;

    public ?DBVdatetime $value = null;
    public ?int $step = null;
    public ?DBVdatetime $min = null;
    public ?DBVdatetime $max = null;

    public bool $required = false;
    public bool $disabled = false;
    public bool $readonly = false;


    function __construct(string $name, string $label) {
        $this->name = $name;
        $this->label = $label;
    }

    function setDefaultValue($value) {
        if ($value === null) {
            $this->value = null;

        } else if (gettype($value) === 'object') {
            if (!($value instanceof DBVdatetime)) throw new DBerror();
            $this->value = $value;

        } else {
            if (($cast = new DBVdatetime($value))->toHTMLinput() != $value) {
                //stackTrace();
                $cast = null;
                $this->error = new FieldValidationError($value
                        . ' could not be interpreted as a valid date and time.');
            }

            $this->value = $cast;
        }
    }

    function toHTMLstring() : string {
        $name = htmlEscape($this->name);
        $label = htmlEscape($this->label);
        $type = static::INPUT_TYPE;
        $string = "<label for=\"$name\">$label</label><input type=\"$type\" name=\"$name\" id=\"$name\" ";


        if ($this->value !== null)
            $string .= 'value="' . $this->value->toHTMLinput() . '" ';

        if ($this->title !== null)
            $string .= 'title="' . htmlEscape($this->title) . '" ';

        if ($this->step !== null)
            $string .= 'step="' . $this->step . '" ';

        if ($this->min !== null)
            $string .= 'min="' . $this->min->toHTMLinput . '" ';

        if ($this->max !== null)
            $string .= 'max="' . $this->max->toHTMLinput . '" ';


        if ($this->required) $string .= 'required ';

        if ($this->disabled) $string .= 'disabled ';

        if ($this->readonly) $string .= 'readonly ';

        $string .= '/>';

        return $string;
    }
}

class DateInput extends DatetimeInput {
    const INPUT_TYPE = "datel";

    function setDefaultValue($value) {
        if ($value === null) {
            $this->value = null;

        } else if (gettype($value) === 'object') {
            if (!($value instanceof DBVdate)) throw new DBerror();
            $this->value = $value;

        } else {
            if (($cast = new DBVdate($value))->toHTMLinput() != $value) {
                //stackTrace();
                $cast = null;
                $this->error = new FieldValidationError($value
                        . ' could not be interpreted as a valid date');
            }

            $this->value = $cast;
        }
    }
}

class PasswordInput extends TextInput {
    public bool $required = true;

    function setDefaultValue($value) {
        $this->value = null;
        /*if ($value === null) {
            $this->value = null;
        } else {
            throw new DBerror('Password fields cannot have a default value!');
        }*/
    }

    function toHTMLstring() : string {
        $name = htmlEscape($this->name);
        $label = htmlEscape($this->label);
        $string = "<label for=\"$name\">$label</label><input type=\"password\" name=\"$name\" id=\"$name\" ";


        if ($this->value !== null)
            $string .= 'value="' . htmlEscape($this->value) . '" ';

        if ($this->title !== null)
            $string .= 'title="' . htmlEscape($this->title) . '" ';

        if ($this->placeholder !== null)
            $string .= 'placeholder="' . htmlEscape($this->placeholder) . '" ';

        if ($this->pattern !== null)
            $string .= 'pattern="' . htmlEscape($this->pattern) . '" ';

        if ($this->maxlength !== null)
            $string .= 'maxlength="' . $this->maxlength . '" ';

        if ($this->size !== null)
            $string .= 'size="' . $this->size . '" ';

        if ($this->required) $string .= 'required ';

        if ($this->disabled) $string .= 'disabled ';

        if ($this->readonly) $string .= 'readonly ';

        $string .= '/>';

        return $string;
    }
}

class PasswordConfirm extends PasswordInput {
    function toHTMLstring() : string {
        $error = $this->error;
        $this->error = null;

        $string = parent::toHTMLstring() . '</div><div>';

        $name = $this->name;
        $label = $this->label;

        $this->name .= 'Confirm';
        $this->label .= ' confirm';
        $this->error = $error;

        $string .= parent::toHTMLstring();

        $this->name = $name;
        $this->label = $label;

        return $string;
    }
}

class SelectionList extends HTMLinput {
    private string $name;
    public array $options = array();
    public ?string $value = null;

    function __construct(string $name, string $label) {
        $this->name = $name;
        $this->label = $label;
    }

    function setDefaultValue($value) {
        if (key_exists($value . '', $this->options)) $this->value = $value;
    }

    public function toHTMLstring() : string {
        $name = htmlEscape($this->name);
        $label = htmlEscape($this->label);
        $string = "<label for=\"$name\">$label</label><select name=\"$name\" id=\"$name\">";

        foreach($this->options as $value => $display) {
            $selected = $this->value === $value . ''; //coerce to string, in case it is an integer index

            if ($display !== null) {
                $value = htmlEscape($value);
                $display = htmlEscape($display);
                $string .= "<option value=\"$value\"";
            } else {
                $display = htmlEscape($value);
                $string .= "<option";
            }

            if ($selected) {
                $string .= ' selected>';
            } else {
                $string .= '>';
            }

            $string .= $display . '</option>';

        }
        $string .= '<select>';

        return $string;
    }
}

/*
class BooleanSelectionList extends SelectionList {
    public

}
*/

?>