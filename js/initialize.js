"use strict";
const initializeStartTime = document.currentScript.initTime = performance.now();

const canvas = document.getElementsByClassName("board")[0];
const allowedCharCodes = Object.freeze([97, 98, 99, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57]);

let defaultBalls = 100;
let timeoutInterval = 20;
let frameSeconds = 0.02;
let board;

console.log("\n\n\n\n\n\n\nPAGE RELOAD\n\n\n\n\n\n\n");

const initializeLogger = (function makeInitializeLogger() {
    let colLogger = consoleColumns(/*scripts.longestName*/25 + 8, 9, null);
    return function initializeLogger(eventString, eventStartTime = document.currentScript?.initTime) {
        let now = performance.now();
        if(Number.isFinite(eventStartTime))
            return colLogger(eventString, (now - eventStartTime).toFixed(2) + " ms", (now - initializeStartTime).toFixed(2) + " ms");
        else
            return colLogger(eventString, "n/a" , (now - initializeStartTime).toFixed(2) + " ms");
    }
})();

const HOME_PATH = (function() {
    let scriptPath = document.currentScript.src.split('/');
    if (scriptPath[scriptPath.length - 2] !== 'js') throw new Error();
    scriptPath.splice(scriptPath.length - 2, 2);
    return scriptPath.join('/');
})();


function initialize(scripts) {
    initialize = undefined;
    const r = run;
    run = undefined;
    scripts.longestName = scripts.reduce((longest, name) => Math.max(longest, name.length), 0);

    const startTime = performance.now();

    const getVersionString = "ontouchstart" in window ? addVersionString : noVersionString;

    let boardPromises = [];

    let scriptInits = {};

    let scriptPath = HOME_PATH + '/js/';

    for (let fileName of scripts) {
        //lastWindowEvent = 0;

        //longestName = Math.max(fileName.length, longestName);
        initializeLogger(fileName + " loading");
        let script = document.createElement("script");
        script.type = "text/javascript";
        script.src = scriptPath + fileName + ".js" + getVersionString();

        scriptInits[script.src] = performance.now();

        script.async = false;
        script.defer = true;
        let log = event => {
            initializeLogger(fileName + " done", scriptInits[event.currentTarget.src]);
            console.log("\n");
        }

        if (fileName === 'files') {
            script.onload = event => {
                log(event);
                for (let canvas of document.getElementsByClassName('board')) {
                    if (canvas.tagName !== 'CANVAS') throw new Error();
                    let link = canvas.children[0];
                    if (link.tagName !== 'LINK') throw new Error();
                    let url = link.href
                    let promise = fetchWebString(url);
                    promise.canvas = canvas;
                    promise.url = url;
                    boardPromises.push(promise);
                }
            }

        } else if (fileName === 'run') {
            script.onload = event => {
                log(event);
                r(constructBoards, makeButtons, event);
            }

        } else {
            script.onload = log;
        }

        document.head.appendChild(script);
    }

    console.log("\n\n\n");
    initializeLogger('initialize() FINISHED', startTime);
    console.log("\n\n\n");

    function addVersionString() {
        return "?" + (Math.random() * 10000).toFixed(0);
    }

    function noVersionString() {
        return "";
    }

    function constructBoards() {
        let nextBoardPromises = [];

        for(let promise of boardPromises) {
            let boardJSON;

            let nextPromise = promise.then(boardJSON => {
                let template;

                try {
                    template = JSONreviver.parse(boardJSON).result;
                    console.log("SUCCESSFULLY PARSED JSON");

                } catch (err) {
                    console.error("ERROR WHILE PARSING JSON");
                    console.error(err);
                    console.log(boardJSON);
                    return;
                }

                return template;
            }
            ,
            err => {
                console.error("FETCH PROMISE ERROR");
                console.error(err);
                throw err; //throws to the next level in the promise chain
            });

            nextPromise.canvas = promise.canvas;
            nextPromise.url = promise.url;
            nextBoardPromises.push(nextPromise);
        }
        return nextBoardPromises;
    }
    function makeButtons(editFunction) {
        const nav = document.getElementsByClassName('nav')[0];

        const div = document.body.insertBefore(document.createElement("div"), nav);
        div.classList.add('editor');

        let restart = new Button("RESTART GAME", undefined, () => {
            if (Engine.intervalHandler) Engine.terminate(Engine.intervalHandler);
            board = new Board(board.template);
            UI.board.installNewTargetObject(board);
            board.firstRound();
        });

        div.appendChild(restart.htmlButton);

        let edit = new Button("BOARD EDITOR", blockTemplates[0][0], editFunction);

        div.appendChild(edit.htmlButton);

        return div;
    }
}





function consoleColumns(col1Width, col2Width, etc) {
    /* All arguments must be numbers, except null may be provided as the final argument if
     * you want the last column to not end with the seperator
     */

    let colStarts = [];

    for (let i = 0; i < arguments.length; i++) {
        let colLength = arguments[i];

        if (!(Number.isFinite(colLength) && colLength >= 0)) {
            if (i < arguments.length - 1) throw new Error("invalid argument to consoleColumns()");
            else if (colLength === null) colStarts.push(Number.Nan);

        } else {
            colStarts.push(colLength + (colStarts[colStarts.length - 1] ?? 0));
        }
    }

    let seperator = "|";
    Object.defineProperty(logConsoleColumns, "seperator", {
        set: newSeperator => seperator = newSeperator.toString(),
        get: () => seperator
    });

    return logConsoleColumns;

    function logConsoleColumns(col1Val, col2Val, etc) {
        if (arguments.length > colStarts.length) throw new Error("invalid number of arguments to logConsoleColumns()");
        let str = "";
        let spacesToFill;
        for (let i = 0; i < arguments.length; i++) {
            str += arguments[i]?.toString();
            spacesToFill = colStarts[i] + ((seperator.length + 2) * i) + 1 - str.length;
            if (spacesToFill > 0) str += " ".repeat(spacesToFill);
            str += seperator;
            if (spacesToFill >= 0) str += " ";
        }

        if (spacesToFill >= 0 && str[str.length - 1] === " ") {
            //get rid of the trailing space IF it was added by this function
            str = str.substring(0, str.length - 1);

        } else if (isNaN(spacesToFill)) {
            str = str.substring(0, str.length - seperator.length);
        }

        console.log(str);
        return str;
    };
}

function getTranspileSource() {
    let s = [...scripts];

    s.splice(s.indexOf("listener.filter"), 2); //and context.scaler, as long as they are next to each other
    let t = new Array(s.length);
    t.fill(null);

    s.forEach((script, index) => {
        fetchWebString("js/" + script + ".js?version=" + (Math.random * 1000).toFixed(0)).then(text => {
            t[index] = text;
            if (t.indexOf(null) === -1) {
                downloadStringToLocal("transpileSource.js", t.join("\n\n"));
            }
        });
    });

    return t;
}




initializeLogger("initialize ran");
console.log("\n");