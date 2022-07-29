"use strict"; document.currentScript.initTime = performance.now();

let recordMetrics = true;

let fireTime;
let initTime = undefined;
let framesToRun = 5000;
let frameCounter = 0;

let newFrameStartTime = undefined;
let oldFrameStartTime;
let drawStartTime = undefined;
let drawTimeDifferential;
let calcStartTime = undefined;
let calcEndTime;
let frameEndTime;


let frameBounceCounter = 0;
let frameComplexBounceCounter = 0;
let frameBlocksDestroyedCounter = 0;
let frameBallsThrownCounter = 0;

let frameNumber;
let frameDrawTimes;
let frameCalcTimes;
let frameTotalTimes;

let frameIntervalTimes;
let frameTargetIntervalTimes;
let frameIntervalDelays;

let frameBounces;
let frameComplexBounces;
let frameBlocksDestroyed;
let frameBlocksOnBoard;
let frameBallsThrown;
let frameBallsOnBoard;
let frameDrawTimeDifferentials;

let statsBeforeCalcTimes;
let statsAfterCalcTimes;

function initializeFrameStats(brd = board) {
    frameCounter = -1;

    frameNumber = new Array(framesToRun);
    frameDrawTimes = new Array(framesToRun);
    frameCalcTimes = new Array(framesToRun);
    frameTotalTimes = new Array(framesToRun);

    frameIntervalTimes = new Array(framesToRun);
    frameTargetIntervalTimes = new Array(framesToRun);
    frameIntervalDelays = new Array(framesToRun);

    frameBounces = new Array(framesToRun);
    frameComplexBounces = new Array(framesToRun);
    frameBlocksDestroyed = new Array(framesToRun);
    frameBlocksOnBoard = new Array(framesToRun);
    frameBallsThrown = new Array(framesToRun);
    frameBallsOnBoard = new Array(framesToRun);
    frameDrawTimeDifferentials = new Array(framesToRun);

    statsBeforeCalcTimes = new Array(framesToRun);
    statsAfterCalcTimes = new Array(framesToRun);

    if(!(brd instanceof Board)) brd = board;
    brd.engine.addToQueue("beforeDraw", updateFrameStatsBefore);
    brd.engine.addToQueue("afterTermination", finalFrameStats);
}



function updateFrameStatsBefore() {
    if (frameCounter >= 0) {
        statsAfterCalcTimes[frameCounter] = frameEndTime - calcEndTime;
        frameTotalTimes[frameCounter] = frameEndTime - oldFrameStartTime;
        frameIntervalTimes[frameCounter] = newFrameStartTime - oldFrameStartTime;
        frameIntervalDelays[frameCounter] = frameIntervalTimes[frameCounter] - frameTargetIntervalTimes[frameCounter];
    } else {
        initTime = fireTime - newFrameStartTime;
    }
    oldFrameStartTime = newFrameStartTime;
    frameCounter++;


    board.engine.addToQueue("beforeDraw", updateFrameStatsBefore);
    board.engine.addToQueue("beforeRecalc", updateFrameStatsMid);
    board.engine.addToQueue("afterRecalc", updateFrameStatsAfter, true);


    frameBounceCounter = 0;
    frameComplexBounceCounter = 0;
    frameBlocksDestroyedCounter = 0;
    frameBallsThrownCounter = 0;
    frameBallsOnBoard[frameCounter] = board.activeBalls.length;
    frameBlocksOnBoard[frameCounter] = board.blocks.length;
    drawStartTime = performance.now();
}

function updateFrameStatsMid() {
    calcStartTime = performance.now();
}

function updateFrameStatsAfter() {
    calcEndTime = performance.now();

    if (board.engine.queues.current.length > 1) {
        //console.log("updateFrameStatsAfter delayed");
        board.engine.addToQueue("current", updateFrameStatsAfter, true);
    }
    if (board.engine.queues.currentName.substring(0, 11) != "afterRecalc") throw new Error("updateFrameStatsAfter running in the wrong queue!");


    frameNumber[frameCounter] = frameCounter;
    statsBeforeCalcTimes[frameCounter] = drawStartTime - oldFrameStartTime;
    frameDrawTimes[frameCounter] = calcStartTime - drawStartTime;
    frameDrawTimeDifferentials[frameCounter] = drawTimeDifferential;
    frameCalcTimes[frameCounter] = calcEndTime - calcStartTime;

    frameTargetIntervalTimes[frameCounter] = board.engine.timeoutInterval;

    frameBounces[frameCounter] = frameBounceCounter;
    frameComplexBounces[frameCounter] = frameComplexBounceCounter;
    frameBlocksDestroyed[frameCounter] = frameBlocksDestroyedCounter;
    frameBallsThrown[frameCounter] = frameBallsThrownCounter;
}

