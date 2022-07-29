"use strict"; document.currentScript.initTime = performance.now();

class UI {
    constructor(canvas, targetObject) {
        this.canvas = canvas;
        this.object = targetObject;
        this.context = canvas.getContext("2d");

        if (!this.context) {
            alert("no rendering context"); console.log(canvas);
        }

        this.listeners = new Array();

        canvas.redraw = (context = this.context) => this.object?.draw?.(context);

        if (targetObject) this.installNewTargetObject(targetObject);
    }

    addDefaultListeners(object = this.object) { //object with the normal pointer functions, listed below
        this.canvas.ondragstart = () => { return false; }

        let i = this.listeners.length;

        this.listeners.push([POINTER_OVER, this.object.pointerover?.bind(object)]);
        this.listeners.push([POINTER_MOVE, this.object.pointermove?.bind(object)]);
        this.listeners.push([POINTER_DOWN, this.object.pointerdown?.bind(object)]);
        this.listeners.push([POINTER_UP, this.object.pointerup?.bind(object)]);
        this.listeners.push([POINTER_OUT, this.object.pointerout?.bind(object)]);
        this.listeners.push([POINTER_CANCEL, this.object.pointercancel?.bind(object)]);

        let keydown = ["keydown", this.object.keydown?.bind(object)];
        let keyup = ["keyup", this.object.keyup?.bind(object)];
        keydown.target = window;
        keyup.target = window;

        this.listeners.push(keydown, keyup)

        for (; i < this.listeners.length; i++) {
            if (this.listeners[i][1] === undefined) {
                this.listeners.splice(i--, 1);

            } else {
                if (!("target" in this.listeners[i])) this.listeners[i].target = this.canvas;
                this.listeners[i].target.addEventListener(...this.listeners[i]);
            }
        }
    }

    removeListener(name) { //convienence method
        let found = false;
        for (; i < this.listeners.length; i++) {
            if (listeners[i][0] === name) {
                this.listeners[i].target.removeEventListener(...listeners[i]);
                this.listeners.splice(i, 1);
                i--;
                found = true;
            }
        }
        if(!found) throw new Error("listener with submitted name was not found!");
    }

    removeListeners() { //removes all current listeners managed by this ui object
        this.listeners.forEach((listener) => {
            listener.target.removeEventListener(...listener);
        });
        this.listeners.length = 0;
    }

    addListener(name, func) {
        this.canvas.addEventListener(name, func);
        this.listeners.push([name, func]);
    }

    installNewTargetObject(targetObject, drawImmediately = true) {
        this.removeListeners();
        this.object?.resetPointerFlags?.();


        if (this.context && (this.object?.context === this.context)) this.object.context = undefined;
        this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);

        this.object = targetObject;
        if (targetObject) {
            targetObject.ui = this;
            targetObject.canvas = this.canvas;
            targetObject.context = this.context;
            this.addDefaultListeners();
            if (drawImmediately) {
                if (typeof targetObject.draw === 'function') targetObject.draw(this.context);
                else console.error('Unexpected UI.targetObject with no draw function', this, targetObject);
            }
        }

        UI.doublePointerListener?.resetFlags?.();
    }

    static outputWindowStyling() {
        let boardRect = UI.board.canvas.getBoundingClientRect();
        let editorRect = UI.editor.canvas.getBoundingClientRect();
        console.log("Board canvass bounding client rect: " + ObjectReflector.stringify(boardRect));
        console.log("Editor canvass bounding client rect: " + ObjectReflector.stringify(editorRect));
        /*try {
            downloadStringToLocal("window.json", ObjectReflector.stringify(window));
        } catch (err) {
            console.log(err);
        }*/
        
    }

}

UI.for = (function() {
    let canvases = [...document.getElementsByClassName('board')];
    let UIs = [];
    for(let canvas of canvases) {
        if(canvas.tagName !== 'CANVAS') throw new Error();
    }

    UIs[0] = UI.board = new UI(canvases[0]);

    return function(canvas) {
        if (!(canvas instanceof HTMLCanvasElement)) throw new Error();
        let index = canvases.indexOf(canvas);
        if (index === -1) throw new Error();
        return UIs[index] ??= new UI(canvas);
    }
})();



