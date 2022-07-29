function WebConsole(_document, _window, settings) {
    var htmlString = '<div id="commandLineContainer"><button id="submitCommandLine">&gt;</button><textarea id="commandLine"></textarea><button id="clearCommandLine">X</button></div><div id="buttonsContainer"><button id="returnAction" class="off arrowFont">&#8629;&gt;</button><button class="shortcut">=</button><button class="shortcut">.</button><button class="shortcut">,</button><button class="shortcut">"</button><button class="shortcut">(</button><button class="shortcut">)</button><button class="shortcut">[</button><button class="shortcut">]</button><button class="shortcut">+</button><button class="shortcut">-</button><button class="shortcut">*</button><button class="shortcut">/</button><button class="shortcut">></button><button class="shortcut"><</button><button class="shortcut">%</button><button class="shortcut">!</button><button class="shortcut">&</button><button class="shortcut">|</button><button class="shortcut">{</button><button class="shortcut">}</button><button class="shortcut">^</button><button class="shortcut">~</button><button class="shortcut">\\</button><button class="shortcut">?</button><button class="shortcut">:</button><button class="shortcut">\'</button><button class="shortcut">`</button><button class="shortcut">;</button><div id="_window_" class="buttonSubDiv"><button id="window_" class="shortcutParent">window</button><button class="buttonSubDivXout">X</button></div><div id="_document_" class="buttonSubDiv"><button id="document_" class="shortcutParent">document</button><button class="buttonSubDivXout">X</button><button class="shortcut">.getElementById(" ")</button><button class="shortcut">.getElementsByTagName(" ")</button><button class="shortcut">.getElementsByClassName(" ")</button></div><div id="_Object_" class="buttonSubDiv"><button id="Object_" class="shortcutParent">Object</button><button class="buttonSubDivXout">X</button><button class="shortcut">.getOwnPropertyDescriptor( , "")</button><button class="shortcut">.getOwnPropertyDescriptors( )</button><button class="shortcut">.getOwnPropertyNames( )</button><button class="shortcut">.getOwnPropertySymbols( )</button><button class="shortcut">.getPrototypeOf( )</button><button class="shortcut">.defineProperty( , "", { })</button><button class="shortcut">.defineProperties( , { })</button><button class="shortcut">.keys( )</button><button class="shortcut">.entries( )</button><button class="shortcut">.seal( )</button><button class="shortcut">.freeze()</button><button class="shortcut">.create( , { })</button><button class="shortcut">.assign( , )</button></div><div id="textButtons"><button id="grab">Grab a value</button><button id="options">Options</button></div></div><div id="optionsContainer"><div id="optionsButtons"><button id="ok">OK</button><button id="apply">Apply</button><button id="cancel">Cancel</button></div><div class="border"><span class="divLabel">Command line</span><table><tr><td><label for="commandLineHeight">Height</label></td><td><input type="number" id="commandLineHeight" value="1" /></td><td><input type="checkbox" id="commandLineHeightAuto" checked /><label for="commandLineHeightAuto">Auto-expand with more lines</label></td></tr><tr><td><label for="commandLineWidth">Width</label></td><td><input type="number" id="commandLineWidth" disabled /></td><td><input type="checkbox" id="commandLineWidthAuto" checked /><label for="commandLineWidthAuto">Auto-fit to viewport</label></td></tr></table></div><div class="border"><span class="divLabel">Show entries in console</span><div class="border"><span class="divLabel">Show by entry types</span><table><tbody><tr><td><input type="checkbox" id="showAll" checked /></td><td><label for="showAll">All</label></td></tr><tr><td>&nbsp;</td></tr><tr><td><input type="checkbox" id="showValidCommands" checked disabled /></td><td><label for="showCommands">Valid commands entered</label></td></tr><tr><td><input type="checkbox" id="showValidReturns" checked disabled /></td><td><label for="showReturns">Returns from valid commands</label></td></tr><tr><td><input type="checkbox" id="showInvalidCommands" disabled /></td><td><label for="showCommands">Invalid commands entered</label></td></tr><tr><td><input type="checkbox" id="showErrorReturns" disabled /></td><td><label for="showErrorCommands">Errors from invalid commands</label></td></tr><tr><td>&nbsp;</td></tr><tr><td><input type="checkbox" id="showRuntimeErrors" checked disabled /></td><td><label for="showRuntimeErrors">Runtime errors</label></td></tr><tr><td><input type="checkbox" id="showLogs" disabled /></td><td><label for="">console.log</label></td></tr><tr><td><input type="checkbox" id="showInfos" disabled /></td><td><label for="">console.info</label></td></tr><tr><td><input type="checkbox" id="showErrors" disabled /></td><td><label for="">console.error</label></td></tr></tbody></table></div><div class="border"><span class="divLabel tall"><input type="checkbox" id="filterEntries" /><label for="filterEntries">Filter entries for:</label></span><table><tr><td><input type="checkbox" id="filterEntriesForNumbers" checked disabled /></td><td><label for="filterEntriesForNumber">Numbers</label></td></tr><tr><td><input type="checkbox" id="filterEntriesForBooleans" checked disabled /></td><td><label for="filterEntriesForBooleans">Booleans</label></td></tr><tr><td><input type="checkbox" id="filterEntriesForStrings" checked disabled /></td><td><label for="filterEntriesForStrings">Strings</label></td></tr><tr><td><input type="checkbox" id="filterEntriesForSymbols" checked disabled /></td><td><label for="filterEntriesForSymbols">Symbols</label></td></tr><tr><td><input type="checkbox" id="filterEntriesForObjects" checked disabled /></td><td><label for="filterEntriesForObjects">Objects</label></td></tr><tr><td><input type="checkbox" id="filterEntriesForFunctions" checked disabled /></td><td><label for="filterEntriesForFunctions">Functions</label></td></tr><tr><td><input type="checkbox" id="filterEntriesForUndefined" checked disabled /></td><td><label for="filterEntriesForUndefined">undefined</label></td></tr><tr><td><input type="checkbox" id="filterEntriesForNull" checked disabled /></td><td><label for="filterEntriesForNull">null</label></td></tr><tr><td><input type="checkbox" id="filterEntriesForCustom" disabled /></td><td><label for="filterEntriesForCustom">Custom filter:</label></td></tr><tr><td colspan="10"><input type="text" placeholder="callback(value)" id="filterEntriesCustomFunction" disabled /><p>returns boolean</p></td></tr></table></div><div class="border"><span class="divLabel tall"><input type="checkbox" id="filterPairs" /><label for="filterPairs">Filter key-value pairs for:</label></span><table><tr><td><input type="checkbox" id="filterPairsForNumbers" checked disabled /></td><td><label for="filterPairsForNumber">Numbers</label></td></tr><tr><td><input type="checkbox" id="filterPairsForBooleans" checked disabled /></td><td><label for="filterPairsForBooleans">Booleans</label></td></tr><tr><td><input type="checkbox" id="filterPairsForStrings" checked disabled /></td><td><label for="filterPairsForStrings">Strings</label></td></tr><tr><td><input type="checkbox" id="filterPairsForSymbols" checked disabled /></td><td><label for="filterPairsForSymbols">Symbols</label></td></tr><tr><td><input type="checkbox" id="filterPairsForObjects" checked disabled /></td><td><label for="filterPairsForObjects">Objects</label></td></tr><tr><td><input type="checkbox" id="filterPairsForFunctions" checked disabled /></td><td><label for="filterPairsForFunctions">Functions</label></td></tr><tr><td><input type="checkbox" id="filterPairsForUndefined" checked disabled /></td><td><label for="filterPairsForUndefined">undefined</label></td></tr><tr><td><input type="checkbox" id="filterPairsForNull" checked disabled /></td><td><label for="filterPairsForNull">null</label></td></tr><tr><td><input type="checkbox" id="filterPairsForCustom" disabled /></td><td><label for="filterPairsForCustom">Custom filter:</label></td></tr><tr><td colspan="10"><input type="text" placeholder="callback(key, value)" id="filterPairsCustomFunction" disabled /><p>returns boolean</p></td></tr></table></div><!--  <tr><td><input type="checkbox" id="" /></td><td><label for=""></label></td></tr>  --></div><div class="border"><span class="divLabel">Page frame size</span><table><tbody><tr><td><input type="checkbox" id="pageFrameAutosize" checked /></td><td><label for="pageFrameAutosize">Auto (window viewport size)</label></td></tr><tr><td><label for="pageFrameWidth">Width</label></td><td><input type="number" id="pageFrameWidth" disabled value="400" />Viewport width: <span id="pageViewportWidth"></span></td></tr><tr><td><label for="pageFrameHeight">Height</label></td><td><input type="number" id="pageFrameHeight" value="500" disabled />Viewport height: <span id="pageViewportHeight"></span></td></tr></tbody></table><button id="pageFrameHover" class="floatBottom">Hover over</button><div class="clearFloat"><input type="checkbox" id="pageFrameLiveResize" disabled /><label for="pageFrameLiveResize">Live resize on change</label><p>NOTE: This will trigger resize event listeners in the frame</p></div></div><div class="border"><span class="divLabel">Console frame size</span><table><tbody><tr><td><input type="checkbox" id="consoleFrameAutosize" checked /></td><td><label for="consoleFrameAutosize">Auto (window viewport size)</label></td></tr><tr><td><label for="consoleFrameWidth">Width</label></td><td><input type="number" id="consoleFrameWidth" value="400" disabled />Viewport width: <span id="consoleViewportWidth"></span></td></tr><tr><td><label for="consoleFrameHeight">Height</label></td><td><input type="number" id="consoleFrameHeight" value="500" disabled />Viewport height: <span id="consoleViewportHeight"></span></td></tr></tbody></table><button id="consoleFrameHover" class="floatBottom">Hover over</button><div class="clearFloat"><input type="checkbox" id="consoleFrameLiveResize" disabled /><label for="consoleFrameLiveResize">Live resize on change</label></div></div><div class="border"><span class="divLabel">Orientation</span><table><tr><td><label for="consoleOrientation">Console</label></td><td><select id="consoleOrientation"><option value="true">Below page frame (if applicable) &nbsp; DEFAULT</option><option value="false">Above page frame (if applicable)</option></select></td><td></td></tr><tr><td><label for="commandLineOrientation">Command line</label></td><td><select id="commandLineOrientation" disabled><option value="true">Mobile-friendly: Top, above console output</option><option value="false">Traditional: Bottom, below console output</option></select></td><td><input type="checkbox" id="commandLineOrientationDefault" checked /><label for="commandLineOrientationDefault" class="checkboxLabel">Default from console</label></td></tr><tr><td><label for="consoleOutputOrientation">Console output</label></td><td><select id="consoleOutputOrientation" disabled><option value="true">Mobile-friendly: Inverted, Most recent (top) to oldest (bottom)</option><option value="false">Traditional: Oldest (top) to most recent (bottom)</option></select></td><td><input type="checkbox" id="consoleOutputOrientationDefault" checked /><label for="consoleOutputOrientationDefault" class="checkboxLabel">Default from command line</label></td></tr><tr><td><label for="groupOrientation">Within output grouping</label></td><td><select id="groupOrientation"><option value="true">Traditional: First (top) to last (bottom)</option><option value="false">Inverted: Last (top) to first (bottom)</option></select></td><td></td></tr><tr><td><label for="optionsButtonsOrientation">Command buttons orientation</label></td><td><select id="optionsButtonsOrientation"><option value="outside">Outside command line and console output &nbsp; DEFAULT</option><option value="between">Between command line and console output</option><option value="opposite">Opposite from command line (over console output)</option><option value="above">Above command line</option><option value="below">Below command line</option><option value="top">Top (But below page frame, if applicable)</option><option value="bottom">Bottom (But above page frame, if applicable)</option><option value="veryTop">Very top (above page frame, if applicable)</option><option value="veryBottom">Very bottom (below page frame, if applicable)</option></select></td></table></div></div><div id="consoleOutput"></div>'
    var TAG_TYPE = "pre";
    var SHORT_DESC_MAX = 20;
    var MED_DESC_MAX = 80;
    var LONG_STR_MAX = 200;

    //set global function accessors
    //var _console; //delete if not neccessary???

    var elements = ["pageFrame", "consoleDiv", "commandLineContainer", "submitCommandLine", "commandLine", "clearCommandLine", "optionsOuterDiv",
        "buttonsContainer", "arrowButtons", "returnAction", "textButtons", "grab", "options", "optionsContainer",
        "optionsButtons", "ok", "apply", "cancel", "commandLineHeight", "commandLineHeightAuto", "commandLineWidth", "commandLineWidthAuto", "showAll",
        "showValidCommands", "showValidReturns", "showInvalidCommands", "showErrorReturns", "showRuntimeErrors", "showLogs", "showInfos", "showErrors", "filterEntries",
        "filterEntriesForNumbers", "filterEntriesForBooleans", "filterEntriesForStrings", "filterEntriesForSymbols", "filterEntriesForObjects",
        "filterEntriesForFunctions", "filterEntriesForUndefined", "filterEntriesForNull", "filterEntriesForCustom", "filterEntriesCustomFunction", "filterPairs",
        "filterPairsForNumbers", "filterPairsForBooleans", "filterPairsForStrings", "filterPairsForSymbols", "filterPairsForObjects", "filterPairsForFunctions",
        "filterPairsForUndefined", "filterPairsForNull", "filterPairsForCustom", "filterPairsCustomFunction", "pageFrameAutosize", "pageFrameWidth",
        "pageFrameHeight", "pageFrameHover", "pageFrameLiveResize", "consoleFrameAutosize", "consoleFrameWidth", "consoleFrameHeight", "consoleFrameHover",
        "consoleFrameLiveResize", "consoleOrientation", "commandLineOrientation", "commandLineOrientationDefault", "consoleOutputOrientation",
        "consoleOutputOrientationDefault", "groupOrientation", "optionsButtonsOrientation"];

    var disablingCheckboxes = {
        commandLineWidthAuto: { disableWhen: true, controls: ["commandLineWidth"] },
        showAll: { disableWhen: true, controls: ["showValidCommands", "showValidReturns", "showInvalidCommands", "showErrorReturns", "showRuntimeErrors", "showLogs", "showInfos", "showErrors"] },
        filterEntries: { disableWhen: false, controls: ["filterEntriesForNumbers", "filterEntriesForBooleans", "filterEntriesForStrings", "filterEntriesForSymbols", "filterEntriesForObjects", "filterEntriesForFunctions", "filterEntriesForUndefined", "filterEntriesForNull", "filterEntriesForCustom", "filterEntriesCustomFunction"] },
        filterPairs: { disableWhen: false, controls: ["filterPairsForNumbers", "filterPairsForBooleans", "filterPairsForStrings", "filterPairsForSymbols", "filterPairsForObjects", "filterPairsForFunctions", "filterPairsForUndefined", "filterPairsForNull", "filterPairsForCustom", "filterPairsCustomFunction"] },
        pageFrameAutosize: { disableWhen: true, controls: ["pageFrameWidth", "pageFrameHeight", "pageFrameLiveResize"] },
        consoleFrameAutosize: { disableWhen: true, controls: ["consoleFrameWidth", "consoleFrameHeight", "consoleFrameLiveResize"] },
        commandLineOrientationDefault: { disableWhen: true, controls: ["commandLineOrientation"] },
        consoleOutputOrientationDefault: { disableWhen: true, controls: ["consoleOutputOrientation"] }
    }

    var buttonFunctions = {
        //by command line
        submitCommandLine: submitCommandLine,
        clearCommandLine: clearCommandLine,
        returnAction: returnAction,
        grab: grab,
        options: options,

        //in options panel
        ok: ok,
        apply: apply,
        cancel: cancel,
        pageFrameHover: pageFrameHover,
        consoleFrameHover: consoleFrameHover,
    }

    var settingsFunctions = {};
    createSettingsFunctions();

    var consoleFunctions;
   
    var iframe;
    var grabValueFlag = false;

    
    installOnDocument(_document);
    linkToWindow(_window);

    this.newWindow = linkToWindow;

    return this;


    function resizeIframe() {

        if (_window.parent !== window) {
            var iframes = _window.parent.document.getElementsByTagName("iframe");
            for (var i = 0; i < iframes.length; i++) {
                if (iframes[i].contentWindow === _window) {
                    iframe = iframes[i];
                    break;
                }
            }

            if (iframe) {
                var viewport = getViewportSize();
                iframe.style.width = viewport.width + "px";;
                iframe.style.height = viewport.height + "px";
            }
        }
    }

    function getViewportSize() {
        if (window.visualViewport) {
            return { width: window.visualViewport.width, height: window.visualViewport.height };

        } else if (window.screen) {
            return { width: window.screen.availWidth, height: window.screen.availHeight };

        } else {
            alert("Couldn't determine window viewport property");
        }
    }

    function linkToWindow(newWindow) {
        extractAndOverrideWindowFunctions(newWindow, true);
    }

    function extractAndOverrideWindowFunctions(_win, isNew) {

        var _console = _win.console;
        var _eval = _win.eval;
        var installTime = _win.performance.now();

        if (!(_win instanceof _win.Window) || typeof _eval !== "function" || typeof _console.log !== "function" || typeof _console.clear !== "function" || typeof _console.error !== "function" || typeof _console.info !== "function") {
            //note: instanceof Window doesn't work because the Window constructor for this document is a different instance of the native constructor function than for the other doc
            alert("newWindow was not an instance of Window");
        }

        if (_window && consoleFunctions) {
            //restore functions to old window
            if (isNew) consoleFunctions.info("Link ended between web console and this window", _document);
            try { _window.removeEventListener("beforeunload", consoleFunctions.watchForNewDocLoad); }
            catch (err) { consoleFunctions.error(err); }

            try { _window.removeEventListener("error", consoleFunctions.runtimeError); }
            catch (err) { consoleFunctions.error(err); }
        }

        consoleFunctions = createConsoleFunctions(_window = _win, _eval, _console);
        
        _console.web = function () {
            return elements.consoleOutput;
        }


        commandHistory = [];

        _window.setTimeout(waitForHREF);
        function waitForHREF() {
            if (isNew) {
                consoleFunctions.info("Web console successfully linked to a new window: " + _window.location.href + "\nStarting at " + (Math.round(installTime * 10) / 10) + "ms from document's birth.  It took " + (Math.round((_window.performance.now() - installTime) * 10) / 10) + "ms to complete linking.", _window, _window.document);
            } else {
                consoleFunctions.info("New document loaded in this window: " + _window.location.href, _window.document);
            }
        }

    }


    function createConsoleFunctions(__win, __eval, __console) {

        var webConsoleFunctions = {
            execute: execute,
            log: log,
            clear: clear,
            error: error,
            info: info,
            trace: trace,
            runtimeError: runtimeError,
            eval: __eval,
            assignGlobalVariable: assignGlobalVariable,
            watchForNewDocLoad: watchForNewDocLoad
        };

        try {
            __win.addEventListener("error", runtimeError);
            __win.addEventListener("beforeunload", watchForNewDocLoad);

        } catch (err) {
            error(err);
        }

        try {
            var nativeFunctions = {
                log: __console.log,
                error: __console.error,
                clear: __console.clear,
                info: __console.info,
                trace: __console.trace,
            };
            webConsoleFunctions.nativeFunctions = nativeFunctions;
            __console.link = linkToWindow;

            //alert("trying to modify native console object");

            for (var func in nativeFunctions) {
                __console[func] = (function (webConsoleFunction, nativeFunction) {
                    return function () {
                        if (this) {
                            webConsoleFunction.apply(this, arguments);
                            nativeFunction.apply(this, arguments);
                        }
                    }
                })(webConsoleFunctions[func], nativeFunctions[func]);
            }

        } catch (err) {
            error(err);
        }


        var backChannelAccessorName = "qwertyuiop"; //generateRandomVariableName();
        var valueToPass;
        var symbol;

        try {
            __eval("clear = console.clear");
            __eval("linkTo = console.link");
            __eval("log = console.log");
            __console.grabWebConsoleValue = backChannelAccessor;

            if (__eval(backChannelAccessorName + " = console.grabWebConsoleValue;") !== backChannelAccessor) throw new Error("Unable to install backchannel value accessor");
            //__eval("delete console.backChannelAccessor; delete window." + backChannelAccessorName + ";");

        } catch (err) {
            error(err);
        }

        try {
            symbol = Symbol("Back channel access authenticator");

        } catch (err) {
            symbol = {};
        }


        return webConsoleFunctions;

        function execute(statement) {
            if (!statement || statement.length <= 0) return;
            statement = String(statement);

            var entryGroup = addToOutput([statement], "command");

            try {
                var result = __eval(statement);
                var resultEntry = createEntry(result, "return");

            } catch (err) {
                reuslt = err;
                resultEntry = createEntry(err, "error");
                entryGroup.classList.add("error");
            }

            entryGroup.appendChild(resultEntry);
            //keeps the command & return together in the same output group, div even if there are console.logs while executing
            return result;
        }

        function log() {
            addToOutput(arguments, "log");
            //addToOutput([__console.trace()], "log");
        }

        function clear() {
            elements.consoleOutput.innerHTML = "";
        }

        function error() {
            addToOutput(arguments, "error");
        }

        function info() {
            addToOutput(arguments, "info");
        }

        function runtimeError(error) {
            addToOutput(error, "error");
        }

        function trace() {
            try {
                log(arguments.callee);
                log(arguments.callee.caller);
            } catch (err) { }

            log(stacktrace());
        }

        function stacktrace() {
            function st2(f) {
                var args = [];
                if (f) {
                    for (var i = 0; i < f.arguments.length; i++) {
                        args.push(f.arguments[i]);
                    }
                    var function_name = f.toString().
                        split('(')[0].substring(9);
                    return st2(f.caller) + function_name +
                        '(' + args.join(', ') + ')' + "\n";
                } else {
                    return "";
                }
            }
            return st2(arguments.callee.caller);
        }

        function assignGlobalVariable(variableName, value) {
            if (!validateVariableName()) return false;
            valueToPass = value;
            try {
                if (__eval(variableName + " = " + backChannelAccessorName + "();") !== value) throw new Error("Assigning value to global variable failed");
                if (valueToPass !== symbol) throw new Error("Assign global variable was accessed in an invalid way!");

            } catch (err) {
                alert(err);
            }
            return true;
        }

        function backChannelAccessor() {
            var tempVal = valueToPass;
            if (tempVal === symbol) {
                throw new Error('Grab web console value function was accessed in an invalid way.  Use the "Grab a value" button to utilize this function');
            }
            valueToPass = symbol;
            return tempVal;
        }



        function watchForNewDocLoad(event) {
            console.log(event);
            var __doc = event.target;
            doCheck();

            function doCheck() {
                if (__doc === __win.document || __console === __win.console || __eval === __win.eval) {
                    if (__doc !== __win.document || __console !== __win.console || __eval !== __win.eval) {
                        alert("Discrepency! :" + (__doc !== __win.document) + "\t" + (__console !== __win.console) + "\t" + (__eval !== __win.eval));
                    }
                    setTimeout(doCheck);

                } else {
                    extractAndOverrideWindowFunctions(__win, false);
                    resizeIframe();
                }
            }
        }
    }

    function installOnDocument(newDocument) {
        //document = document for the web console to reside on.  Typically this document.
        if (newDocument !== undefined) {
            _document = newDocument;

            if (elements.consoleDiv) {
                elements.consoleDiv.remove();
                elements.parentStyleSheet.remove();

            } else if (elements.commandLineContainer || elements.parentStyleSheet) {
                alert();
            }
        }

        if (!elements.consoleDiv) {
            elements.consoleDiv = _document.getElementById("consoleDiv");
            if (!elements.consoleDiv) {
                elements.consoleDiv = _document.body.appendChild(_document.createElement("div"));
                elements.consoleDiv.id = "consoleDiv";
            }
        }

        elements.parentStyleSheet = addStyleSheet(_document);

        elements.consoleDiv.innerHTML = htmlString;
        //settings = {};
        for (var i = 0; i < elements.length; i++) {
            var id = elements[i];
            elements[id] = _document.getElementById(id);
        }

        elements.optionsContainer.remove();

        if (!elements.consoleOutput) {
            elements.consoleOutput = _document.getElementById("consoleOutput");
        }

        for (var chkboxId in disablingCheckboxes) {
            var chkbox = elements[chkboxId];
            chkbox.addEventListener("change", getDisablingFunction(chkbox, disablingCheckboxes[chkboxId]));
        }

        if (!settings) settings = {};

        for (var settingName in settingsFunctions) {
            var elementValueKey = "value"; //needs to be "checked" for checkboxes, "value" for everything else
            if (elements[settingName].tagName.toLowerCase() === "input" && elements[settingName].type.toLowerCase() === "checkbox") elementValueKey = "checked";

            if (settingName in settings) { // custom user value, from cookie, assign this value to the element
                elements[settingName][elementValueKey] = settings[settingName];

            } else {
                settings[settingName] = elements[settingName][elementValueKey]; //use default value taken from HTML element
            }

            settings[settingName] = settingsFunctions[settingName](undefined, settings[settingName]);
            elements[settingName][elementValueKey] = settings[settingName];
            elements[settingName].addEventListener("change", getSettingsOnChangeFunction(settingName, elementValueKey));
        }

        for (var buttonName in buttonFunctions) {
            elements[buttonName].addEventListener("click", buttonFunctions[buttonName]);
        }

        var shortcutButtons = elements.consoleDiv.getElementsByClassName("shortcut");
        for (i = 0; i < shortcutButtons.length; i++) {
            installShortcutButtonClickFunction(shortcutButtons[i]);
        }

        var shortcutParentButtons = elements.consoleDiv.getElementsByClassName("shortcutParent");
        for (i = 0; i < shortcutParentButtons.length; i++) {
            installShortcutParentButtonClickFunction(shortcutParentButtons[i]);
        }

        elements.commandLine.addEventListener("keydown", commandLine);
    }

    function addStyleSheet(doc) {
        var styleSheet = doc.createElement("link");
        styleSheet.setAttribute("rel", "stylesheet");
        styleSheet.setAttribute("type", "text/css");
        styleSheet.setAttribute("href", "/console/console.css");

        var head = doc.getElementsByTagName("head")[0];
        if (!head) head = doc.appendChild(doc.createElement("head"));
        head.appendChild(styleSheet);

        return styleSheet;
    }

    function getDisablingFunction(checkbox, controlsInfo) {
        //for checkboxes which disable other controls depending on their values
        var names = controlsInfo.controls;
        var elementsDisabledByMe = new Array(names.length);
        for (var i = 0; i < names.length; i++) {
            elementsDisabledByMe[i] = elements[names[i]];
        }

        controlsInfo.disableDependents = disableDependents;
        return disableDependents;

        function disableDependents(event) {
            var disable = checkTruthy(checkbox.checked) === controlsInfo.disableWhen;
            for (var j = 0; j < elementsDisabledByMe.length; j++) {
                elementsDisabledByMe[j].disabled = disable;
            }
        }
    }

    function addToOutput(values, entryType) {
        var outputGroup = _document.createElement("div");
        outputGroup.classList.add("console", "group", entryType);

        if (settings.groupOrientation) {
            for (var i = 0; i < values.length; i++) {
                outputGroup.appendChild(createEntry(values[i], entryType));
            }
        } else {
            for (var i = 0; i < values.length; i++) {
                outputGroup.insertBefore(createEntry(values[i], entryType), elements.consoleOutput.children[0]);
            }
        }

        if (settings.consoleOutputOrientation) {
            elements.consoleOutput.insertBefore(outputGroup, elements.consoleOutput.children[0]);

        } else {
            elements.consoleOutput.appendChild(outputGroup);
        }

        return outputGroup;
    }


    function createEntry(value, entryType, onclickContainer) {
        var entry = _document.createElement(TAG_TYPE);
        if (onclickContainer === undefined) onclickContainer = entry;
        onclickContainer.addEventListener("click", sendValue);

        var type = value === null ? "null" : typeof value;
        entry.classList.add("console", type, entryType);

        if (type === "function") {
            functionEntry();

        } else if (type === "object" || value instanceof Object) {
            // trapping document.all wierdness ... object which returns typeof === "undefined" but instanceof Object === true... some strange legacy behavior for backwards compability
            objectEntry(value, entry);

        } else if (type === "number" || type === "boolean" || type === "undefined" || type === "null" || type === "symbol") {
            entry.innerText = String(value);

        } else if (type === "string") {
            stringEntry();
            if (entryType === "command") {
                onclickContainer.addEventListener("click", grabCommand);
                function grabCommand(event) {
                    elements.commandLine.value = value;
                    focusOnCommandLine(event, value.length);
                }
            }

        } else {
            alert("Invalid type: " + type);
        }

        var str = entry.innerText;

        return entry;

        function sendValue(event) { grabValue(event, value, str, entryType, type); }

        function stringEntry() {
            switch (entryType) {
                case "return": case "value":
                    value = "\"" + value + "\""; //only add quotation marks on property values and returns from commands
                    break;

                case "command": case "info":
                    entry.classList.remove(type);
                //no quotes and remove data type designation (these are always implicitly strings, except the window entry when linking... don't need to make the CSS more confusing than it already is)

                case "log": case "error": break; //no quotes but keep type

                default: alert("invalid entry type");
            }

            if (value.length <= LONG_STR_MAX || entryType === "command") {
                entry.innerText = value;

            } else {
                makeCollapsible(value, LONG_STR_MAX, entryType === "return" || entryType === "value");
            }
        }

        function functionEntry() {
            var str = String(value);
            if (str.length < MED_DESC_MAX) {
                entry.innerText = str;

            } else {
                makeCollapsible(str, MED_DESC_MAX, false);
            }
        }

        function makeCollapsible(str, max, addQuote) { //for long strings and functions
            var expanded = true;
            onclickContainer.addEventListener("click", toggle);
            toggle()

            function toggle() {
                if(expanded) {
                    entry.innerText = str.substring(0, max) + "…" + (addQuote ? '"' : "");
                    entry.classList.add("expandable");
                    entry.classList.remove("collapsible");

                } else  {
                    entry.innerText = str;
                    entry.classList.remove("expandable");
                    entry.classList.add("collapsible");
                }
                expanded = !expanded;
            }
        }


        function objectEntry(object, entry) {
            onclickContainer.addEventListener("click", makeProperties);
            var detailsTable; //created upon click expansion.  not actually an html table per se
            var expanded = false;
            //create a short and medium description string for the object

            mediumDescription();
            return;

            function makeProperties() {
                detailsTable = _document.createElement("div");
                detailsTable.classList.add("console", "details");

                var value;
                var nonenums = Object.getOwnPropertyNames(object)

                for (var key in object) {
                    try { value = object[key] } catch (err) { value = err; }
                    makeAndAppendKeyValueEntry(key, value);

                    var index = nonenums.indexOf(key);
                    if (index >= 0) nonenums.splice(index, 1);
                }

                for (index = 0; index < nonenums.length; index++) {
                    try { value = object[nonenums[index]] } catch (err) { value = err; }
                    makeAndAppendKeyValueEntry(nonenums[index], value, true);
                }

                try { proto = Object.getPrototypeOf(object); } catch (err) { value = err; }

                if (proto) makeAndAppendKeyValueEntry("__proto__", proto, true);

                onclickContainer.removeEventListener("click", makeProperties);
                onclickContainer.addEventListener("click", toggle);
                toggle();

                function makeAndAppendKeyValueEntry(key, value, nonenum) {
                    var row = detailsTable.appendChild(_document.createElement("div"));
                    row.classList.add("console", "keyValuePair");

                    var keyEntry = row.appendChild(_document.createElement(TAG_TYPE));
                    keyEntry.innerText = key + ":";
                    if (nonenum) keyEntry.classList.add("console", "key", "nonenum")
                    else keyEntry.classList.add("console", "key");

                    var valueEntry = createEntry(value, "value", row);
                    row.appendChild(valueEntry);
                }
            }

            function toggle() {
                if (expanded) {
                    detailsTable.remove()
                    entry.classList.remove("detailsSpread");

                } else {
                    onclickContainer.insertAdjacentElement("afterend", detailsTable);
                    entry.classList.add("detailsSpread");
                }
                expanded = !expanded;
            }

            function shortDescription(value) {
                //for property-values within a medium description, and the initial inline description of root object
                var type = value === null ? "null" : typeof value;
                var shortDesc = _document.createElement("span");
                shortDesc.classList.add("console", type, "short");
                switch (type) {
                    case "number": case "boolean": case "undefined": case "null": case "symbol":
                        shortDesc.innerText = String(value);
                        return shortDesc;

                    case "string":
                        if (value.length < SHORT_DESC_MAX) shortDesc.innerText = '"' + value + '"';
                        else shortDesc.innerText = '"' + value.substring(0, SHORT_DESC_MAX - 1) + '…"';
                        return shortDesc;

                    case "function":
                        var str = String(value);
                        var paramsEnding = str.indexOf(")");
                        if (paramsEnding <= SHORT_DESC_MAX) shortDesc.innerText = str.substring(0, paramsEnding + 1);
                        else shortDesc.innerText = str.substring(0, SHORT_DESC_MAX) + "…";
                        return shortDesc;

                    case "object":
                        var className = "Object";
                        if ("constructor" in value && "name" in value.constructor && typeof value.constructor.name === "string") className = value.constructor.name;
                        else {
                            try {
                                var proto = Object.getPrototypeOf(value);
                                if ("constructor" in proto && "name" in proto.constructor && typeof proto.constructor.name === "string") className = proto.constructor.name;
                            } catch (err) { }
                        }
                        shortDesc.innerText = className;
                        if (isArrayLike(value)) shortDesc.innerText += "(" + value.length + ")";
                        return shortDesc;
                }
            }

            function isArrayLike(value) {
                try {
                    if (value instanceof Array) return true;
                    if ("length" in value && typeof value.length === "number" && value.length % 1 === 0) {
                        for (var i = 0; i < value.length; i++) {
                            if (!(i in value)) return false;
                        }
                        return true;
                    }
                } catch (err) { } //some window properties were throwing errors when trying to access storage.length
                return false;
            }

            function mediumDescription() {
                //  There are situations where length will exceed max length slightly, but not by much

                if (entryType === "error") entry.innerText = String(object) + "\n";

                entry.appendChild(shortDescription(object));

                var mediumDesc = entry.appendChild(_document.createElement("span"));
                mediumDesc.classList.add("console", "medium");

                var closingChar = "}";
                var previousIndex = 0;
                var value;

                if (isArrayLike(object)) {
                    //array-like object

                    mediumDesc.innerHTML += " [";
                    closingChar = "]"

                    var nonIndexKeys = [];


                    for (var key in object) {
                        var numberKey = Number(key)
                        if (Number.isNaN(numberKey) || (String(numberKey) != key) || (object[key] !== object[numberKey]) || (numberKey % 1 !== 0) || (numberKey < previousIndex)) {
                            nonIndexKeys.push(key);
                            continue;
                        }
                        nonIndexKeys.pop();

                        //fill in skipped indexes
                        if (numberKey - previousIndex > 3) {
                            var emptyEntry = mediumDesc.appendChild(_document.createElement("span"));
                            emptyEntry.innerText = "Empty x " + (numberKey - previousIndex);
                            emptyEntry.classList.add("console", "empty", "short");

                        } else if (numberKey - previousIndex >= 1) {
                            if (previousIndex === 0) mediumDesc.innerHTML += " ";
                            mediumDesc.innerHTML += ", ".repeat(numberKey - previousIndex);
                        }

                        //get current index value
                        try { value = object[key]; } catch (err) { value = err; }
                        if (appendShortDesc(false, value)) return mediumDesc;
                        previousIndex = key;
                    }

                    for (var i = 0; i < nonIndexKeys.length; i++) {
                        mediumDesc.innerHTML += ", ";
                        if (appendShortDesc(nonIndexKeys[i], object[nonIndexKeys[i]])) return mediumDesc;
                    }

                } else {
                    //non-array-like object

                    mediumDesc.innerHTML += " {";
                    for (key in object) {
                        if (previousIndex) mediumDesc.innerHTML += ", ";
                        else previousIndex = true;
                        try { value = object[key]; } catch (err) { value = err; }
                        if (appendShortDesc(key, value)) return mediumDesc;
                    }
                }

                mediumDesc.innerHTML += closingChar;

                return mediumDesc;

                function appendShortDesc(key, value) {
                    //invoker is responsible for adding commas & spaces between key/value pairs
                    // key === false for array indexes, since index keys are not used
                    if (key) {
                        var keyEntry = _document.createElement("span");
                        keyEntry.innerText = key;
                        keyEntry.classList.add("console", "key", "short");
                        mediumDesc.appendChild(keyEntry);
                        mediumDesc.innerHTML += ": "
                    }
                    var valueEntry = shortDescription(value);
                    if (valueEntry.innerText.length + mediumDesc.innerText.length >= MED_DESC_MAX) {
                        valueEntry.innerText = valueEntry.innerText.substring(0, MED_DESC_MAX - mediumDesc.innerText.length);
                        if (valueEntry.innerText !== "") mediumDesc.appendChild(valueEntry);
                        mediumDesc.innerHTML += "…" + closingChar;
                        return true //done
                    }
                    mediumDesc.appendChild(valueEntry);
                    return false; //not done
                }
            }
        }
    }


    function commandLine(event) {
        if (event.which === 13 && !settings.returnAction) {
            event.preventDefault();
            submitCommandLine(event);

        }
    }

    function getFormattedCommand() {
        //reformat string, to replace curly quotes with straight quotes (common on mobile devices)
        return elements.commandLine.value.replace(/(“|”|‘|’)/g, function (q) { return q === "“" || q === "”" ? '"' : "'" });
    }

    function submitCommandLine(event) {
        var statement = getFormattedCommand();

        try {
            consoleFunctions.execute(statement);
        } catch (err) {
            alert(command, err);
        }

        elements.commandLine.value = "";
        if (event.target !== elements.commandLine) focusOnCommandLine(event, 0);

    }

    function clearCommandLine(event) {
        elements.commandLine.value = "";
        focusOnCommandLine(event, 0);
    }

    function focusOnCommandLine(event, selectionStart, selectionEnd) {
        if (selectionStart === undefined) {
            selectionStart = elements.commandLine.selectionStart;
            selectionEnd = elements.commandLine.selectionEnd;

        } else if (selectionEnd === undefined) {
            selectionEnd = selectionStart;
        }

        elements.commandLine.selectionStart = selectionStart;
        elements.commandLine.selectionEnd = selectionEnd;
        elements.commandLine.focus();
    }

    function returnAction(event) {
        if (settings.returnAction = !settings.returnAction) {
            elements.returnAction.classList.add("on");
            elements.returnAction.classList.remove("off");
            elements.returnAction.innerText = String.fromCharCode(8629, 95);
        } else {
            elements.returnAction.classList.add("off");
            elements.returnAction.classList.remove("on");
            elements.returnAction.innerText = String.fromCharCode(8629, 62);
        }
        focusOnCommandLine(event);
    }

    function grab(event) {
        grabValueFlag = !grabValueFlag;
        if (grabValueFlag) {
            elements.grab.innerText = "Grab a console value (press to cancel)";
            elements.grab.classList.add("on");
        } else {
            elements.grab.innerText = "Grab a value";
            elements.grab.classList.remove("on");
        }
    }

    function grabValue(event, value, string, entryType, valueType) {
        //this is the function invoked by the click listeners on the console entries
        if (grabValueFlag) {
            event.stopImmediatePropagation();
            event.preventDefault();

            var variableName = prompt("Enter variable name to assign to this value:\n  Entry Type: " + entryType + "\n  Data Type: " + valueType + "\n  Value: " + string);
            if (variableName !== null) {
                var valid = consoleFunctions.assignGlobalVariable(variableName, value);
                while (!valid) {
                    variableName = prompt("ERROR: INVALID NAME\n  Enter variable name to assign to this value:\n  Entry Type: " + entryType + "\n  Data Type: " + valueType + "\n  Value: " + string);
                    if (variableName === null) break;
                    valid = consoleFunctions.assignGlobalVariable(variableName, value);
                }
                if (valid) consoleFunctions.execute(variableName);
            }
            grab();
            focusOnCommandLine(event);
        }
    }

    function validateVariableName() {
        return true;
    }

    function options() {
        elements.consoleDiv.insertBefore(elements.optionsContainer, elements.consoleOutput);
        elements.options.remove();
    }

    function ok() {
        elements.optionsContainer.remove();
        elements.textButtons.appendChild(elements.options);

        apply();
        focusOnCommandLine();
    }

    function apply() {

    }

    function cancel() {

    }

    function commandLineHeight() {

    }

    function commandLineHeightAuto() {

    }

    function commandLineWidth() {

    }

    function commandLineWidthAuto() {

    }

    function getSettingsOnChangeFunction(settingName, elementValueKey) {
        var func = settingsFunctions[settingName];
        var element = elements[settingName];
        return setNewValue;

        function setNewValue(event) {
            settings[settingName] = func(event, element[elementValueKey]);
            element[elementValueKey] = settings[settingName];
        }
    }

    function createSettingsFunctions() {
        var numberFuncSpecs = {
            commandLineHeight: [null, 1, 1],
            commandLineWidth: [null, 30, 10],
            pageFrameWidth: [null, 600, 0],
            pageFrameHeight: [null, 600, 0],
            consoleFrameWidth: [consoleFrameWidth, 600, 0],
            consoleFrameHeight: [consoleFrameHeight, 600, 0],
        }

        var booleanFuncs = {
            commandLineHeightAuto: commandLineHeightAuto,
            commandLineWidthAuto: commandLineWidthAuto,

            showAll: showAll,
            showValidCommands: showValidCommands,
            showValidReturns: showValidReturns,
            showInvalidCommands: showInvalidCommands,
            showErrorReturns: showErrorReturns,
            showRuntimeErrors: showRuntimeErrors,
            showLogs: showLogs,
            showInfos: showInfos,
            showErrors: showErrors,

            filterEntries: filterEntries,
            filterEntriesForNumbers: filterEntriesForNumbers,
            filterEntriesForBooleans: filterEntriesForBooleans,
            filterEntriesForStrings: filterEntriesForStrings,
            filterEntriesForSymbols: filterEntriesForSymbols,
            filterEntriesForObjects: filterEntriesForObjects,
            filterEntriesForFunctions: filterEntriesForFunctions,
            filterEntriesForUndefined: filterEntriesForUndefined,
            filterEntriesForNull: filterEntriesForNull,
            filterEntriesForCustom: filterEntriesForCustom,

            filterPairs: filterPairs,
            filterPairsForNumbers: filterPairsForNumbers,
            filterPairsForBooleans: filterPairsForBooleans,
            filterPairsForStrings: filterPairsForStrings,
            filterPairsForSymbols: filterPairsForSymbols,
            filterPairsForObjects: filterPairsForObjects,
            filterPairsForFunctions: filterPairsForFunctions,
            filterPairsForUndefined: filterPairsForUndefined,
            filterPairsForNull: filterPairsForNull,
            filterPairsForCustom: filterPairsForCustom,

            pageFrameAutosize: pageFrameAutosize,

            pageFrameLiveResize: pageFrameLiveResize,

            consoleFrameAutosize: consoleFrameAutosize,
            consoleFrameLiveResize: consoleFrameLiveResize,
        }


        var stringFuncs = {
            filterEntriesCustomFunction: filterEntriesCustomFunction,
            filterPairsCustomFunction: filterPairsCustomFunction,

            //orientation
            consoleOrientation: consoleOrientation,
            commandLineOrientation: commandLineOrientation,
            commandLineOrientationDefault: commandLineOrientationDefault,
            consoleOutputOrientation: consoleOutputOrientation,
            consoleOutputOrientationDefault: consoleOutputOrientationDefault,
            groupOrientation: groupOrientation,
            optionsButtonsOrientation: optionsButtonsOrientation,
        }

        for (var func in numberFuncSpecs) {
            var specs = numberFuncSpecs[func];
            var castingFunc = getNumberCastingFunction(func, specs[1], specs[2], specs[3]);

            if (specs[0] === null) settingsFunctions[func] = wrapCastingFunction(castingFunc);
            else if (typeof specs[0] === "function") settingsFunctions[func] = wrapCastingAndActionFunctions(castingFunc, specs[0]);
        }

        for (var func in booleanFuncs) {
            if (booleanFuncs[func] === null) {
                settingsFunctions[func] = wrapCastingFunction(getBooleanCastingFunction(func));
            } else {
                settingsFunctions[func] = wrapCastingAndActionFunctions(getBooleanCastingFunction(func), booleanFuncs[func]);

            }
        }

        for (var func in stringFuncs) {
            if (stringFuncs[func] === null) {
                settingsFunctions[func] = wrapCastingFunction(getStringCastingFunction(func));

            } else {
                settingsFunctions[func] = wrapCastingAndActionFunctions(getStringCastingFunction(func), stringFuncs[func]);
            }
        }
    }

    function wrapCastingFunction(castingFunction) {
        return function (event, value) { return castingFunction(value); }
    }

    function wrapCastingAndActionFunctions(castingFunction, actionFunction) {
        return function (event, value) {
            var castedValue = castingFunction(value);
            var actionReturn = actionFunction(event, castedValue);
            if (actionReturn === undefined) return castedValue;
            else return actionReturn;
        }
    }

    function getNumberCastingFunction(settingName, def, min, max) {
        if (def === undefined) def = 0;
        if (!Number.isFinite(def)) alert("Default number must be a finite value");
        if (Number.isFinite(min)) {
            if (def < min) alert("Default cannot be less than min");

            if (Number.isFinite(max)) {
                if (min > max) alert("Max must be greater than min");
                if (def > max) alert("Default cannot be greater than max");
                return castToNumberWithMinMax;

            } else return castToNumberWithMin;

        } else if (Number.isFinite(max)) {
            if (def > max) alert("Default cannot be greater than max");
            return castToNumberWithMax;

        } else return castToNumber;

        function castToNumber(value) {
            if ((typeof value === "string" && value.trim() === "") || value === null) value = Number.NaN;
            value = Number(value);
            if (Number.isFinite(value)) {
                return value;

            } else {
                value = Number(settings[settingName]);
                if (Number.isFinite(value)) return value;
                else return def;
            }
        }

        function castToNumberWithMinMax(value) { return Math.min(max, Math.max(min, castToNumber(value))); }
        function castToNumberWithMin(value) { return Math.max(min, castToNumber(value)); }
        function castToNumberWithMax(value) { return Math.min(max, castToNumber(value)); }
    }

    function getBooleanCastingFunction(settingName) {
        return function castToBoolean(value) {
            value = checkTruthy(value);
            if (value !== null) return value;
            value = settings[value];
            if (typeof value === "boolean") return value;
            else return false;
        }
    }

    function checkTruthy(value) {
        if (typeof value === "boolean") return value;
        if (typeof value === "string") {
            value = value.toLowerCase();
            if (value === "false" || value === "no") return false;
            if (value === "true" || value === "yes") return true;
        }
        alert("Couldn't determine boolean conversion value of checkbox value: " + value);
        return null;
    }

    function getStringCastingFunction(settingName) {
        return function castToString(value) {
            return String(value);
        }
    }

    function installShortcutButtonClickFunction(button) {
        var string = button.innerText;
        var cursorIndex = string.indexOf(" ");
        if (cursorIndex === -1) {
            cursorIndex = string.length;

        } else {
            string = string.slice(0, cursorIndex) + string.slice(cursorIndex + 1);
            button.innerText = string;
        }

        button.addEventListener("click", onclick);

        function onclick(event) {
            elements.commandLine.dispatchEvent(new CustomEvent("beforeinput", { data: string, inputType: "insertText" })); //for any listeners from shortcutParentButtons
            var start = elements.commandLine.selectionStart;
            elements.commandLine.value = elements.commandLine.value.substring(0, start) + string + elements.commandLine.value.substring(elements.commandLine.selectionEnd);
            focusOnCommandLine(event, start + cursorIndex);
            elements.commandLine.dispatchEvent(new CustomEvent("input", { data: string, inputType: "insertText" })); //for any listeners from shortcutParentButtons
        }
    }

    function installShortcutParentButtonClickFunction(button) {
        var string = button.innerText;
        var insertedIndexStart = null;
        var insertedIndexEnd = null;
        var inactive = true;
        var addOrDelete = true; //true = add, false = delete
        var undoStack = null;
        var redoStack = null;

        var buttonSubDiv = document.getElementById("_" + button.id);
        if (!buttonSubDiv) {
            alert(button.id + " buttonSubDiv could not be found!");
            return;
        }

        var xOut = buttonSubDiv.getElementsByClassName("buttonSubDivXout")[0];
        if (!xOut) {
            alert(button.id + " buttonSubDivXout could not be found!");
            return;
        }

        buttonSubDiv.parentElement.insertBefore(button, buttonSubDiv);

        var children = buttonSubDiv.getElementsByClassName("shortcut");
        for (var i = 0; i < children.length; i++) {
            if (children[i].classList.contains("persist")) continue;
            children[i].addEventListener("click", exit);
        }

        xOut.addEventListener("click", exit);
        buttonSubDiv.remove();

        button.addEventListener("click", onclick);


        function onclick(event) {
            if (insertedIndexStart === null || addOrDelete) {
                if (inactive) {
                    button.parentElement.insertBefore(buttonSubDiv, button);
                    buttonSubDiv.insertBefore(button, buttonSubDiv.children[0]);

                    inactive = false;
                    undoStack = [];
                    redoStack = [];
                    log();
                    undoStack[0].firstEntry = true;

                    elements.commandLine.addEventListener("keydown", watchForEnter);
                    elements.submitCommandLine.addEventListener("click", exit);
                    elements.commandLine.addEventListener("beforeinput", trackCommandLineChanges);
                }


                insertedIndexStart = Math.min(elements.commandLine.selectionStart, elements.commandLine.selectionEnd);
                insertedIndexEnd = insertedIndexStart + string.length;
                elements.commandLine.value = elements.commandLine.value.substring(0, insertedIndexStart) + string + elements.commandLine.value.substring(Math.max(elements.commandLine.selectionStart, elements.commandLine.selectionEnd));

                if (addOrDelete) {
                    button.style.textDecoration = "line-through";
                    addOrDelete = false;

                } else {
                    //is this dead code?????
                    alert("DEAD CODE ACCESSED!")
                    button.style.textDeocration = "";
                    addOrDelete = true;
                }


                log();
                focusOnCommandLine(event, insertedIndexEnd);

            } else {
                if (inactive) throw new Error("cannot delete inserted parent entry while shortcutButtonSubDiv is inactive!");

                var currentCursor = { start: elements.commandLine.selectionStart, end: elements.commandLine.selectionEnd }
                for (var place = "start"; place !== ""; place = place === "start" ? "end" : "") { //in case the Object.prototype was messed with
                    if (currentCursor[place] > insertedIndexEnd) {
                        currentCursor[place] = currentCursor[place] - string.length;
                    } else if (currentCursor[place] > insertedIndexStart) {
                        currentCursor[place] = insertedIndexStart;
                    }
                }

                elements.commandLine.value = elements.commandLine.value.substring(0, insertedIndexStart) + elements.commandLine.value.substring(insertedIndexEnd); // + 1?
                revertButtonState();
                focusOnCommandLine(event, currentCursor.start, currentCursor.end);
            }
        }

        function log(preserveRedo) {
            var le = { start: insertedIndexStart, end: insertedIndexEnd, addOrDelete: addOrDelete, commandLine: elements.commandLine.value };
            //consoleFunctions.log(le);
            undoStack.push(le);
            if(!preserveRedo) redoStack.length = 0;
        }

        function revertButtonState(skipLog) {
            insertedIndexStart = insertedIndexEnd = null;
            addOrDelete = true;
            button.style.textDecoration = "";
            if(!skipLog) log();
        }

        function exit(event) {
            revertButtonState();
            undoStack = null;
            redoStack = null;
            inactive = true;

            elements.commandLine.removeEventListener("keydown", watchForEnter);
            elements.submitCommandLine.removeEventListener("click", exit);
            elements.commandLine.removeEventListener("beforeinput", trackCommandLineChanges);

            buttonSubDiv.parentElement.insertBefore(button, buttonSubDiv);
            buttonSubDiv.remove();
            focusOnCommandLine();
        }

        function watchForEnter(event) {
            if (event.which === 13 && !settings.returnAction) exit(event);
        }

        function trackCommandLineChanges(event) {
            if (event.inputType === "historyUndo") {
                return asyncRestoreState(true);

            } else if (event.inputType === "historyRedo") {
                return asyncRestoreState(false);

            } else if (insertedIndexStart === null || insertedIndexEnd === null || addOrDelete) {
                return asyncLog();
            }

            function asyncRestoreState(undoing) {
                if ((undoing && undoStack.length === 1) || (!undoing && redoStack.length === 0)) {
                    event.preventDefault();
                    return
                }

                elements.commandLine.addEventListener("input", restoreState);

                var popFrom = undoing ? undoStack : redoStack;
                var pushTo = undoing ? redoStack : undoStack;

                function restoreState(event) {
                    elements.commandLine.removeEventListener("input", restoreState);
                    var loggedState;
                    do {
                        if (popFrom.length <= 1) {
                            if (undoing) {
                                elements.commandLine.value = undoStack[0].commandLine;
                                revertButtonState(true);
                                return;

                            } else if (popFrom.length === 0) {
                                loggedState = undoStack[undoStack.length - 1];
                                elements.commandLine.value = loggedState.commandLine;
                                break;
                            }
                        }

                        pushTo.push(popFrom.pop());

                        if (undoStack.length > 0) {
                            loggedState = undoStack[undoStack.length - 1];

                        } else {
                            loggedState = {};
                            if (!undoing) throw new Error("unexpected behavior from undo state restore function");
                            continue;
                        }
                    } while (loggedState.commandLine !== elements.commandLine.value);

                    if (loggedState.start === null && loggedState.end === null && loggedState.addOrDelete) {
                        revertButtonState(true)

                    } else {
                        insertedIndexStart = loggedState.start;
                        insertedIndexEnd = loggedState.end;
                        addOrDelete = loggedState.addOrDelete;
                        button.style.textDecoration = "line-through";
                    }
                }
            }


            var currentCursor = {
                start: Math.min(elements.commandLine.selectionStart, elements.commandLine.selectionEnd),
                end: Math.max(elements.commandLine.selectionStart, elements.commandLine.selectionEnd)
            }

            var eventInputType = event.inputType;
            if (!(typeof eventInputType === "string")) eventInputType = "";
            
            var deleteBackward = !(!eventInputType.match(/^delete\w*Backward/)); //backspace or other backwards-deleting
            var deleteForward = !(!eventInputType.match(/^delete\w*Forward/));
            var deleteGeneral = !(!eventInputType.match(/^delete/));

            if (currentCursor.start >= insertedIndexEnd) {
                if (deleteGeneral) {
                    if (deleteBackward && currentCursor.start === insertedIndexEnd) return asyncRevert();
                    else return elements.commandLine.addEventListener("input", asyncLookBackward);

                } else { //not a delete, doesn't effect the portion of the command line string this function is concerned with
                    return asyncLog();
                }
            }

            //cursor start is somewhere before the end of the inserted index
            if (currentCursor.start >= insertedIndexStart || currentCursor.end > insertedIndexStart) {
                if (currentCursor.start > insertedIndexStart || currentCursor.end > insertedIndexStart || deleteForward) {
                    return asyncRevert();
                }
            }

            return elements.commandLine.addEventListener("input", asyncLookForward);
            

            function asyncLookBackward() {
                elements.commandLine.removeEventListener("input", asyncLookBackward);
                if (elements.commandLine.value.substring(insertedIndexStart, insertedIndexEnd) === string) log();
                else revertButtonState();

            }

            function asyncLookForward() {
                elements.commandLine.removeEventListener("input", asyncLookForward);
                var cursorEndAfterEdit = Math.max(elements.commandLine.selectionStart, elements.commandLine.selectionEnd);
                insertedIndexStart = elements.commandLine.value.substring(cursorEndAfterEdit).indexOf(string);
                if (insertedIndexStart >= 0) {
                    insertedIndexStart += cursorEndAfterEdit;
                    insertedIndexEnd = insertedIndexStart + string.length;
                    log();

                } else {
                    revertButtonState();
                }
            }

            function asyncLog() {
                elements.commandLine.addEventListener("input", callLog);
                function callLog() {
                    elements.commandLine.removeEventListener("input", callLog);
                    log();
                }
            }

            function asyncRevert() {
                elements.commandLine.addEventListener("input", callRevert);
                function callRevert() {
                    elements.commandLine.removeEventListener("input", callRevert);
                    revertButtonState();
                }
            }
        }
    }


    function showAll() {

    }

    function showValidCommands() {

    }

    function showValidReturns() {

    }

    function showInvalidCommands() {

    }

    function showErrorReturns() {

    }

    function showRuntimeErrors() {

    }

    function showLogs() {

    }

    function showInfos() {

    }

    function showErrors() {

    }

    function filterEntries() {

    }

    function filterEntriesForNumbers() {

    }

    function filterEntriesForBooleans() {

    }

    function filterEntriesForStrings() {

    }

    function filterEntriesForSymbols() {

    }

    function filterEntriesForObjects() {

    }

    function filterEntriesForFunctions() {

    }

    function filterEntriesForUndefined() {

    }

    function filterEntriesForNull() {

    }

    function filterEntriesForCustom() {

    }

    function filterEntriesCustomFunction() {

    }

    function filterPairs() {

    }

    function filterPairsForNumbers() {

    }

    function filterPairsForBooleans() {

    }

    function filterPairsForStrings() {

    }

    function filterPairsForSymbols() {

    }

    function filterPairsForObjects() {

    }

    function filterPairsForFunctions() {

    }

    function filterPairsForUndefined() {

    }

    function filterPairsForNull() {

    }

    function filterPairsForCustom() {

    }

    function filterPairsCustomFunction() {

    }

    function pageFrameAutosize() {

    }

    function pageFrameWidth() {

    }

    function pageFrameHeight() {

    }

    function pageFrameHover() {

    }

    function pageFrameLiveResize() {

    }

    function consoleFrameAutosize(event, value) {
        if (value === true) {
            var viewport = getViewportSize();
            elements.consoleOutput.style.height = (viewport.height - 2) + "px";
            elements.consoleOutput.style.width = ""; //default to style-sheet

        } else if (event) {
            consoleFrameWidth(false, settings.consoleFrameWidth);
            consoleFrameHeight(false, settings.consoleFrameHeight);
        }
    }

    function consoleFrameWidth(event, value) {
        if (event && settings.consoleFrameAutosize) {
            consoleFrameAutosize(false, true);

        } else {
            elements.consoleOutput.style.width = value + "px";

        }
    }

    function consoleFrameHeight(event, value) {
        if (event && settings.consoleFrameAutosize) {
            consoleFrameAutosize(false, true);

        } else {
            elements.consoleOutput.style.height = value + "px";

        }
    }

    function consoleFrameHover() {

    }

    function consoleFrameLiveResize() {

    }

    function consoleOrientation() {

    }

    function commandLineOrientation() {

    }

    function commandLineOrientationDefault() {

    }

    function consoleOutputOrientation() {

    }

    function consoleOutputOrientationDefault() {

    }

    function groupOrientation() {

    }

    function optionsButtonsOrientation() {

    }


};