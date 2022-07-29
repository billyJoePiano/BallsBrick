"use strict";

initialize([
    "files",

    "objectTemplates",
    "stats",

    "geometry.lines",
    "geometry.polygons",
    "geometry.angles",
    "geometry.constants",
    "geometry.curves",
    "color",

    "listener.filter",
    "context.scaler.customTransform",
    "ui",
    "ui.pointers",

    "board.template",
    "board",
    "board.block",
    "block.special",

    "engine",
    "engine.caches",
    "engine.physics",
    "engine.moveBalls",
    "surface",
    "ball.bounce",

    "editor",
    "editor.modes",
    "editor.resizeBlocks",
    "block.templates",

    "object.unfreezable",
    "reflector.objects",
    "reflector.functions",
    "reflect",
    "JSONreviver",

    "metrics",
    "debug",

    "run"
]);

function run(constructBoards, makeButtons, event) {
    const XHR_INTERVAL = 15000;
    const XHR_FAILURE_SLOWDOWN = 45000; // may add up to this many ms to the interval

    let boardPromises = constructBoards();

    if (boardPromises.length !== 1 || !(boardPromises[0] instanceof Promise)) throw new Error();

    let promise = boardPromises[0];

    if (!(promise.canvas instanceof HTMLCanvasElement)) throw new Error();
    const canvas = promise.canvas;
    const url = promise.url.split('?')[0];

    const editor = new BoardEditor();
    const form = new FormData();

    editor.onbeforeunload = unsavedChanges;

    let lastXHR = null;
    let lastUpdate = null;
    let resendBoard = false;
    let xhrFailures = 0; //consecutive failures

    promise.then(board => {
        let keys = Object.keys(board);
        if (keys.length !== 3) throw new Error();
        if (keys[0] !== 'request' || keys[1] !== 'draft' || keys[2] !== 'board') throw new Error();

        let requestId = board.request;
        let draftId = board.draft;
        board = board.board;

        checkId(requestId);
        checkId(draftId);

        form.set('request', requestId);
        form.set('draft', draftId);

        let div = makeButtons(event => editor.startEditing(undefined, div, event));

        UI.board = UI.for(canvas);
        UI.board.installNewTargetObject();
        editor.startEditing(board, div, event);
        setTimeout(sendXhr, XHR_INTERVAL);
    },
    error => {
        /* do something with the error, display a message to the user */

    });

    const onerror = badXHR('error');
    const onabort = badXHR('abort');
    const ontimeout = badXHR('timeout');

    function sendXhr() {
        if (lastXHR !== null)
            console.error('unexpected XHR request while there is still one pending');

        lastXHR = new XMLHttpRequest();
        lastXHR.onload = getResponse;
        lastXHR.onerror = onerror;
        lastXHR.onabort = onabort;
        lastXHR.ontimeout = ontimeout;
        lastXHR.dateNow = Date.now();
        lastXHR.perfNow = performance.now();

        let url = prepareForm();
        lastXHR.open('POST', url);
        lastXHR.send(form);
    }

    function prepareForm() {
        if (editor.hasUpdates || resendBoard === true) {
            let json = ObjectReflector.stringify(editor.boardTemplate);
            if (json !== lastUpdate || resendBoard) form.set('board', json);
            else form.delete('board');

        } else form.delete('board');

        return url + '?' + encode64(Date.now());
    }

    function getResponse(event) {
        let response = event.target;
        try {
            response = JSON.parse(response.responseText);

        } catch(e) {
            console.error('badJSON from server', response, event, event.target)
            onerror(e);
        }

        if (response === event.target) return;
        else if (!("resendBoard" in response) && response.valid !== false) xhrFailures = 0;

        let resendFlag = false;

        for (let key in response) switch(key) {
            case 'connected':
                if (response.connected === true) {
                    continue;
                    resendBoard = false;

                } else if (response.connected === false) {
                    console.error('server has severed connection', response, event, event.target);

                } else {
                    console.error('invalid connected value', response, event, event.target);
                }

            case 'draft':
                checkId(response.draft)
                form.set('draft', response.draft);
                continue;

            case 'request':
                checkId(response.request)
                form.set('request', response.request);
                continue;

            case 'resendBoard':
                if (response.resendBoard !== true)
                    console.error('invalid resendBoard value', response, event, event.target);
                resendFlag = true;
                if (!('valid' in response)) xhrFailures++;
                continue;

            case 'goodbye':
                if (response.goodbye !== true)
                    console.error('invalid goodbye wave', response, event, event.target);

                goodbye();
                return;

            case 'valid':
                if (response.valid === true) {
                    clearOnbeforeunload();

                } else if (response.valid === false) {
                    xhrFailures++;
                    console.error('Server indicates invalid JSON');
                    console.log(lastUpdate);

                } else {
                    console.error('invalid json valid flag', response, event, event.target);
                }
                continue;

            default:
                console.error('Invalid field name: ' + key, response, event, event.target);
        }

        if (resendFlag) {
            resendBoard = true;
            if (xhrFailures < 10) {
                lastXHR = false;
                sendXhr();

            } else {
                scheduleNextXHR()
            }
        } else {
            scheduleNextXHR();
        }
    }


    //creates events handlers for error, abort, and timeout
    function badXHR(type) {
        return function onfailure(event) {
            console.error('XHR ' + type, event, event.target);
            xhrFailures++;
            if (form.has('board')) resendBoard = true;
            scheduleNextXHR();
        }
    }

    function scheduleNextXHR() {
        let dateDiff = Date.now() - lastXHR.dateNow;
        let perfDiff = performance.now() - lastXHR.perfNow;
        if (Math.abs(dateDiff - perfDiff) > 20)
            console.error('unusual gap between Date.now and performance.now', dateDiff, perfDiff, lastXHR);

        lastXHR = null;

        let timeout = XHR_INTERVAL - Math.max(dateDiff, perfDiff);
        if (xhrFailures > 0) {
            timeout += Math.min(xhrFailures * 1000, XHR_FAILURE_SLOWDOWN);
        }

        if (timeout > 500) setTimeout(sendXhr, timeout);
        else sendXhr();
    }

    function checkId(id) {
        if (typeof id === 'number' && isFinite(id) && id > 0 && id % 1 === 0) return;
        else throw new Error();

    }

    function unsavedChanges(beforeunloadEvent) {
        let beacon = navigator.sendBeacon(finalize(), form);
        if (((!beacon || lastXHR) && form.has('board')) || resendBoard || editor.hasUpdates) {
            resendBoard = true;
            console.error(lastXHR);
            lastXHR = null;
            sendXhr();
            beforeunloadEvent().preventDefault();
            return event.returnValue = 'Warning: your draft has unsaved changes';

        } else {
            lastXHR = null;
            sendXhr();
        }
    }

    function finalize() {
        form.set('finalize', true);
        return prepareForm();
    }

    function goodbye() {
        clearOnbeforeunload();
        console.log('GOODBYE');
    }

    function clearOnbeforeunload() {
        window.onbeforeunload = null;
        window.onpagehide = unsavedChanges;
        form.delete('finalize');
    }


    const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz+-';

    function encode64(num) {
        //encodes a number to base-64
        if (typeof num !== 'number') {
            throw new Error('Value is not number!');
        }

        let result = '';
        let mod;
        do {
            mod = num % 64;
            result = ALPHABET.charAt(mod) + result;
            num = Math.floor(num / 64);

        } while(num > 0);

        return result;
    }
}

const navMyBoards = function navMyBoards() { window.location.href = HOME_PATH + '/myBoards' }
const navMyDrafts = function navMyDrafts() { window.location.href = HOME_PATH + '/myDrafts' }
const navHomePage = function navHomePage() { window.location.href = HOME_PATH + '/' }
const navBlog = function navBlog() { window.location.href = HOME_PATH + '/blog' }
const navLogout = function navLogout() { window.location.href = HOME_PATH + '/logout' }
const navLogin = function navLogin() { window.location.href = HOME_PATH + '/login' }
const navSignup = function navSignup() { window.location.href = HOME_PATH + '/signup' }