function finalFrameStats() {
    statsAfterCalcTimes[frameCounter] = frameEndTime - calcEndTime;
    frameTotalTimes[frameCounter] = frameEndTime - oldFrameStartTime;
    frameIntervalTimes[frameCounter] = performance.now() - oldFrameStartTime;
    frameIntervalDelays[frameCounter] = frameIntervalTimes[frameCounter] - frameTargetIntervalTimes[frameCounter];
    //finishes the job which 'before' function usually does



    frameCounter++;

    frameNumber.length = frameCounter;
    frameDrawTimes.length = frameCounter;
    frameDrawTimeDifferentials.length = frameCounter;
    frameCalcTimes.length = frameCounter;
    frameTotalTimes.length = frameCounter;

    statsBeforeCalcTimes.length = frameCounter;
    statsAfterCalcTimes.length = frameCounter;

    frameIntervalTimes.length = frameCounter;
    frameTargetIntervalTimes.length = frameCounter;
    frameIntervalDelays.length = frameCounter;

    frameBounces.length = frameCounter;
    frameComplexBounces.length = frameCounter;
    frameBlocksDestroyed.length = frameCounter;
    frameBlocksOnBoard.length = frameCounter;
    frameBallsThrown.length = frameCounter;
    frameBallsOnBoard.length = frameCounter;


    console.log("\n--------------round end stats--------------\n" + frameCounter + " frames");
    printStats("frameDrawTimes", frameDrawTimes);
    printStats("frameDrawTimeDifferentials", frameDrawTimeDifferentials);
    printStats("frameCalcTimes", frameCalcTimes);
    printStats("frameTotalTimes", frameTotalTimes);

    //printStats("statsBeforeCalcTimes", statsBeforeCalcTimes);
    //printStats("statsAfterCalcTimes", statsAfterCalcTimes);

    printStats("frameIntervalTimes", frameIntervalTimes);
    printStats("frameTargetIntervalTimes", frameTargetIntervalTimes);
    printStats("frameIntervalDelays", frameIntervalDelays);
    console.log("\n");

    //printStats("frameBounces", frameBounces);
    //printStats("frameComplexBounces", frameComplexBounces);
    //printStats("frameBlocksDestroyed", frameBlocksDestroyed);
    //printStats("frameBlocksOnBoard", frameBlocksOnBoard);
    //printStats("frameBallsThrown", frameBallsThrown);
    //printStats("frameBallsOnBoard", frameBallsOnBoard);

    //console.log("Line class, consistency of 'containsPoint' method:  " + Line.consistent + " consistent runs\t\t inconsisent runs: " + Line.inconsistent);



    //console.log(frameNumber);
    //console.log(frameDrawTimes);
    //console.log(frameCalcTimes);
    //console.log(frameTotalTimes);

    //console.log(statsBeforeCalcTimes);
    //console.log(statsAfterCalcTimes);

    //console.log(frameIntervalTimes);
    //console.log(frameTargetIntervalTimes);
    //console.log(frameIntervalDelays);

    //console.log(frameBounces);
    //console.log(frameComplexBounces);
    //console.log(frameBlocksDestroyed);
    //console.log(frameBlocksOnBoard);
    //console.log(frameBallsThrown);
    //console.log(frameBallsOnBoard);

    board.engine.addToQueue("beforeFire", initializeFrameStats);

    /*//console.log((frameStart - startTime) + " milliseconds.   Avg interval (includes initial frame):  " + ((frameStart - startTime) / (framesToRun + 1)));
    //console.log("Initial Frame: " + initialFrameCalcTime);
    let avg = myMean(frameCalcTimes);
    let med = myMedian([...frameCalcTimes]);
    let stdev = myStd(frameCalcTimes, 1, avg);
    let max = Math.max(...frameCalcTimes);
    let min = Math.min(...frameCalcTimes);
    //console.log("Frame Calc Times.   avg: " + avg + "   med: " + med + "  std: " + Math.round(stdev * 1000) / 1000 + "  min: " + min + "  max: " + max);
    //console.log("CALC-TIME CORRELATIONS   Frame#: " + Math.round(sampleCorrelation(frameNumber, frameCalcTimes) * 1000) / 1000 +
        "   Bounces: " + Math.round(sampleCorrelation(frameBounces, frameCalcTimes) * 1000) / 1000 +
        "   Complex Bounces: " + Math.round(sampleCorrelation(frameComplexBounces, frameCalcTimes) * 1000) / 1000
    );
    //console.log("Blocks Destroyed: " + Math.round(sampleCorrelation(frameBlocksDestroyed, frameCalcTimes) * 1000) / 1000 +
        "  Blocks on Board: " + Math.round(sampleCorrelation(frameBlocksOnBoard, frameCalcTimes) * 1000) / 1000 +
        "  Balls Thrown: " + Math.round(sampleCorrelation(frameBallsThrown, frameCalcTimes) * 1000) / 1000 +
        "  Balls on Board: " + Math.round(sampleCorrelation(frameBallsOnBoard, frameCalcTimes) * 1000) / 1000
    );*/
}

