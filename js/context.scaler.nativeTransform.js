"use strict"; document.currentScript.initTime = performance.now();

const zoomingResizeAllowance = 1 / (1 + Math.exp(-(1.0006 - 0.0033 * window.screen.availWidth)));
// used by differentiateEvents and adjustCanvasSizes
// the margin by which a zoom event is allowed to cause slight viewport resizes without triggering a resize event
// expressed as a ratio of the differences between old vs new width/height (abs of difference OVER the larger of the old/new)

// formula is derived from a logistic regression of points: (375px, 50%) (768px, 25%) (1280px, 3.125%)
// using website: https://stats.blue/Stats_Suite/logistic_regression_calculator.html on 12-30-2020

const getBrowserZoom = (function determineZoomMethod() {
    //may need to adjust which function is used, depending on browser capabilities
    return defaultGetBrowerZoomMethod;


    function defaultGetBrowerZoomMethod() {
        let customDocumentZoomStyle = document.documentElement.style.zoom;
        document.documentElement.style.zoom = ""; //needed to get an accurate browser zoom
        let browserZoom = Number(getComputedStyle(document.documentElement).zoom);
        document.documentElement.style.zoom = customDocumentZoomStyle;
        return browserZoom;
    }
})();



(function differentiateZoomAndResizeEvents() {
    const lastViewport = { width: window.visualViewport?.width ?? window.innerWidth, height: window.visualViewport?.height ?? window.innerHeight, scale: window.visualViewport?.scale, zoom: getBrowserZoom() };
    lastViewport.actualWidth = lastViewport.width * lastViewport.scale * lastViewport.zoom;
    lastViewport.actualHeight = lastViewport.height * lastViewport.scale * lastViewport.zoom;

    const zoomListeners = [];
    const nativeFuncs = Object.getOwnPropertyDescriptor(window, "onresize");
    const DEFAULT_ADD_RETURN = { addToFilterList: false, removeFromSystemList: false, addToSystemList: true };
    const DEFAULT_REMOVE_RETURN = { removeFromFilterList: false, removeFromSystemList: true }

    const SUPPRESSOR = Object.freeze({ addToFilterList: false, addToSystemList: false, removeFromSystemList: false, removeFromFilterList: false });

    try {
        Object.defineProperties(window, {
            onresize: mimicChromePropertyAssignedListener("resize", window.onresize),
            onzoom: mimicChromePropertyAssignedListener("zoom", null),

        });
    } catch (err) { /* couldn't change onresize property of window, not a big deal.  Just means those listeners won't be differentiated */ }

    const listenerFilter = new ListenerFilter(window, addFilter, differentiateEvents, removeFilter);
    window.addEventListener("resize", () => { }); //dummy function, to keep sending system resize events for zoom listeners even if there are no resize listeners in the filter's list (other than this one!)

    function addFilter(listenerArray, eventType, listener) {
        if (eventType === "zoom") {
            zoomListeners.push(listener);
            return SUPPRESSOR;

        } else if (eventType === "resize") {
            return ""; // default ListenerFilter behavior -- keeps track in its own array

        } else {
            return DEFAULT_ADD_RETURN; //passes the listener onto the native system function, doesn't include it in the filtered events
        }
    }

    function differentiateEvents(listenerArray, eventType, event) {
        if (eventType !== "resize") {
            console.error("Unexpected event type in window resize differentiator", eventType, event, listenerArray);
            return ""; //default ListenerFilter behavior
        }

        let width = window.visualViewport?.width ?? window.innerWidth;
        let height = window.visualViewport?.height ?? window.innerHeight;
        let scale = window.visualViewport?.scale ?? 1;
        let zoom = getBrowserZoom();
        let actualWidth = width * scale * zoom;
        let actualHeight = height * scale * zoom;

        let isResizeEvent = false;
        let isZoomEvent = false;
        if (lastViewport.actualWidth !== actualWidth) isResizeEvent = true;
        if (lastViewport.actualHeight !== actualHeight) isResizeEvent = true;
        if (lastViewport.zoom !== zoom || lastViewport.scale !== scale) isZoomEvent = true;

        if (isZoomEvent)  {
            if (isResizeEvent) {
                //both types of events.  We are biased towards zoom-only listeners unless the resize is significant
                //??? I think this is sometimes the result of small rounding errors from the change in scale on certain devices ???
                let widthChange = Math.abs(actualWidth - lastViewport.actualWidth);
                let heightChange = Math.abs(actualHeight - lastViewport.actualHeight);

                widthChange = widthChange > 2 ? Math.round(widthChange) : 0;
                heightChange = heightChange > 2 ? Math.round(heightChange) : 0;
                //^^^ to prevent issues with extremely tight tolerances (i.e. a zoomingResizeAllowance that translates to less than 1px) on large viewports > 2400px

                let percentageWidth = widthChange / Math.max(actualWidth, lastViewport.actualWidth);
                let percentageHeight = heightChange / Math.max(actualHeight, lastViewport.actualHeight);

                if (percentageWidth > zoomingResizeAllowance || percentageHeight > zoomingResizeAllowance) {
                    console.log("UNEXPECTED!  Both zoom and (significant) resize at the same time!"
                        + "\t  width: " + widthChange + "px\t " + (percentageWidth * 100).toFixed(2) + "%\n"
                        + "\t height: " + heightChange + "px\t " + (percentageHeight * 100).toFixed(2) + "%"
                    );

                    updateLastViewport(true);
                    return { listeners: [...listenerArray, ...zoomListeners] };

                } else {
                    console.log("Small resize event suppressed in favor of zoom only.\n"
                        + "\t  width: " + widthChange + "px\t " + (percentageWidth * 100).toFixed(2) + "%\n"
                        + "\t height: " + heightChange + "px\t " + (percentageHeight * 100).toFixed(2) + "%"
                    );

                    updateLastViewport(false); //!!! to prevent accumulation of small resizes -- must compare against the last NON-SUPPRESSED resize event
                }
            } else {
                updateLastViewport(true);
            }

            return { listeners: zoomListeners }; //zoom event only

        } else if (isResizeEvent) { //resize only
            updateLastViewport(true);
            return ""; //default ListenerFilter behavior.  resize only

        } else { //WTF?
            console.error("Window resize event with no change in size or zoom!  WTF?");
            return { listeners: [], event: null };
        }

        function updateLastViewport(includeActualWidthHeight) {
            lastViewport.width = width;
            lastViewport.height = height;

            if (includeActualWidthHeight) {
                //skipped when zoom events suppress small resizes
                lastViewport.actualWidth = actualWidth;
                lastViewport.actualHeight = actualHeight;
            }

            lastViewport.scale = scale;
            lastViewport.zoom = zoom;
        }
    }

    function removeFilter(listenerArray, eventType, listener) {
        if (eventType === "zoom") {
            let index = zoomListeners.indexOf(listener);
            if (index >= 0) zoomListeners.splice(index, 1);
            return SUPPRESSOR;

        } else if (eventType === "resize") {
            return ""; //default ListenerFilter behavior

        } else {
            return DEFAULT_REMOVE_RETURN; //goes directly to system native function
        }
    }




    function mimicChromePropertyAssignedListener(eventType, currentHandler) {
        let isFunction;
        let isOnEventFilterList;
        set(currentHandler);

        return { get: get, set: set, configurable: true, enumerable: true };

        function get() { return currentHandler }

        function set(val) {
            /* This is designed to replicate chrome's behavior, re: order of listener invocation, and assignements it will accept --
            *  Functions and objects (as placeholders), but all else defaults to null,
            *  and causes the value of the onresize property to lose its place in the event listener order,
            *  which means subsequent new assignments will default to the end of the invocation order from window.addEventListener(eventType, callback)
            */
            if ((isFunction = (typeof val === "function")) || (typeof val === "object" && val !== null)) {
                currentHandler = val; //not sure whether to put this before or after invoking addEventListener
                if (!isOnEventFilterList) {
                    window.addEventListener(eventType, invoker);
                    isOnEventFilterList = true;
                }

            } else {
                currentHandler = null; //not sure whether to put this before or after invoking addEventListener
                if (isOnEventFilterList) {
                    window.removeEventListener(eventType, invoker);
                    isOnEventFilterList = false;
                }
            }
        }

        function invoker() {
            if (isFunction) return currentHandler.apply(this, arguments);
        }
    }
})();


