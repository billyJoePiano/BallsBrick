"use strict"; document.currentScript.initTime = performance.now();



/*fileOpener.addEventListener("change", function (event) {
    let fileReader = new FileReader();
    //console.log(fileReader);
    fileReader.onloadend = (event) => {

        let revived = JSONreviver.parse(fileReader.result);
        //console.log(revived);
        if (revived.result instanceof BoardTemplate) {
            board = new Board(revived.result);
            if (UI.board.object instanceof Board) {
                if (Engine.isRunning()) Engine.terminate(Engine.intervalHandler);
                UI.board.installNewTargetObject(board);
                board.firstRound();
            } else if (UI.board.object instanceof BoardEditor) {
                UI.board.object.newBoardTemplate(board.template);
            }
        } else alert("this file could not be converted into a BoardTemplate");
    };

    try { fileReader.readAsText(event.target.files[0]); } catch (err) { console.log(err); }
});*/

async function openLocalFileAsText(acceptType = undefined) {
    let fileOpener = document.createElement("input");
    fileOpener.type = "file";
    if (acceptType) fileOpener.accept = acceptType;

    return await new Promise((resolve, reject) => {
        fileOpener.onchange = (openerEvent) => {
            let fileReader = new FileReader();
            fileReader.onloadend = (readerEvent) => {
                resolve(fileReader.result);
            }
            try {
                fileReader.readAsText(event.target.files[0]);

            } catch (err) {
                reject(err);
            }
        };

        fileOpener.click();
    });
}

function downloadStringToLocal(filename, text) {
    let element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
    element.setAttribute('download', filename);

    element.style.display = 'none';
    document.body.appendChild(element);

    element.click();

    document.body.removeChild(element);
}


function downloadToLocal(filename, objectToStringify = UI.board.object.boardTemplate ?? UI.board.object.template) {
    downloadStringToLocal(filename, ObjectReflector.stringify(objectToStringify));
}

async function fetchWebString(address) {
    let startTime = Date.now();

    let f = await fetch(address);

    let midTime = Date.now();
    //console.log("fetchWebString, fetchTime: " + (midTime - startTime));

    let t = await f.text();

    let endTime = Date.now();
    //console.log("fetchWebString, textTime: " + (endTime - midTime));
    //console.log("fetchWebString, totalTime: " + (endTime - startTime));

    return t;
}


async function fetchWebJSON(address) {
    let startTime = Date.now();

    let f = await fetch(address);

    let midTime = Date.now();
    //console.log("fetchWebJSON, fetchTime: " + (midTime - startTime));

    let j = await f.json();

    let endTime = Date.now();
    //console.log("fetchWebJSON, jsonTime: " + (endTime - midTime));
    //console.log("fetchWebJSON, totalTime: " + (endTime - startTime));

    return j;
}


initializeLogger?.("files ran");