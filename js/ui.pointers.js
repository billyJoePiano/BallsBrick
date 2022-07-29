"use strict"; document.currentScript.initTime = performance.now();

const POINTER_TYPE = (function determineDevicePointerType() {
    if (window.onpointerdown === null) return "pointer";
    else if (window.ontouchstart === null) return "touch";
    else console.error("Cannot determine pointer type");
})();


const POINTER_OVER = POINTER_TYPE + "over";
const POINTER_MOVE = POINTER_TYPE + "move";
const POINTER_DOWN = POINTER_TYPE === "pointer" ? "pointerdown" : "touchstart";
const POINTER_UP = POINTER_TYPE === "pointer" ? "pointerup" : "touchend";
const POINTER_OUT = POINTER_TYPE + "out";
const POINTER_CANCEL = POINTER_TYPE + "cancel";


class ClickableObject extends ObjectWithRectangle {
    /* ui interface for buttons, board editor, etc, that simplifies the pointer events
     * maintains 'this.pointerFlags' object
     * sub-classes should implement the following methods:
     * pointerEvent(event) for when the status of a pointerFlag OTHER THAN POSITION has changed
     * pointerMove(event) for when the pointerMoves but no flags have changed
     * click(event) for when the object is fully clicked,
     *   ...meaning a pointer is depressed and released both while 'hovering' over the object,
     *   AND there are no other pointers depressed over the window (see double pointer listener function below the class declaration)
     */
    constructor(rectangle, click, pointerEvent, pointerMoved) {
        super(rectangle);
        if (click) this.click = click;
        if (pointerEvent) this.pointerEvent = pointerEvent;
        if (pointerMoved) this.pointerMoved = pointerMoved;

        this.pointerFlags = {
            position: new Position(),
            depressedPointers: [],
            hoverPointers: [],
            hover: false,
            cancelPossible: false,
            depressed: false,
            depressedAndOver: false,
            escapeFromClick: false,
            clickPending: false,
            //rectangle: optional rectangle installed by implementing sub-class, to use in leui of the ObjectWithRectangle's main rectangle
        }
        this.pointerFlags.position.x = undefined;
        this.pointerFlags.position.y = undefined;

        //this.cancelPointers = []; //for debugging, delete when done
    }


    logEvent(event) { console.log(event.type + "        offset: (" + event.offsetX + " , " + event.offsetY + ")   client: (" + event.clientX + " , " + event.clientY + ")    document: "); }

    updateHoverFlag(event) {
        if (!("offsetX" in event)) { //polyfill for older mobile-device touch events without an offsetX
            event.offsetX = event.pageX - event.target.clientLeft;
            event.offsetY = event.pageY - event.target.clientTop;
        }

        if (event.type === POINTER_OUT) return this.pointerFlags.hoverPointers[event.pointerId] !== (this.pointerFlags.hoverPointers[event.pointerId] = false);
        return this.pointerFlags.hoverPointers[event.pointerId] !== (this.pointerFlags.hoverPointers[event.pointerId] = (this.pointerFlags.rectangle ?? this.rectangle).inside(event.offsetX, event.offsetY));
    }
    updatePointerFlags(event) { //updates the values, and returns true if changed, false if stayed the same
        let changed = this.updateHoverFlag(event);
        let hover = false;
        let cancelPossible = false;
        let depressed = false;
        let depressedAndOver = false;

        let keys = [];
        for (let key in this.pointerFlags.hoverPointers) { keys.push(key); }
        for (let key in this.pointerFlags.depressedPointers) { if (!keys.includes(key)) keys.push(key); }

        for (let i of keys) {
            hover = hover || Boolean(this.pointerFlags.hoverPointers[i]);
            cancelPossible = cancelPossible || Boolean(this.pointerFlags.depressedPointers[i] && !this.pointerFlags.hoverPointers[i]);
            depressed = depressed || Boolean(this.pointerFlags.depressedPointers[i]);
            depressedAndOver = depressedAndOver || Boolean(this.pointerFlags.depressedPointers[i] && this.pointerFlags.hoverPointers[i]);
        }
        if (this.pointerFlags.escapeFromClick) {
            if (!depressed) {
                //reset escapeFromClick flag
                //this.cancelPointers.push("(" + event.pointerId + " " + event.type + ")");

                this.pointerFlags.escapeFromClick = "reset pending"; //still truthy

                setTimeout(() => {
                    if (!this.pointerFlags.depressed && this.pointerFlags.escapeFromClick === "reset pending") {
                        this.pointerFlags.escapeFromClick = false;
                    }
                });
                //changed = true; //??? probably not ???
            } else depressed = cancelPossible = depressedAndOver = false;
        }

        changed = this.pointerFlags.hover       !==      (this.pointerFlags.hover = hover)                          || changed;  //'changed' must be on the right-hand side of the 'or' operator to ensure that the first expression (which includes an assignment) is evaluted
        changed = this.pointerFlags.cancelPossible  !==  (this.pointerFlags.cancelPossible = cancelPossible)        || changed;
        changed = this.pointerFlags.depressed     !==    (this.pointerFlags.depressed = depressed)                  || changed;
        changed = this.pointerFlags.depressedAndOver !== (this.pointerFlags.depressedAndOver = depressedAndOver)    || changed;
        if (hover) {
            this.pointerFlags.position.x = event.offsetX;
            this.pointerFlags.position.y = event.offsetY;
        } else {
            this.pointerFlags.position.x = undefined;
            this.pointerFlags.position.y = undefined;
        }
        return changed;
    }