class Button {
    constructor(text, objectToDraw, functionOnClick, width = "", height = "") {
        let htmlButton = document.createElement("button");
        let canvas = document.createElement("canvas");
        let context = canvas.getContext("2d");
        let textSpan = htmlButton.appendChild(document.createElement("span"));

        if(functionOnClick !== undefined) this.onClick = functionOnClick;

        defineProperties(this, {
            width: {
                set: (value) => {
                    if (Number.isFinite(value)) value = value + "px";
                    this.htmlButton.style.width = value;
                },
                get: () => {
                    let computedStyle = getComputedStyle(htmlButton);
                    let width = Number.parseFloat(computedStyle.width);
                    if (!Number.isFinite(width)) width = computedStyle.width;
                    return width;
                },
            },
            height: {
                set: function (value) {
                    if (Number.isFinite(value)) value = value + "px";
                    this.htmlButton.style.height = value;
                },
                get: () => {
                    let computedStyle = getComputedStyle(htmlButton);
                    let height = Number.parseFloat(computedStyle.height);
                    if (!Number.isFinite(height)) height = computedStyle.height;
                    return height;
                },
            },
            htmlButton: { get: () => htmlButton },
            text: {
                set: (value) => textSpan.innerHTML = String(value ?? ""),
                get: () => textSpan.innerHTML,
            },
            textSpan: { get: () => textSpan },
            objectToDraw: {
                set: (value) => {
                    if (!value) {
                        objectToDraw = null;
                        this.canvas.remove();

                    } else if (value.drawAt instanceof Function) {
                        if (objectToDraw !== (objectToDraw = value)) {
                            if (canvas.parentElement !== htmlButton) htmlButton.insertBefore(canvas, textSpan);
                            canvas.width = objectToDraw.width;
                            canvas.height = objectToDraw.height;

                            objectToDraw.drawAt(0, 0, context);
                        }

                    } else throw new Error("objectToDraw must have drawAt as a function!");
                },
                get: () => objectToDraw,
            },
            canvas: { get: () => canvas },
            context: { get: () => context },
            onClick: {
                set: func => {
                    if (typeof func === 'function') {
                        functionOnClick = func;

                    } else if (func === undefined || func === null) {
                        functionOnClick = null;

                    } else throw new Error("onClick must be a function or set to undefined/null!");
                },
                get: () => functionOnClick,
                configurable: true,
            },
            draw: {
                value: () => {
                    if (objectToDraw) {
                        context.clearRect(0, 0, canvas.width, canvas.height);
                        objectToDraw.drawAt(0, 0, context);
                    }
                },
            }
        });

        canvas.redraw = this.draw;

        this.text = text;
        this.width = width;
        this.height = height;

        htmlButton.addEventListener("click", (event) => this.onClick(event));


        //apply setters to initial values

        let errs = [];

        try { this.onClick = functionOnClick; } catch (err) { errs.push(err); }
        try {
            let temp = objectToDraw;    //this is to trick the setter function into adding the canvas if there is an objectToDraw
            objectToDraw = null;
            this.objectToDraw = temp;

        } catch (err) { errs.push(err); }

        if (errs.length > 0) {
            if (errs.length === 1) throw errs[0];
            else throw errs;
        }
    }
}

/*
Button.default_restingColor = LIGHT_PEACH;
Button.default_hoverColor = PEACH;
Button.default_depressedColor = LIGHT_ORANGE;
Button.default_cancelColor = LIGHT_ROSE;
Button.default_borderColor = BROWN;
Button.default_borderThickness = 5;
Button.default_cornerRadius = 30;
*/