/*
 * 
 * 
 * 
 * 
 * 
 * 
 */


(function initiateRescalingOfCanvasContexts(canvasToFitToScreen) {
    function setMultiplier(newMultiplier) {
        multiplier = newMultiplier;

        let allCanvases = Array.from(document.getElementsByTagName("canvas"));
        checkForNewCanvasElements(allCanvases, false);

        if (allCanvases[0] !== canvasToFitToScreen) {
            //make it the first canvas to updateScale
            let index = allCanvases.indexOf(canvasToFitToScreen);
            if (index === -1) throw new Error("canvasToFitToScreen is not on the document!");
            allCanvases.splice(index, 1);
            allCanvases.unshift(canvasToFitToScreen);
        }

        for (let canvas of allCanvases) {
            for (let offscreen of canvas.offscreenCanvases) {
                updateScale(offscreen);
                offscreen.redraw?.(offscreen.context); //immediate redraw on offscreens... deferred for onscreens
            }
            updateScale(canvas);

            function updateScale(canvas) {
                canvas.width = useBaseline; //for on-screens, this will cause deferred invocation of doAutoResize, which will also redraw
                canvas.height = useBaseline;
            }
        }
    }

    function sortDOMmutationRecord(mutationArray) {
        let canvases = [];
        for (let event of mutationArray) {
            checkForCanvases(event.target)
        }

        function checkForCanvases(element) {
            if (element.tagName.toLowerCase() === "canvas" && !canvases.includes(element)) canvases.push(element);
            for (let child of element.children) {
                checkForCanvases(child);
            }
        }

        checkForNewCanvasElements(canvases, true);

    }

    function checkForNewCanvasElements(canvases, invokeDoAutoResize) {
        for (let canvas of canvases) {
            let widthDescriptor = Object.getOwnPropertyDescriptor(canvas, "width"); //potential cause of backwards/browser-compatibility issues?
            let heightDescriptor = Object.getOwnPropertyDescriptor(canvas, "height");

            if (!(widthDescriptor && heightDescriptor)) {
                if (widthDescriptor || heightDescriptor) throw new Error("partial installation?!?");
                installCanvasDimensionGettersSetters(canvas, false, invokeDoAutoResize);
                //invokeDoAutoResize is false when called from adjustCanvasSize, true when called from sortDOMmutationRecord
            }
        }
    }

    const useBaseline = Symbol("Use baseline width/height");
    const nativeWidthSymbol = Symbol("Native width");
    const nativeHeightSymbol = Symbol("Native height");
    let pendingResizeOfCanvasToFitToScreen = false;

    function installCanvasDimensionGettersSetters(canvas, isOffscreen = false, invokeDoAutoResize = !isOffscreen) { //these are specific to each canvas/context... not for the prototype
        if (isOffscreen) console.log(canvas);
        const context = canvas.getContext("2d");
        canvas.context = context;
        context.setTransform(multiplier, 0, 0, multiplier, 0, 0);

        let nativeWidth = Object.getOwnPropertyDescriptor(canvas, "width");
        let nativeHeight = Object.getOwnPropertyDescriptor(canvas, "height");

        let proto = canvas;
        while (!(nativeWidth && nativeHeight)) {
            //find the native getters/setters, walk up the proto chain if neccessary
            proto = Object.getPrototypeOf(proto);
            nativeWidth = Object.getOwnPropertyDescriptor(proto, "width");
            nativeHeight = Object.getOwnPropertyDescriptor(proto, "height");
        }

        const baselineDimensions = { width: canvas.width, height: canvas.height };
        const offscreenArray = [];

        const properties = {
            width: {
                get: function getWidth() {
                    return nativeWidth.get.call(canvas) / multiplier;
                },
                set: function (value) {
                    if (value === useBaseline) {
                        value = baselineDimensions.width;

                    } else if (Number.isFinite(value = Number.parseFloat(value))) {
                        baselineDimensions.width = value;
                        if (canvas === canvasToFitToScreen) deferredCalculateAspectToFit();

                    } else throw new Error("invalid width: " + value);

                    for (let offscreen of offscreenArray) {
                        offscreen.width = value;
                    }

                    value = cssDimensionToUse.widthRound(value * multiplier);
                    if(nativeWidth.get.call(canvas) !== value) nativeWidth.set.call(canvas, value);
                    invokeDeferredAutoResizeAndRedraw();
                }

            },
            height: {
                get: function getHeight() {
                    return nativeHeight.get.call(canvas) / multiplier;
                },
                set: function (value) {
                    if (value === useBaseline) {
                        value = baselineDimensions.height;

                    } else if (Number.isFinite(value = Number.parseFloat(value))) {
                        baselineDimensions.height = value;
                        if (canvas === canvasToFitToScreen) deferredCalculateAspectToFit();

                    } else throw new Error("invalid height: " + value);

                    for (let offscreen of offscreenArray) {
                        offscreen.height = value;
                    }

                    value = cssDimensionToUse.heightRound(value * multiplier);
                    if(nativeHeight.get.call(canvas) !== value) nativeHeight.set.call(canvas, value);
                    invokeDeferredAutoResizeAndRedraw();
                }
            },
            baselineWidth: { get: () => baselineDimensions.width },
            baselineHeight: { get: () => baselineDimensions.height },
            [nativeWidthSymbol]: nativeWidth,
            [nativeHeightSymbol]: nativeHeight,
            addOffscreen: {
                value: function addOffscreen() {
                    let newOffscreenCanvas = new HTMLCanvasElement.OffscreenCanvas(canvas.width, canvas.height);
                    offscreenArray.push(newOffscreenCanvas);

                    installCanvasDimensionGettersSetters(newOffscreenCanvas, true);

                    return newOffscreenCanvas;
                }
            },
            offscreenCanvases: {
                get: () => [...offscreenArray]
            }
        };

        if (isOffscreen) {
            delete properties.addOffscreen;
            delete properties.offscreenCanvases;
            delete properties.doAutoResize;
            invokeDeferredAutoResizeAndRedraw = () => { context.setTransform(multiplier, 0, 0, multiplier, 0, 0); }; //redraw of offscreens is invoked synchronously by setMultiplier
        }

        defineProperties(canvas, properties);

        let outstandingDeferredInvocations = 0;
        canvas.width = useBaseline;
        canvas.height = useBaseline;
        if (invokeDoAutoResize) doAutoResize();

        function invokeDeferredAutoResizeAndRedraw() {
            context.setTransform(multiplier, 0, 0, multiplier, 0, 0);

            if (canvas === canvasToFitToScreen) {
                if (pendingResizeOfCanvasToFitToScreen) return; //breaks an infinite loop from adjustCanvasSize -> setMultiplier -> canvas.width/height = useBaseline -> invokeDeferredAutoResizeAndRedraw -> etc
                pendingResizeOfCanvasToFitToScreen = true;
                outstandingDeferredInvocations = 0;

            } else {
                outstandingDeferredInvocations++;
            }

            let loopbackTracker = 0; //to prevent an infinite loop if there is an error with the canvasToFitToScreen
            setTimeout(invokeAutoResizeAndRedraw); 

            function invokeAutoResizeAndRedraw() {
                if (--outstandingDeferredInvocations > 0) return;

                if (pendingResizeOfCanvasToFitToScreen) {
                    if (canvas === canvasToFitToScreen) {
                        adjustCanvasSizes();
                        pendingResizeOfCanvasToFitToScreen = false;
                        return;

                    } else if (++loopbackTracker < 16) { //16 is an arbitrary number... not sure what to use here
                        setTimeout(invokeAutoResizeAndRedraw);
                        return;

                    } else {
                        pendingResizeOfCanvasToFitToScreen = false;
                        console.error("Apparent error with canvasToFitToScreen... breaking out of infinite loop, waiting for it to resize");
                    }
                }

                doAutoResize();
            }
        }

        function doAutoResize() {
            let cssDimensions = { width: "", height: "" };
            cssDimensions[cssDimensionToUse.name] = Math.ceil(baselineDimensions[cssDimensionToUse.name] * cssScale) + "px";
            canvas.style.width = cssDimensions.width;
            canvas.style.height = cssDimensions.height;
            canvas.cssScale = Number.parseFloat(getComputedStyle(canvas)[cssDimensionToUse.name]) / baselineDimensions[cssDimensionToUse.name];

            let drawWidth = Math.ceil(baselineDimensions.width * multiplier);
            let drawHeight = Math.ceil(baselineDimensions.height * multiplier);

            if (nativeWidth.get.call(canvas) !== drawWidth || nativeHeight.get.call(canvas) !== drawHeight) {
                nativeWidth.set.call(canvas, drawWidth);
                nativeHeight.set.call(canvas, drawHeight);
                context.setTransform(multiplier, 0, 0, multiplier, 0, 0);
            }

            canvas.redraw?.(context);
        }
    }



    const dimensionsToFit = {};
    const skipCalcDims = Symbol("skip calculateAspectToFit"); //marker flag to tell adjustCanvasSizes not to call back to calculateAspectToFit
    let pendingInvocationsOfCalcAspect = 0;

    function deferredCalculateAspectToFit() {
        pendingInvocationsOfCalcAspect++;

        setTimeout(function adjustAspectInvoker() {
            if (--pendingInvocationsOfCalcAspect > 0) return;
            if (calculateDimensionsToFit()) adjustCanvasSizes(skipCalcDims);
        });
    }

    function calculateDimensionsToFit() {
        //returns true if anything has changed, false if not
        const style = getComputedStyle(canvasToFitToScreen);
        const newDimensions = {
            innerWidth: canvasToFitToScreen.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight),
            innerHeight: canvasToFitToScreen.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom),

            outerWidth: canvasToFitToScreen.clientWidth + parseFloat(style.marginLeft) + parseFloat(style.marginRight) + parseFloat(style.borderLeft) + parseFloat(style.borderRight),
            outerHeight: canvasToFitToScreen.clientHeight + parseFloat(style.marginTop) + parseFloat(style.marginBottom) + parseFloat(style.borderTop) + parseFloat(style.borderBottom),

            widthInsets: parseFloat(style.paddingLeft) + parseFloat(style.paddingRight) + parseFloat(style.marginLeft) + parseFloat(style.marginRight) + parseFloat(style.borderLeft) + parseFloat(style.borderRight),
            heightInsets: parseFloat(style.paddingTop) + parseFloat(style.paddingBottom) + parseFloat(style.marginTop) + parseFloat(style.marginBottom) + parseFloat(style.borderTop) + parseFloat(style.borderBottom),
        }

        let changed = false;

        for (let key in newDimensions) {
            if (dimensionsToFit[key] !== (dimensionsToFit[key] = newDimensions[key])) changed = true;
        }
        if (changed) {
            dimensionsToFit.innerAspect = dimensionsToFit.innerWidth / dimensionsToFit.innerHeight;
            dimensionsToFit.outerAspect = dimensionsToFit.outerWidth / dimensionsToFit.outerHeight;
        }
        return changed;
    }


    let cssScale = 1;
    const useCSSwidth = Object.freeze({ name: "width", Name: "Width", side1: "Left", side2: "Right", widthRound: Math.floor, heightRound: Math.round });
    const useCSSheight = Object.freeze({ name: "height", Name: "Height", side1: "Top", side2: "Bottom", widthRound: Math.round, heightRound: Math.floor });
    let cssDimensionToUse = useCSSwidth; //just a placeholder for now, so rounding functions are available for initializing of canvasToFitToScreen
    let outstandingInvocationsToSetCSSdisplayStyle = 0;
    let oldWidth = 0;
    let oldHeight = 0;


    function adjustCanvasSizes(event) {
        if (event !== skipCalcDims) calculateDimensionsToFit();

        let browserZoom = getBrowserZoom();
        let scale = window.visualViewport?.scale ?? 1;

        let width = (window.visualViewport?.width ?? window.innerWidth) * scale * browserZoom;
        let height = (window.visualViewport?.height ?? window.innerHeight) * scale * browserZoom;
        let screenAspect = width / height;

        if (screenAspect <= dimensionsToFit.outerAspect) {
            ///screen is taller/skinnier than canvas -- probably mobile device
            // scale based on screen width
            cssDimensionToUse = useCSSwidth;
            width = cssDimensionToUse.widthRound(width - dimensionsToFit.widthInsets);
            height = cssDimensionToUse.heightRound(width / dimensionsToFit.innerAspect);

        } else {
            //screen is wider/shorter than canvas-- probably desktop
            //scale based on screen height
            cssDimensionToUse = useCSSheight;
            height = cssDimensionToUse.heightRound(height - dimensionsToFit.heightInsets);
            width = cssDimensionToUse.widthRound(height * dimensionsToFit.innerAspect);
        }

        if (    Math.abs(width  - oldWidth ) / Math.max(width , oldWidth ) > zoomingResizeAllowance
             || Math.abs(height - oldHeight) / Math.max(height, oldHeight) > zoomingResizeAllowance
        ) {
            oldWidth = width;
            oldHeight = height;
            canvasToFitToScreen.style.width = width + "px";
            canvasToFitToScreen.style.height = height + "px";

            cssScale = Number.parseFloat(getComputedStyle(canvasToFitToScreen)[cssDimensionToUse.name]) / canvasToFitToScreen["baseline" + cssDimensionToUse.Name];
            canvasToFitToScreen.cssScale = cssScale;
        }

        setMultiplier(Math.max(window.devicePixelRatio, cssScale, getBrowserZoom(), 1));

        canvasToFitToScreen.redraw?.(canvasToFitToScreen.context);
        
        //logWindowSpecs("Resize event used viewport " + cssDimensionToUse.name + " " + ({ width: width, height: height }[cssDimensionToUse.name] + "\t Screen aspect ratio: " + screenAspect));

        let loopbackTracker = 0;

        outstandingInvocationsToSetCSSdisplayStyle++;
        setTimeout(setPageCSSdisplayStyle);

        function setPageCSSdisplayStyle() {
            if (pendingResizeOfCanvasToFitToScreen) {
                if (++loopbackTracker < 16) {
                    return setTimeout(setPageCSSdisplayStyle);

                } else {
                    console.error("Apparent error with canvasToFitToScreen... breaking out of infinite loop, waiting for it to resize");
                    pendingResizeOfCanvasToFitToScreen = false;
                }        
            }

            if (--outstandingInvocationsToSetCSSdisplayStyle > 0) return;

            let firstDiv = document.getElementsByTagName("div")[0];
            let maxChildWidth = 0;

            if (!(firstDiv && firstDiv.children.length > 0)) {
                return setTimeout(function waitForDivChildren() {
                    loopbackTracker = 0;
                    outstandingInvocationsToSetCSSdisplayStyle++;
                    setPageCSSdisplayStyle();
                }, 1000); //check back once per second until it has children
            }

            let computedStyle;  //will be used by extractOffsetPixels
            let widths = [];

            let elements = [canvasToFitToScreen, ...firstDiv.children];
            for (let element of elements) {
                if (element.tagName === 'DIV') continue;
                computedStyle = getComputedStyle(element);  //will be used by extractOffsetPixels
                let width = Number.parseFloat(computedStyle.width);

                if (computedStyle.boxSizing === 'content-box') {
                    width += Number.parseFloat(computedStyle.paddingLeft);
                    width += Number.parseFloat(computedStyle.paddingRight);
                    width += Number.parseFloat(computedStyle.borderLeftWidth);
                    width += Number.parseFloat(computedStyle.borderRightWidth);

                } else if (computedStyle.boxSizing !== 'border-box') throw new Error('unaccounted for boxSizing computedStyle!');

                width += Number(computedStyle.marginLeft.match(/^(\d+.\d+|\d+)/)[0]);
                width += Number(computedStyle.marginRight.match(/^(\d+.\d+|\d+)/)[0]);

                widths.push(width);
            }
            let canvasWidth = widths[0];
            widths.splice(0, 1);

            let totalWidth = mySum(widths);
            let avgWidth = totalWidth / widths.length;
            let maxWidth = widths.reduce((a, b) => Math.max(a, b));
            let widthToCompare = Math.min(
                maxWidth * Math.min(widths.length, 3),
                avgWidth * Math.min(widths.length, 4),
                totalWidth
            );


            let screenWidth = (window.visualViewport?.width ?? window.innerWidth)
                * (window.visualViewport?.scale ?? 1)
                * getBrowserZoom();

            let extraWidth = screenWidth - canvasWidth;

            if (extraWidth >=  widthToCompare) {
                document.body.classList.add("useScreenWidth");
            } else {
                document.body.classList.remove("useScreenWidth");
            }
        }
    }

    function getDrawImageFunction(nativeDrawImage) {
        //return nativeDrawImage;

        return function drawImage(source) {
            if (source instanceof HTMLCanvasElement || source instanceof HTMLCanvasElement.OffscreenCanvas) {
                let sourceTransform = source.context.getTransform()
                source.context.save();
                source.context.setTransform(1, 0, 0, 1, 0, 0);


                if (arguments.length > 5) {
                    for (let i = 1; i < 5; i += 2) {
                        arguments[i] *= sourceTransform.a;
                        arguments[i + 1] *= sourceTransform.d;
                    }
                }

                nativeDrawImage.apply(this, arguments);

                source.context.restore();

            } else {
                nativeDrawImage.apply(this, arguments);
            }
        }
    }


    function adjustResolutionForBrowserZoom() {
        setMultiplier(Math.max(window.devicePixelRatio, cssScale, getBrowserZoom(), 1));
        //logWindowSpecs("Zoom event")
    }

    function logWindowSpecs(eventType) {
        console.log("\n-----------------------------------\n" + eventType);
        console.log("cssScale: " + cssScale + ",  canvas drawing multiplier: " + canvasRescaler.get());

        let computedStyle = getComputedStyle(canvas);
        let canvasSpecs = { width: canvas.width, height: canvas.height, ["style.width"]: canvas.style.width, ["style.height"]: canvas.style.height, ["computedStyle.width"]: computedStyle.width, ["computedStyle.height"]: computedStyle.height };
        for (let key of ["client", "scroll", "offset"]) {
            canvasSpecs[key + "Width"] = canvas[key + "Width"];
            canvasSpecs[key + "Height"] = canvas[key + "Height"];
        }

        console.log(stringifyObject(canvasSpecs, "canvas. "));
        console.log("\n");
        console.log("window.devicePixelRatio: " + window.devicePixelRatio + ",  getBrowserZoom(): " + getBrowserZoom());

        let windowSpecs = {}
        for (let key of ["innerWidth", "innerHeight", "outerWidth", "outerHeight"]) {
            windowSpecs[key] = window[key];
        }
        console.log(stringifyObject(windowSpecs, "window. "));

        console.log(stringifyObject(window.visualViewport, "window.visualViewport"));
        console.log(stringifyObject(window.screen, "window.screen"));

        console.log("-----------------------------------\n");



        function stringifyObject(object, descriptor) {
            if (object === undefined || object === null) return object;
            let str = descriptor ? descriptor + ": { " : "{ ";
            let hadKey = false;
            for (let key in object) {
                let type = typeof object[key]
                if (type === "object") {
                    let addStr = stringifyObject(object[key], key);
                    if (addStr) str += addStr;
                    else continue;

                } else if (type === "number" || type === "boolean" || object[key] === undefined || object[key] === null) {
                    str += key + ": " + object[key]?.toString();

                } else if (type === "string") {
                    str += key + ": \"" + object[key]?.toString() + "\"";

                } else continue;

                str += ", ";
                hadKey = true;
            }

            if (hadKey) return str.substring(0, str.length - 2) + " } "; //remove final ", "
            else return false;
        }
    }


    function eventListenerFilter(listenerArray, eventType, event) {
        let subEvent = {};
        for (let key in event) {
            subEvent[key] = event[key];
        }

        //if (cssScale > 1) { //keeps players with large screen honest ;-)
            if (Number.isFinite(subEvent.offsetX)) subEvent.offsetX = Math.round(subEvent.offsetX / this.cssScale);
            if (Number.isFinite(subEvent.offsetY)) subEvent.offsetY = Math.round(subEvent.offsetY / this.cssScale);

        /*
        } else { //small screens will accept fractions of a pixel
            if (Number.isFinite(subEvent.offsetX)) subEvent.offsetX /= this.cssScale;
            if (Number.isFinite(subEvent.offsetY)) subEvent.offsetY /= this.cssScale;
        }
        */

        return { event: subEvent };
    }



    //INSTALL ALL OF THE ABOVE FUNCTIONS!
    //below is the actual synchronous execution happening in this function (everything else above is variable declaration and async callback!)

    let multiplier = Math.max(Number(window.devicePixelRatio ?? 1), 1);

    CanvasRenderingContext2D.prototype.drawImage = getDrawImageFunction(CanvasRenderingContext2D.prototype.drawImage);

    try {
        if (window.OffscreenCanvas) {
            HTMLCanvasElement.OffscreenCanvas = OffscreenCanvas;
            OffscreenCanvasRenderingContext2D.prototype.drawImage = getDrawImageFunction(OffscreenCanvasRenderingContext2D.prototype.drawImage);
            

        } else {
            throw new Error();
        }

    } catch (err) {
        console.error("No OffscreenCanvas and/or OffscreenCanvasRenderingContext2D class present, using generic HTMLCanvasElement instead", err);
        Object.setPrototypeOf(OffscreenCanvas_polyfill.prototype, HTMLCanvasElement.prototype);
        HTMLCanvasElement.OffscreenCanvas = OffscreenCanvas_polyfill;

        function OffscreenCanvas_polyfill(w, h) {
            let newCanvas = document.createElement("canvas");
            Object.setPrototypeOf(newCanvas, OffscreenCanvas_polyfill.prototype);
            newCanvas.width = w;
            newCanvas.height = h;
            return newCanvas;
        }
    }

    for (let canvas of document.getElementsByTagName("canvas")) {
        installCanvasDimensionGettersSetters(canvas);
    }

    let mutationObserver = new MutationObserver(sortDOMmutationRecord); //sortMutation record invokes checkForNewCanvasElements after sorting the mutated elements
    mutationObserver.observe(document, { subtree: true, childList: true });


    adjustCanvasSizes();
    window.addEventListener("resize", adjustCanvasSizes);
    window.addEventListener("zoom", adjustResolutionForBrowserZoom);

    const listenerFilter = new ListenerFilter(HTMLCanvasElement.prototype, undefined, eventListenerFilter);

})(document.getElementsByClassName("board")[0]);