    pointerover(event) { if (this.updatePointerFlags(event)) this.pointerEvent?.(event); }
    pointerout(event) {
        const THIS = this;
        if (this.pointerFlags.clickPending) setTimeout(doPointeroutEvents);
        else doPointeroutEvents();

        function doPointeroutEvents() {
            //console.info(POINTER_OUT);
            let changed = THIS.updatePointerFlags(event);
            THIS.pointerFlags.position.x = undefined;
            THIS.pointerFlags.position.y = undefined;
            if (changed) THIS.pointerEvent?.(event);
        }
    }
    pointermove(event) {
        let changed = this.updatePointerFlags(event);
        if (changed) this.pointerEvent?.(event);
        else this.pointerMoved?.(event);

        /*let changed = this.updateHoverFlag(event);
        if (this.pointerFlags.hoverPointers[event.pointerId]) this.pointerMoved?.(event);
        if (this.updatePointerFlags(event) || changed) this.pointerEvent?.(event);*/
    }

    pointerdown(event) { //with pointer capture... may want a version of this function without pointer capture
        let changed = this.updateHoverFlag(event);
        if (this.pointerFlags.hoverPointers[event.pointerId]) {
            this.pointerFlags.depressedPointers[event.pointerId] = true;
            event.currentTarget.setPointerCapture?.(event.pointerId);
            this.updatePointerFlags(event);
            this.pointerEvent?.(event);
        } else if (this.updatePointerFlags(event) || changed) {
            this.pointerEvent?.(event);
        }
    }

    pointerup(event) {
        if (this.pointerFlags.depressedPointers[event.pointerId] !== (this.pointerFlags.depressedPointers[event.pointerId] = false) && !this.pointerFlags.escapeFromClick) {
            this.updatePointerFlags(event)
            if (this.pointerFlags.hoverPointers[event.pointerId] && !this.pointerFlags.depressed) {
                if (!this.pointerFlags.escapeFromClick) {
                    this.pointerFlags.clickPending = true;
                    return setTimeout(() => {
                        //timeout should allow cancel events to come through, which seem to occur synchronously immedately AFTER pointerup events
                        this.pointerFlags.clickPending = false;

                        //console.info(POINTER_UP);

                        if (!this.pointerFlags.escapeFromClick) this.click?.(event);
                        else this.pointerEvent?.(event); // might be weird to call it here, defferred?
                    });
                }
            }

            this.pointerEvent?.(event);
        } else {
            //console.error("This pointer has come up twice without coming back down!?  or never came down in the first place? (possibly due to resetPointerFlags?)", event);
            if (this.updatePointerFlags(event)) this.pointerEvent?.(event);
        }
    }

    pointercancel(event) {
        //this.logEvent(event);
        this.pointerFlags.depressedPointers[event.pointerId] = false;
        this.pointerFlags.escapeFromClick = true;
        this.updatePointerFlags(event)
        this.pointerEvent?.(event);
    }

    escapeFromClick() {
        this.pointerFlags.depressed = this.pointerFlags.depressedAndOver = this.pointerFlags.cancelPossible = false;
        this.pointerFlags.escapeFromClick = true;
        //trigger event?  Maybe not... there's no event to pass, and the sub-class should have called this method to begin with, so should handle that itself
    }

    resetPointerFlags() {
        for (let pointerId in this.pointerFlags.depressedPointers) {
            delete this.pointerFlags.depressedPointers[pointerId];
        }

        for (let pointerId in this.pointerFlags.hoverPointers) {
            delete this.pointerFlags.depressedPointers[pointerId];
        }

        this.pointerFlags.hover = false;
        this.pointerFlags.cancelPossible = false;
        this.pointerFlags.depressed = false;
        this.pointerFlags.depressedAndOver = false;
        this.pointerFlags.escapeFromClick = false;
        this.pointerFlags.clickPending = false;
        this.pointerFlags.position.x = undefined;
        this.pointerFlags.position.y = undefined;

        //this.cancelPointers = []; //for debugging, delete when done
    }
}