class SelectionButton extends Button {
    constructor(selectionGroup, text, objectToDraw, functionOnSelect, width, height) {
        super(text, objectToDraw, selectionButtonOnClick, width, height);

        let controllerFunctionFromGroup;
        let isSelected = false;

        defineProperties(this, {
            selectionGroup: {
                set: (value) => {
                    if (selectionGroup && selectionGroup !== value) selectionGroup.__removeButton(this, changeSelectionStatus);

                    if (value instanceof SelectionButtonGroup) {
                        selectionGroup = value;
                        controllerFunctionFromGroup = selectionGroup.__newButton(this, changeSelectionStatus);
                    } else {
                        selectionGroup = null;
                        controllerFunctionFromGroup = null;
                        if (value !== undefined && value !== null)
                            throw new Error("selectionGroup must be an instanceof SelectionButtonGroup");
                    }
                },
                get: () => selectionGroup,
                configurable: true,
            },
            onClick: {
                get: () => selectionButtonOnClick,
                configurable: true,
            },
            onSelect: {
                set: (value) => {
                    if (typeof value === "function") {
                        functionOnSelect = value;

                    } else if (value === undefined || value === null) {
                        functionOnSelect = null;

                    } else {
                        throw new Error("onSelection must be a function, or null/undefined to default to the group's onSelection function");
                    }
                },
                get: () => (typeof functionOnSelect === "function") ? functionOnSelect : (selectionGroup ? selectionGroup.defaultOnSelectFunction : null),
                configurable: true,
            },
            isSelected: {
                get: () => isSelected,
            },
        });

        let errs = []
        try { this.selectionGroup = selectionGroup; } catch (err) { errs.push(err); }
        try { this.onSelect = functionOnSelect; } catch (err) { errs.push(err); }
        if (errs.length > 0) {
            if (errs.length === 1) throw errs[0]; 
            else throw errs;
        }

        function selectionButtonOnClick(event) {
            controllerFunctionFromGroup(event);
        }

        const htmlButton = this.htmlButton;
        function changeSelectionStatus(newStatus) {
            //invoked by the group's controller function
            if (isSelected = newStatus) { //assignment intended
                htmlButton.classList.add("selected");

            } else {
                htmlButton.classList.remove("selected");
            }
        }
    }
}

class SelectionButtonGroup {
    constructor(texts, objectsToDraw, defaultOnSelectFunction) {
        if (typeof defaultOnSelectFunction !== "function") defaultOnSelectFunction = dummyDefaultSelectionFunction;
            //NOTE: WILL THROW ERRORS IF THIS FUNCTION IS INVOKED

        let htmlDiv = document.createElement("div");

        let buttons = new Array(); // parallel arrays
        let changeSelectionStatusFunctions = new Array();
        let currentButton = null;
        let currentSelectionStatusFunc = false;

        defineProperties(this, {
            __newButton: { get: () => newButton, enumerable: false },
            __removeButton: { get: () => removeButton, enumerable: false },
            buttons: { get: () => [...buttons] },
            htmlDiv: { get: () => htmlDiv },
            currentButton: {
                set: (button) => {
                    if (button !== null && button !== undefined) {
                        let index = buttons.indexOf(button);
                        if (!(index >= 0)) {
                            for (let i = 0; i < buttons.length; i++) {
                                if (buttons[i].htmlButton === button) {
                                    button = buttons[i];
                                    index = i;
                                    break;
                                }
                            }
                            if (!(index >= 0)) throw new Error("This button is not a current button!");
                        }

                        if (currentSelectionStatusFunc) currentSelectionStatusFunc(false);
                        changeSelectionStatusFunctions[index](true);
                        currentButton = button;
                        currentSelectionStatusFunc = changeSelectionStatusFunctions[index];

                    } else {
                        if (currentSelectionStatusFunc) currentSelectionStatusFunc(false);
                        currentButton = null;
                        currentSelectionStatusFunc = false;

                    }
                },
                get: () => currentButton,
                configurable: true,
            },
            defaultOnSelectFunction: {
                set: (value) => {
                    if (typeof value !== "function") {
                        defaultOnSelectFunction = null;
                        throw new Error("selectionFunction must be a function");
                    }
                    defaultOnSelectFunction = value;
                },
                get: () => defaultOnSelectFunction,
                configurable: true,
            },
        });


        this.defaultOnSelectFunction = defaultOnSelectFunction;

        try { texts = [...texts]; }
        catch (err) { texts = new Array(); }

        try { objectsToDraw = [...objectsToDraw]; }
        catch (err) { objectsToDraw = new Array(); }

        let length = Math.max(texts.length, objectsToDraw.length);
        for (let i = 0; i < length; i++) {
            new SelectionButton(this, texts[i], objectsToDraw[i], null);
        }


        function newButton(selectionButton, changeSelectionStatusFunc) {
            if (!(selectionButton instanceof SelectionButton)) throw new Error("selectionButton must be an instance of SelectionButton")
            if (typeof changeSelectionStatusFunc !== "function") throw new Error("changeSelectionStatusFunc must be a function");
            let index = buttons.indexOf(selectionButton);
            if (index >= 0) {
                removeButton(buttons[index], changeSelectionStatusFunctions[index]);
            }
            htmlDiv.appendChild(selectionButton.htmlButton);
            index = buttons.push(selectionButton);
            changeSelectionStatusFunctions.push(changeSelectionStatusFunc);
            return createControllerFunction(selectionButton, changeSelectionStatusFunc);
        }

        function removeButton(selectionButton, changeSelectionStatusFunc) {
            let index = buttons.indexOf(selectionButton);
            if (index < 0) throw new Error("selectionButton is not part of the current button array");
            if (changeSelectionStatusFunctions[index] !== changeSelectionStatusFunc) throw new Error("changeSelectionStatusFunc does not match up!");
            selectionButton.htmlButton.remove();
            buttons.splice(index, 1);
            changeSelectionStatusFunctions.splice(index, 1);
        }

        function createControllerFunction(button, changeSelectionStatusFunc) {
            return function controllerFunction(event) {
                if (button.onSelect.call(button, event) !== false) { //returning false from the button.onSelection suppresses the change of currentSelection
                    if (button !== currentButton) {
                        if (currentSelectionStatusFunc) currentSelectionStatusFunc(false);
                        changeSelectionStatusFunc(true);
                        currentButton = button;
                        currentSelectionStatusFunc = changeSelectionStatusFunc;
                    }
                }
            }
        }

        function dummyDefaultSelectionFunction(event) {
            /*this is the default function taken by each button element, in the individual button's constructor,
             *this function should be overriden at the constructor of SelectionButtonGroup, or in a subclass implementation
             * also, individual buttons can have custom 'onSelection' functions assigned to them
             */
            console.log(this);
            throw new Error("must assign a selection function for the SelectionButtonGroup!");
        }
    }
}