/*
* DOCUMENTATION FOR ObjectRescaler() utility
* 
* Installs wrapper functions or getters/setters, to interface with a native system (DOM) interface at a different numerical scale than the JS code is using
* 
* Each of modifyArgs, embedIn, modifyReturn, and gettersSetters must be an object with any number of properties that match functions
* (or getter/setter properties in the case of gettersSetter) of the objectToRescale.
*
*
* modifyArgs, property value options:
*    true (or false)       : true multiplies ALL arguments by the multiplier.  (note: false will simply retain the native functions with no multiplier... but why bother?)
*                                   Note: if the argument cannot be coerced into a number by the JS interpretter/compiler, it will result in NaN
*    array of boolean-like : Multiply only arguments where matching index coerces to 'true' AND the argument is numerical & finite (note: prevents NaN, unlike above)
*    callback function     : custom behavior.  callback(multiplier, args)  note: args is a single Arguments (array-like) object (NOT spread!) which can be mutated and returned
*                                    Must return: arguments array (-like-object?) to submit to the native function (or a subsequent embedded function if requested, see below)
*                                    THAT function's return will be returned to the original caller (or to a subsequent return filter if requested, see below)
*
*
* embedIn, all property values MUST be a callback function (which will invoke the native function inside its body, if needed)
*                          callback(multiplier, nativeFunction, ...arguments)
*                          return: anything or nothing.  This value will be returned to the original caller (or to a subsequent return filter if requested, see below)
*                          IMPORTANT: It is the job of the embeding function to invoke the nativeFunction if it is needed (that is why it is passed as the second argument!)
*
*
* modifyReturn, options:
*      true                : divide the return value by the multiplier.
*                                          NOTE: if JS intepretter/compiler cannot coerce the return into a number, this will return NaN
*      callback function   : custom behavior.  callback(multiplier, nativeReturn).  return: anything or nothing.
*                                          Returned value will be returned to the original caller
*
*
* gettersSetters, property value options:
*      true                : multiply every setter input by the multiplier.  Divide every getter return by multiplier.
*                                   If false, the native getter/setter will be used (...but why bother?)
*                                   NOTE: Will result in NaN if JS interpretter/compiler cannot coerce the value to a number.
*      {get: callback function or boolean, set: callback function or boolean}
*                          : if boolean, it mimics the above-described behavior for that get or set function only
*                          : callback function for custom behavior
*                              get: callback(multiplier, returnValueFromnativeGetterFunction) return: transformed value to return to the requester
*                              set: callback(multiplier, valueSubmittedBySetRequester) return: transformed value to submit to the native setter function
*
*
* onMultiplierChange is an event handler callback for when the multiplier is changed (see accessors, below, for more info on changing multiplier)
*          eventHandler(newMultiplier, oldMultiplier, toggleToNewInvoker, toggleToOldInvoker)
*              return: false to reverse the change.  Anything else (including undefined, null, or 0) will keep it
*              toggleTo New/Old Invokers are functions which let you temporarily toggle back and forth between old and new multiplier, as used by the object's functions/getters/setters
*              NOTES: 1) If newMultiplier is the same as oldMultiplier, the callback event handler is NOT invoked, because there was no change
*                     2) The multiplier actually being used is by default NOT changed before calling the event handler, in other words it is still the oldMultiplier
*                           but WILL be changed after returning from it (unless false is returned, see above) regardless of what is done with the toggle invokers
*
*
* initialMultiplier: defaults to 1.  Must be a positive finite number.
*          If other than 1, this will result in an immediate callback to the onMultiplierChange handler (if it exists)
*          AFTER all replacement functions are installed, but before returning accessors from ObjectRescaler()  (see below).
*          This can be suppressed by marking 'suppressFirstOnChangeCallbackIfInitialMultiplierIsNotOne' argument to true
*
*
* IMPORTANT: The ObjectRescaler itself is an accessor object with the following 3 properties:
*          set(newMultiplier)  -- Function which changes the multiplier.  Throws an error if newMultiplier is not a finite positive number (greater than but not equal to zero)
*          get()               -- Function which returns the current multiplier
*          symbols { }         -- Object containing symbols to access the native functions/properties.
*                                      key: property name ,    value: accessor symbol
*                                      Use the accessor symbol as the property key in the objectToRescale (or one of its proto children)
*                                      in order to access the native (not-rescaled) functions/properties
*
* NOTE: If a property has more than one function/gettter/setter substitution, the substitutes will be nested in the order they are explained above.
* HOWEVER, only the native function will be accessible using the accessor symbol.  Any intermediate functions will be nested inside the
* final function, but will become inaccessible to outside scopes.
*
* Also note that all functions submitted will be wrapped inside another handler function created by ObjectRescaler, so the final exteneral
* function you see on the objectToRescale will not be the same one you submitted.  BUT your function will be invoked by that wrapper function in the
* manner detailed above.
*
*/