function findLostBalls() {
    let balls = board.balls
    let lostBalls = 0;
    for (let i = 0; i < balls.length; i++) {
        if (balls[i].position.x > 400 || balls[i].position.x < 0 || balls[i].position.y > 800 || balls[i].position.y < 0) {
            //console.log("Lost ball, index#: " + i);
            //console.log(balls[i]);
            lostBalls++;
        }
    }
    //console.log("Total lost balls : " + lostBalls);
}


function testTrig() {
    let corners = board.corners;
    for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
            if (i == j) continue;
            slope = corners[i].slopeTo(corners[j]);
            angle = corners[i].angleTo(corners[j]);
            //console.log(corners[i] + "   --->    " + corners[j] + "       slope: " + slope + "   angle: " + angle);
        }
    }
}


function drawColorGrid() {  //change canvas size to width="1600" height="22800" (in html tag)
    let row = 1;
    let col = 0;
    let white = new Color(255, 255, 255);

    for (let grey = 0; grey <= 256; grey += 4, col++) {
        if (grey == 256) grey = 255;
        defaultBlocks.push(new Block(col, row, grey, new Color(grey, grey, grey)));
    }

    for (let blue = 0; blue <= 256; blue += 16) {
        if (blue == 256) blue = 255;
        row++;
        defaultBlocks.push(new Block(0, row, blue, white));
        for (let green = 0; green <= 256; green += 4) {
            if (green == 256) green = 255;

            col = 0;
            row++;
            defaultBlocks.push(new Block(col++, row, green, white));

            for (let red = 0; red <= 256; red += 4) {
                if (red == 256) red = 255;
                defaultBlocks.push(new Block(col, row, red, new Color(red, green, blue))); //re-arrange to change order of display (currently red = x, green = y, blue = new "layer" segment)
                col++;
            }
            defaultBlocks.push(new Block(col, row, green, white));
        }
    }

    let board = new Board(context);
    board.draw();


}

function sigDigitsTest(binaryRoundingExponent = 16) {
    let r = 1 / (2 ** (binaryRoundingExponent + 2));
    while (binaryRoundingExponent > 0) {
        r += 1 / (2 ** binaryRoundingExponent);
        binaryRoundingExponent -= 2;
    }

    if (r === 1) throw new Error();
    let offset = 0;
    let sigDigits = 0.5; //great than zero, but won't equal the first result from getSigDigits
    let testUpTo = -1;
    let increment = 0;

    while (sigDigits > 0) {
        let num = offset + r
        let number = num - offset;

        if (sigDigits !== (sigDigits = getSigDigits(number))) {
            if (offset <= testUpTo && increment <= 1 && increment !== 0) {
                //if (increment !== 1) throw new Error();
                //console.log(number.toFixed(sigDigits) + " \toffset: " + offset + " \toffset Log2: " + Math.log2(offset) + " \tsigDigits (decimal): " + sigDigits);
                if (offset === 0) offset = 0.5;
                increment = 0;

            } else {
                if (increment === 0) {
                    testUpTo = offset;
                    increment = Math.max(offset / 2, 1);
                }


                if (offset > 0) {
                    offset -= increment;
                    increment /= 2;

                    num = offset + r;
                    number = num - offset;
                    sigDigits = getSigDigits(number);
                } else {
                    sigDigits = 0.5
                    increment = 1;
                }
                if (sigDigits !== getSigDigits(num) && offset > 0 && num >= 1) throw new Error();
            }
        } else if (sigDigits !== getSigDigits(num) && offset > 0 && num >= 1) throw new Error();

        if (offset < testUpTo) offset += increment; else offset *= 2;
    }
}

function getSigDigits(number) {
    let numString = number.toString()
    let sigDigits = numString.search('e');

    if (sigDigits > -1) {
        let e = numString.slice(sigDigits + 1);
        if (e[0] === '-') {
            e = e.slice(1);
            sigDigits = parseInt(e) + 1;
        } else sigDigits = 1;
    } else {
        let d = numString.indexOf('.');
        if (d > -1)
            sigDigits = numString.length - d;
        else sigDigits = 1;
    }

    while (numString.slice(-4) !== "0000") {
        sigDigits++;
        numString = number.toFixed(sigDigits);
    }
    return sigDigits - 4;
}

initializeLogger?.("metrics ran");