class TabButton extends SelectionButton {
    constructor(tabGroup, text, objectToDraw, div, functionOnSelect, width, height) {
        super(tabGroup, text, objectToDraw, functionOnSelect, width, height);

        const superOnClick = Object.getOwnPropertyDescriptor(this, "onClick");
        const superOnSelect = Object.getOwnPropertyDescriptor(this, "onSelect");
        const superSelectionGroup = Object.getOwnPropertyDescriptor(this, "selectionGroup");
        let useSuperOnSelect = true;

        defineProperties(this, {
            onClick: {
                get: () => overrideOnClick,
                configurable: true,
            },
            onSelect: {
                set: superOnSelect.set,
                get: () => useSuperOnSelect ? superOnSelect.get() : overrideOnSelect,
                configurable: true,
            },
            div: {
                get: () => div,
                set: (value) => {
                    if (value?.tagName?.toLowerCase?.() === "div") div = value;
                    else if (value === undefined || value === null) div = null;
                    else throw new Error("tabButton.div must be of element tagName type 'div', or null/undefined");
                },
                configurable: true
            },
            selectionGroup: {
                get: superSelectionGroup.get,
                set: (value) => {
                    if (value && !(value instanceof TabButtonGroup)) throw new Error("selectionGroup must be instanceof TabButtonGroup");
                    superSelectionGroup.set(value);
                }
            }
        });

        let errs = [];

        try { this.div = div; } catch (err) { errs.push(err); }
        try { this.selectionGroup = tabGroup; } catch (err) { errs.push(err); }

        if (errs.length > 0) {
            if (errs.length === 1) throw errs[0];
            else throw errs;
        }


        function overrideOnClick(event) {
            useSuperOnSelect = false;
            superOnClick.get()(event);
        }

        function overrideOnSelect(event) {
            useSuperOnSelect = true;
            let onSelectFunction = superOnSelect.get();
            if (onSelectFunction !== overrideOnSelect) {
                if (onSelectFunction?.call(this, event) === false) return false;
            }
            tabGroup.__changeDiv(this);
        }
    }
}