function ObjectRescaler(objectToRescale, modifyArgs = {}, embedIn = {}, modifyReturn = {}, gettersSetters = {}, initialMultiplier = 1, onMultiplierChange = undefined, suppressFirstOnChangeCallbackIfInitialMultiplierIsNotOne = false) {
    if (!(Number.isFinite(initialMultiplier) && initialMultiplier > 0)) throw new Error("Invalid initialMultiplier: " + initialMultiplier);

    let m = 1;

    //multiplier change event handler
    if (typeof onMultiplierChange === "function") {
        // with event callback version...
        this.set = (newMultiplier) => {
            if (Number.isFinite(newMultiplier) && newMultiplier > 0) {
                if (m !== newMultiplier) {
                    let oldMultiplier = m;
                    if (onMultiplierChange(newMultiplier, oldMultiplier, () => m = newMultiplier, () => m = oldMultiplier) === false)
                        m = oldMultiplier;
                    else m = newMultiplier;
                }

            } else throw new Error("Invalid newMultipler argument to : " + newMultiplier);
        }

    } else {
        //streamlines the process if there is no event callback function
        this.set = (newMultiplier) => {
            if (Number.isFinite(newMultiplier) && newMultiplier > 0) {
                m = newMultiplier;

            } else throw new Error("Invalid newMultipler argument to : " + newMultiplier);
        }
    }

    this.get = () => m,
    this.symbols = { }


    //modifyArgs
    for (let funcName in modifyArgs) {
        let nativeFunction = objectToRescale[funcName];
        let substitute = modifyArgs[funcName];
        let method = typeof substitute;
        let tempContainer; //for the purpose of dynamically naming the function

        switch (method) {
            case "boolean": //multiply all arguments when true.  does not check if they are finite numbers (could result in NaN)
                if (substitute) {
                    tempContainer = {
                        [funcName + " scaled"]: function () {
                            for (let i = 0; i < arguments.length; i++) {
                                arguments[i] *= m;
                            }
                            return nativeFunction.apply(this, arguments);
                        }
                    }

                } else { //why bother?  just uses the nativeFunction
                    tempContainer = {
                        [funcName + " scaled"]: nativeFunction
                    }
                }
                break;

            case "object": //multiply arguments where index in substitute array is "true"
                if (!(substitute instanceof Array)) throw new Error();
                tempContainer = {
                    [funcName + " scaled"]: function () {
                        for (let i = 0; i < substitute.length; i++) {
                            if (substitute[i] && Number.isFinite(arguments[i])) arguments[i] *= m;
                        }
                        return nativeFunction.apply(this, arguments);
                    }
                }
                break;

            case "function":
                //functions must return an arguments array
                tempContainer = {
                    [funcName + " scaled"]: function () {
                        return nativeFunction.apply(this, substitute.call(this, m, arguments));
                    }
                }
                break;

            default: throw new Error("Invalid modifyArgs property: " + funcName);
        }

        objectToRescale[funcName] = tempContainer[funcName + " scaled"];

        if (!(funcName in this.symbols)) {
            let symbol = this.symbols[funcName] = Symbol("Native " + funcName);
            this.symbols[funcName] = symbol;
            Object.defineProperty(objectToRescale, symbol, { value: nativeFunction, configurable: true, writable: true, enumerable: false });
        }
    }

    //embedIn
    for (let funcName in embedIn) {
        let nativeFunction = objectToRescale[funcName];
        let substitute = embedIn[funcName];

        if (typeof nativeFunction !== "function") throw new Error("This property is not a function: " + funcName);
        if (typeof substitute !== "function") throw new Error("Invalid embedIn property value: " + funcName);

        let tempContainer = {
            [funcName + " scaled"]: function () {
                return substitute.call(this, m, nativeFunction, ...arguments);
            }
        }
        objectToRescale[funcName] = tempContainer[funcName + " scaled"];

        if (!(funcName in this.symbols)) {
            let symbol = this.symbols[funcName] = Symbol("Native " + funcName);
            this.symbols[funcName] = symbol;
            Object.defineProperty(objectToRescale, symbol, { value: nativeFunction, configurable: true, writable: true, enumerable: false });
        }
    }


    //modifyReturn
    for (let funcName in modifyReturn) {
        let nativeFunction = objectToRescale[funcName];
        let substitute = modifyReturn[funcName];
        let method = typeof substitute;
        let tempContainer; //for the purpose of dynamically naming the function
        

        switch (method) {
            case "boolean" :
                if (substitute) {
                    tempContainer = {
                        [funcName + " scaled"]: function () {
                            return nativeFunction.apply(this, arguments) / m;
                        }
                    }

                } else { //why bother?
                    tempContainer = {
                        [funcName + " scaled"]: nativeFunction
                    }
                }
                break;

            case "function":
                //functions must take the native return as the second argument, and return the modified value
                tempContainer = {
                    [funcName + " scaled"]: function () {
                        return substitute.call(this, m, nativeFunction.apply(this, arguments));
                    }
                }
                break;
        }

        objectToRescale[funcName] = tempContainer[funcName + " scaled"];

        if (!(funcName in this.symbols)) {
            let symbol = this.symbols[funcName] = Symbol("Native " + funcName);
            this.symbols[funcName] = symbol;
            Object.defineProperty(objectToRescale, symbol, { value: nativeFunction, configurable: true, writable: true, enumerable: false });
        }
    }

    //gettersSetters
    for (let propertyName in gettersSetters) {
        let proto = objectToRescale;
        let nativeGet;
        let nativeSet;

    
        while (!((typeof nativeSet === "function") && (typeof nativeGet === "function"))) { //walk up the prototype chain
            try {
                let propertyDescriptor = Object.getOwnPropertyDescriptor(proto, propertyName);
                nativeGet = propertyDescriptor?.get;
                nativeSet = propertyDescriptor?.set;
                proto = Object.getPrototypeOf(proto);

            } catch (err) {
                console.error(err);

                if (!((typeof nativeSet === "function") && (typeof nativeGet === "function"))) {
                    let value = objectToRescale[propertyName];
                    nativeGet = () => value;
                    nativeSet = (val) => value = val;
                }
            }
            if (!proto) break;
        }

        if (!((typeof nativeSet === "function") && (typeof nativeGet === "function"))) {
            console.error("Could not locate property getters/setters", propertyName, objectToRescale);
        }


        let substitute = gettersSetters[propertyName];
        if (typeof substitute === "boolean") substitute = { get: substitute, set: substitute }
        else if (typeof substitute !== "object" || !("get" in substitute && "set" in substitute)) throw new Error("Invalid property value for gettersSetters: " + propertyName);

        let get; //for the purpose of dynamically naming the function
        let set;

        switch (typeof substitute.get) {
            case "boolean" : //divides getter return value
                if (substitute.get) {
                    get = {
                        get: function () {
                            return nativeGet.call(this) / m;
                        }
                    }

                } else { get = { get: nativeGet }; }
                break;

            case "function": //custom getter behaviors
                let subGet = substitute.get;
                get = {
                    get: function () {
                        return subGet.call(this, m, nativeGet.call(this));
                    }
                }
                break;

            default: throw new Error("'get' was not a function or boolean: " + propertyName);
        }


        switch (typeof substitute.set) {
            case "boolean": //multiplies setter value argument
                if (substitute.set) {
                    set = {
                        set: function (val) {
                            nativeSet.call(this, val * m)
                        }
                    }

                } else { set = { set: nativeSet }; }
                break;

            case "function": //custom getter/setter behaviors, defined in two functions
                let subSet = substitute.set;

                set = {
                    set: function (val) {
                        nativeSet.call(this, subSet.call(this, m, val));
                    }
                }
                break;

            default: throw new Error("'set' was not a function or boolean: " + propertyName);
        }

        try {
            Object.defineProperty(objectToRescale, propertyName, { get: get.get, set: set.set });
        } catch (err) {
            console.error(err, propertyName, objectToRescale);
        }

        if (!(propertyName in this.symbols)) {
            let symbol = this.symbols[propertyName] = Symbol("Native " + propertyName);
            this.symbols[propertyName] = symbol;
            Object.defineProperty(objectToRescale, symbol, { get: nativeGet, set: nativeSet, configurable: true, enumerable: false });
        }
    }


    //set initial multiplier, and invoke change event call back if neccessary
    if (suppressFirstOnChangeCallbackIfInitialMultiplierIsNotOne) {
        m = initialMultiplier
    } else {
        this.set(initialMultiplier); //only invokes on change if it actually changes (aka is not 1)
    }
}

initializeLogger?.("context.scaler ran");