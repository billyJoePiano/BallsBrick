<?php
require_once(__DIR__ . '/../../db/obscure.php');
obscure(__FILE__);

//require_once(__DIR__ . '/../../template.php'); //ASSUMES THIS IS ALREADY LOADED

(function() {
    $index = array_search('/stylesheets/blogreader.css');
    if ($index === false) throw new DBerror('Quill stylesheet should be replacing blogreader');
    Header::$stylesheets[$index] = '/blog/quill/quill.snow.css'; //replaces '/stylesheets/blogreader.css'
    Header::$stylesheets[] = 'https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.7.1/katex.min.css';
    Header::$stylesheets[] = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/9.12.0/styles/monokai-sublime.min.css';

    Header::$scripts[] = 'https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.7.1/katex.min.js';
    Header::$scripts[] = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/9.12.0/highlight.min.js';
    Header::$scripts[] = '/blog/quill/quill.min.js';

})();


class QuillInput extends TextInput {
    public function toHTMLString() : string {
        $name = htmlEscape($this->name);
        $nameJS = jsEscape($this->name);
        $label = htmlEscape($this->label);
        $value = $this->value ?? '';

        return <<<htmlString

<label for="$name-standalone-container">$label</label>
<div id="$name-standalone-container" class="standalone-container">
    <div id="$name-toolbar-container" class="toolbar-container">
<span class="ql-formats">
  <select class="ql-font"></select>
  <select class="ql-size"></select>
</span>
        <span class="ql-formats">
  <button class="ql-bold"></button>
  <button class="ql-italic"></button>
  <button class="ql-underline"></button>
  <button class="ql-strike"></button>
</span>
        <span class="ql-formats">
  <select class="ql-color"></select>
  <select class="ql-background"></select>
</span>
        <span class="ql-formats">
  <button class="ql-script" value="sub"></button>
  <button class="ql-script" value="super"></button>
</span>
        <span class="ql-formats">
  <button class="ql-header" value="1"></button>
  <button class="ql-header" value="2"></button>
  <button class="ql-blockquote"></button>
  <button class="ql-code-block"></button>
</span>
        <span class="ql-formats">
  <button class="ql-list" value="ordered"></button>
  <button class="ql-list" value="bullet"></button>
  <button class="ql-indent" value="-1"></button>
  <button class="ql-indent" value="+1"></button>
</span>
        <span class="ql-formats">
  <button class="ql-direction" value="rtl"></button>
  <select class="ql-align"></select>
</span>
        <span class="ql-formats">
  <button class="ql-link"></button>
  <button class="ql-image"></button>
  <button class="ql-video"></button>
  <button class="ql-formula"></button>
</span>
        <span class="ql-formats">
  <button class="ql-clean"></button>
</span>
    </div>
    <div id="$name-editor-container" class="editor-container">$value</div>
</div>

<input type="hidden" id="$name" name="body" />

<script>
    window.addEventListener('load', function makeQuill() {
        var quill = new Quill('#$nameJS-editor-container', {
            modules: {
                formula: true,
                syntax: true,
                toolbar: '#$nameJS-toolbar-container'
            },
            //placeholder: 'Compose an epic...',
            theme: 'snow'
        });

        for (let input of document.getElementsByTagName('input')) {
            if (input.type === 'submit') {
                input.addEventListener('click', submit)
            }
        }
        
        function submit() {
            document.getElementById('$nameJS').value = quill.root.innerHTML;
        }
        
    });
</script>

htmlString;

    }
}

?>