class TabButtonGroup extends SelectionButtonGroup {
    constructor(texts, objectsToDraw, divs, defaultOnSelectFunction) {
        super(undefined, undefined, defaultOnSelectFunction);

        const superCurrentButton = Object.getOwnPropertyDescriptor(this, "currentButton");
        let div = null;

        defineProperties(this, {
            currentButton: {
                get: superCurrentButton.get,
                set: (value) => {
                    superCurrentButton.set(value);
                    changeDiv(value);
                }
            },
            currentDiv: {
                get: () => div,
            },
            __changeDiv: {
                get: () => changeDiv,
            }
        });



        const changeDiv = (button) => {
            if (!this.buttons.includes(button)) throw new Error("Passed button argument does not exist within this TabButtonGroup");

            let newDiv = button.div;

            if (div === newDiv) return;
            if (div !== null) div.remove();
            
            if (newDiv && newDiv?.tagName?.toLowerCase?.() === "div") {
                div = this.htmlDiv.appendChild(newDiv); //this.htmlDiv.insertAdjacentElement("afterend", newDiv);

            } else {
                div = null;
                if (newDiv !== undefined && newDiv !== null) throw new Error("tabButton.div must be of element tagName type 'div', or null/undefined");
            }
        }

        try { texts = [...texts]; }
        catch (err) { texts = new Array(); }

        try { objectsToDraw = [...objectsToDraw]; }
        catch (err) { objectsToDraw = new Array(); }

        try { divs = [...divs]; }
        catch (err) { divs = new Array(); }

        let length = Math.max(texts.length, objectsToDraw.length, divs.length);
        for (let i = 0; i < length; i++) {
            new TabButton(this, texts[i], objectsToDraw[i], divs[i]);
        }
    }
}



/*
UI.editor.installNewTargetObject(playtimeButtons);

UI.editor.canvas.remove();

let restartButton = document.getElementsByTagName("main")[0].appendChild(document.createElement("button"));
restartButton.onclick = playtimeButtons.objects[1].onClick;
restartButton.innerText = "Restart Game";
*/


/*
 
//resetScatter(); //NOTE: TO USE SCATTER BUTTON, THIS LINE NEEDS TO BE MOVED BACK TO 'run.js', AFTER THE BOARD IS CONSTRUCTED
 
let scatter = new Button("SCATTER BALLS", new Rectangle(25, 15, 150, 70), () => {
    if (scatter.timer <= 0 || Number.isNaN(scatter.timer)) { //start countdown
        scatter.timer = 3;
        scatterCountdown();
    } else { // cancel countdown
        scatter.timer = Number.NaN;
        scatter.text = "SCATTER BALLS";
        scatter.draw();
    }
});

(new UI(document.getElementById("button1"), scatter)).addDefaultListeners();


function resetScatter() {

    scatter.timer = 3;
    scatter.onClick(); //causes SCATTER BALLS button to reset appearance

    board.engine.addToQueue("afterTermination", resetScatter)
};


function scatterCountdown() {
    if (scatter.timer <= 0) {
        board.activeBalls.forEach((ball, index) => {
            if (ball.x >= board.width) ball.x = 399;
            if (ball.x <= board.x) ball.x = board.x + 1;
            if (ball.y <= board.y) ball.y = board.y - 1;
            ball.direction.degrees = (Math.random() + Math.random() + Math.random() + Math.random()) * 90 + 90;
            ball.updateVectorDirection();
            ball.collisionSurfaces.length = 0;
            ball.intersectionsCache.findNextCollision();
        })
        scatter.text = "SCATTER BALLS";
        scatter.draw();
    } else if (Number.isNaN(scatter.timer)) {
        scatter.timer = 0;
    } else {
        scatter.text = "COUNTDOWN: " + Math.round(scatter.timer * 10) / 10;
        scatter.draw();
        scatter.timer -= board.engine.frameSeconds;
        board.engine.addToQueue("beforeDraw", scatterCountdown);
    }
}
*/

initializeLogger?.("ui ran");