UI.doublePointerListener = new (function DoublePointerListener() {
    //for mobile/touchscreen devices -- triggers 'escapeFromClick' on the board (and enables scrolling) if two pointers are depressed at once
    if (!(navigator.maxTouchPoints >= 2 || navigator.userAgent.toLowerCase().indexOf("mobile") > -1 || window.touchstart === null)) {
        return window.addEventListener("blur", clearCanvasObjPointerFlags); //only function for both desktop & mobile (mobile invokes indirectly via blur() )
    }

    let boardPointers = [];
    let windowPointers = [];
    let cancelledSinceAllPointersUp = false;

    let boardCanvas = document.getElementsByClassName("board")[0];
    // this is to ensure that these listeners get the events BEFORE the normal listeners
    // otherwise bubble order means they will get it last (window comes last in bubble order)
    boardCanvas.addEventListener(POINTER_DOWN, pointerdownBoard);
    boardCanvas.addEventListener(POINTER_UP, pointerupBoard);
    boardCanvas.addEventListener(POINTER_CANCEL, pointerupBoard);

    //window listeners are to ensure that pointers which come down outside of the board are included in the checking for double-pointers
    window.addEventListener(POINTER_DOWN, pointerdownWin);
    window.addEventListener(POINTER_UP, pointerupWin);
    window.addEventListener(POINTER_CANCEL, pointerupWin);
    window.addEventListener("blur", blur);

    defineProperties(this, {
        boardPointers: {
            get: () => [...boardPointers]
        },
        windowPointers: {
            get: () => [...windowPointers]
        },
        resetFlags: {
            value: () => setTimeout(() => setTimeout(() => clearDoublePointerListenerFlags()))
        }
    });

    document.body.style.overflow = "hidden";


    function pointerdownBoard(event) {
        boardPointers.push(event.pointerId);
        pointerdown(event, false);
    }

    function pointerdownWin(event) {
        windowPointers.push(event.pointerId);
        pointerdown(event, true);
    }

    function pointerdown(event, windowEvent) {
        let totalCount = windowPointers.length + boardPointers.length
            - windowPointers.reduce((overlapCount, pointer) => overlapCount + boardPointers.includes(pointer) ? 1 : 0, 0);
        //  ^^^ docPointers being the caller makes sure totalCount > 1 when two pointers of same id are down, ON BOARD EVENT (instead of waiting until window event)
        // this is important for ensuring proper invoking of escapeFromClick

        if (event.type.indexOf("touch") > -1 && totalCount <= 1) totalCount = event.touches.length;
        //polyfill for touch events

        if (totalCount > 1 && !cancelledSinceAllPointersUp) {
            document.body.style.overflow = ""; //enable scrolling
            cancelledSinceAllPointersUp = true;

            if (boardPointers.length > 1 || windowEvent) {
                //only invoke if there was a pre-existing pointer on the board
                UI.board.object?.esc?.() ?? UI.board.object?.escapeFromClick?.();
            }

        } else if (totalCount <= 1 && event.target.tagName.toLowerCase() === "canvas") {
            //polyfill for older iPad Safari to prevent scrolling... overlow style exists and accepts "hidden" as value, but this doesn't seem to do anything to stop scrolling
            //event.preventDefault();
        }
    }

    function pointerupBoard(event) {
        cullPointerId(boardPointers, event.pointerId);
        pointerup();
    }

    function pointerupWin(event) {
        cullPointerId(windowPointers, event.pointerId)
        pointerup();
    }

    function cullPointerId(pointers, pointerId) {
        for (let i = 0; i < pointers.length; i++) {
            if (pointers[i] === pointerId)
                pointers.splice(i--, 1);
        }
    }

    function pointerup() {
        if (windowPointers.length + boardPointers.length <= 0) {
            cancelledSinceAllPointersUp = false;
            document.body.style.overflow = "hidden"; //disable scrolling
        }

    }

    function blur() {
        console.log("window blur");
        clearDoublePointerListenerFlags();
        clearCanvasObjPointerFlags();
    }

    function clearDoublePointerListenerFlags() {
        boardPointers.length = 0;
        windowPointers.length = 0;
    }

    function clearCanvasObjPointerFlags() {
        if (UI.board.object?.pointerFlags?.depressed && (UI.board.object?.pointerFlags.escapeFromClick === false)) {
            if (UI.board.object?.esc) UI.board.object.esc();
            else if (UI.board.object?.escapeFromClick) UI.board.object.escapeFromClick();

            setTimeout(() => setTimeout(() => UI.board.object?.resetPointerFlags?.())); //make sure all other events are cleared first!

        } else UI.board.object?.resetPointerFlags?.();
    }
})();



initializeLogger?.("ui.pointers ran");