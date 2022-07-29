"use strict"; document.currentScript.initTime = performance.now();

function mtm(margin = 0) { //minor to major canvas
    board.majorOffscreen.context.drawImage(board.minorOffscreen, board.x - margin, board.y - margin, board.width + margin * 2, board.height + margin * 2, board.x - margin, board.y - margin, board.width + margin * 2, board.height + margin * 2);
}

function mtb(margin = 0) { //major to board canvas
    UI.board.context.drawImage(board.majorOffscreen, board.x - margin, board.y - margin, board.width + margin * 2, board.height + margin * 2, board.x - margin, board.y - margin, board.width + margin * 2, board.height + margin * 2);
}

function showOffscreens() {
    let offscreens = UI.board.canvas.offscreenCanvases;
    offscreens.forEach(canvas => document.body.appendChild(canvas));
}


function pause() {
    window.clearInterval(Engine.intervalID);
    Engine.intervalID = undefined;
    Engine.intervalHandler = undefined;
}

function restart(interval = board.engine.timeoutInterval, frameSeconds = board.engine.frameSeconds) {
    board.engine.frameSeconds = frameSeconds;
    try { Engine.startInterval(board.engine.nextFrame, interval); }
    catch (err1) {
        try { Engine.replaceInterval(board.engine.nextFrame, interval); }
        catch (err2) {
            console.log("couldn't restart engine!!");
            console.log(err1);
            console.log(err2);
        }
    }
}

function drawPath(ballOrIndex, color = WHITE.string, context = board.context) {
    if (ballOrIndex instanceof Ball) var ball = ballOrIndex
    else ball = board.balls[ballOrIndex]

    context.beginPath();
    context.lineWidth = 0.8;
    context.strokeStyle = color.toString();

    if (ball.bounceLog.positions.length < 32) {
        context.moveTo(board.ballOrigin.x, board.ballOrigin.y);
    } else {
        context.moveTo(ball.bounceLog.positions[ball.bounceLog.positions.length - 1].x, ball.bounceLog.positions[ball.bounceLog.positions.length - 1].y);
    }
    for (let i = ball.bounceLog.positions.length - 1; i >= 0; i--) {
        context.lineTo(ball.bounceLog.positions[i].x, ball.bounceLog.positions[i].y)
    }
    context.stroke();
    if (ball.currentPosition.notEqualTo(ball.bounceLog.positions[0])) {
        context.beginPath()
        context.strokeStyle = LIGHT_ORANGE.string;
        context.moveTo(ball.bounceLog.positions[0].x, ball.bounceLog.positions[0].y)
        context.lineTo(ball.x, ball.y);
        context.stroke();
    }

    if (ball.currentPosition.notEqualTo(ball.newPosition)) {
        context.beginPath();
        context.strokeStyle = RED.string;
        context.moveTo(ball.x, ball.y);
        context.lineTo(ball.newPosition.x, ball.newPosition.y);
        context.stroke();
    }
}


function backtrackBalls(logIndex, firstErrorBallId = board.balls.length) {
    board.activeBalls.forEach((ball) => {
        let index = logIndex - (ball.id > firstErrorBallId ? 1 : 0);
        if (!(ball.onBoard && ball.bounceLog) || index < 0) return;
        if (ball.bounceLog.positions.length - 1 <= index) {
            if (ball.bounceLog.positions.length === 0) {
                index = 0;
                ball.bounceLog.incomingAngles[0] = board.ballVelocity.direction;
                ball.bounceLog.positions[index] = board.ballOrigin;
            } else index = ball.bounceLog.positions.length - 1;
        }
        console.log("BALL ID: " + ball.id + " backtracking to log index: " + index +
            + "\nCURRENT STATE\nremainingFrameSeconds: " + ball.remainingFrameSeconds + " remainingDistance: " + ball.remainingDistance
            + "\ndirection: " + ball.direction.degrees + " Positions current: (" + ball.position.x + " , " + ball.position.y + ") old: (" + ball.oldPosition.x + " , " + ball.oldPosition.y + ") new: (" + ball.newPosition.x + " , " + ball.newPosition.y + ")");
        ball.currentPosition = ball.bounceLog.positions[index];
        ball.newPosition = ball.currentPosition;
        ball.oldPosition = ball.bounceLog.positions[index + 1] ?? board.ballOrigin;
        ball.vector.recalc();
        ball.velocity.direction.degrees = ball.bounceLog.details[index].preEscapeLog?.incomingAngle_orig ?? ball.bounceLog.incomingAngles[index];
        ball.collisionSurfaces = [...(ball.bounceLog.details[index].preEscapeLog?.collisionSurfaces ?? ball.bounceLog.details[index].collisionSurfaces)];
        ball.remainingDistance = 0;
        ball.remainingFrameSeconds = 0;
        console.log(ball.bounceLog.positions.splice(0, index + 1));
        console.log(ball.bounceLog.incomingAngles.splice(0, index + 1));
        console.log(ball.bounceLog.details.splice(0, index + 1));
        console.log("BALL ID: " + ball.id + " backtracked to log index: " + index + "\n(NEW) BACKTRACKED STATE\ndirection: "
            + ball.direction.degrees + " Positions current: (" + ball.position.x + " , " + ball.position.y + ") old: (" + ball.oldPosition.x + " , " + ball.oldPosition.y + ") new: (" + ball.newPosition.x + " , " + ball.newPosition.y + ")\n\n");
    });
}

function removeBallsExcept(ballsToKeep) { //array of balls to keep -- can use ball id or ball object itself (or mix of these two)
    if (!(ballsToKeep instanceof Array))
        throw new Error("Must submit ARRAY of ids of balls to keep.  Empty array if removing all");

    for (let i = board.activeBalls.length - 1; i >= 0; i--) {
        let ball = board.activeBalls[i];
        if (ballsToKeep.indexOf(ball.id) > -1 || ballsToKeep.indexOf(ball) > -1) continue;
        ball.y = board.ballOrigin.y;
        ball.onBoard = false;
        board.activeBalls.splice(i, 1);
    }
}


Date.currentTime = function currentTime() {
    let date = new Date(Date.now());
    return (((date.getHours() + 11) % 12) + 1) + ":" + (date.getMinutes() < 10 ? "0" : "") + date.getMinutes() + ":" + (date.getSeconds() < 10 ? "0" : "") + date.getSeconds() + (date.getHours() >= 12 ? "pm" : "am");
}

let polygonColor = WHITE.string;
Object.defineProperty(Polygon.prototype, "highlight", {
    get: function highlight() {
        //lazy getter defines recursive returning of a highlight object, which allows multiple re-highlights  (for debugging from the console)
        let highlightProto = Object.defineProperty({}, "highlight", { get: () => { return this.highlight } });

        Object.defineProperty(this, "highlight", {
            get: () => {
                if (polygonColor) UI.board.context.strokeStyle = polygonColor;
                this.segments.forEach((segment) => segment.draw(undefined, polygonColor))
                return Object.setPrototypeOf({ time: Date.currentTime() }, highlightProto);
            }
        });

        return this.highlight;
    }
});


let segmentColor = RED.string;
let segmentEndpoints = false;
Object.defineProperty(Segment.prototype, "highlight", {
    get: function highlight() {
        //lazy getter defines recursive returning of a highlight object, which allows multiple re-highlights  (for debugging from the console)
        let highlightProto = Object.defineProperty({}, "highlight", { get: () => { return this.highlight } });

        Object.defineProperty(this, "highlight", {
            get: () => {
                if (segmentColor) UI.board.context.strokeStyle = segmentColor;
                this.draw(undefined, segmentEndpoints);
                return Object.setPrototypeOf({ time: Date.currentTime() }, highlightProto);
            }
        });
        return this.highlight;
    }
});


let pointColor = BLACK.string;
let fillPoints = false; //to fill, use 'true' for the same color as outline, or substitute a a different color for filling
Object.defineProperty(Position.prototype, "highlight", {
    get: function highlight() {
        //lazy getter defines recursive returning of a highlight object, which allows multiple re-highlights  (for debugging from the console)
        let highlightProto = Object.defineProperty({}, "highlight", { get: () => { return this.highlight } });

        Object.defineProperty(this, "highlight", {
            get: () => {
                if (pointColor) UI.board.context.strokeStyle = pointColor;
                this.draw(undefined, undefined, fillPoints);
                return Object.setPrototypeOf({ time: Date.currentTime() }, highlightProto);
            }
        });
        return this.highlight;
    }
});


async function generateUserID() {
    let id = [];
    for (let i = 0; i < idLength; i++) {
        id.push(allowedCharCodes[Math.floor(Math.random() * allowedCharCodes.length)]);
    }
    return String.fromCharCode(...id);
}


async function find_async(object, inObj, nonenums = false, symbols = false, protoChain = false) {
    return find_sync(object, inObj, nonenums, symbols, protoChain);
}


function find_sync(object, inObj, nonenums = false, symbols = false, protoChain = false) {
    const __PROTO__ = protoChain ? Symbol("__proto__") : undefined;
    let hierarchy = [];
    let traversed = [];
    let errors = [];
    traverse(inObj, Symbol("Root object"));
    function traverse(obj, k) {
        hierarchy.push({ [k]: obj });

        if (obj === object)
            console.log([...hierarchy]);

        if (PRIMITIVES.includes(typeof obj) || obj === null) {
            if (protoChain && obj !== null && obj !== undefined) {
                let primitiveProto = Object.getPrototypeOf(obj);
                if (!traversed.includes(primitiveProto))
                    traverse(primitiveProto, __PROTO__);
            }
        } else if (!traversed.includes(obj)) {
            traversed.push(obj);

            let keys = Object.getEnumerableKeys(obj);

            if (nonenums) keys.push(...Object.getOwnPropertyNames(obj));

            if (symbols) keys.push(...Object.getOwnPropertySymbols(obj));
            if (nonenums || symbols) keys = keys.filter((key, index) => index === keys.indexOf(key));

            for (let key of keys) {
                try {
                    traverse(obj[key], key);
                } catch (err) {
                    err.key = key;
                    err.obj = obj;
                    err.hierarchy = [...hierarchy];
                    errors.push(err);
                }
            }
            if (protoChain) {
                try {
                    traverse(Object.getPrototypeOf(obj), __PROTO__);
                } catch (err) {
                    err.key = key;
                    err.obj = obj;
                    err.hierarchy = [...hierarchy];
                    errors.push(err);
                }
            }
        }
        hierarchy.pop();
    }
    return errors;
}


function countUndefined(object) {
    let counter = {};
    let objectsTraversed = [];
    let objectsWithUndefined = [];
    let objectsWithoutUndefined = [];
    traverse(object)
    function traverse(object) {
        if (objectsTraversed.includes(object) || typeof object !== "object") return;
        objectsTraversed.push(object);
        let hasUndefined = false;
        for (let key in object) {
            if (object[key] === undefined) {
                counter[key] = (counter[key] ?? 0) + 1;
                hasUndefined = true;
            } else traverse(object[key]);
        }
        if (hasUndefined) objectsWithUndefined.push(object);
        else objectsWithoutUndefined.push(object);
    }

    return {
        counter: counter,
        objectsTraversed: objectsTraversed,
        objectsWithUndefined: objectsWithUndefined,
        objectsWithoutUndefined: objectsWithoutUndefined
    }

}


/*
let loopingBlocks = new Array(20);
for (let i = 0; i < 10; i++) {
    loopingBlocks[i] = new DirectionalBlock(ANGLE.up, i * 2 * Block.standardSize, 25 * Block.standardSize);
}
for (let i = 10; i < 20; i++) {
    loopingBlocks[i] = new DirectionalBlock(ANGLE.down, (i - 10) * 2 * Block.standardSize, 20 * Block.standardSize);
}



let randomBlocks = new Array(360);
for (let i = 0; i < randomBlocks.length; i++) {
    let random = Math.random();
    if (i % 20 == 19)
        randomBlocks[i] = new SimpleRectangleBlock(2, 19 * Block.standardSize, (5 + Math.trunc(i / 20)) * Block.standardSize);
    else if (random > 0.70)
        randomBlocks[i] = new RightTriangleBlock(Math.round((15 ** Math.random()) ** 2), i % 20 * Block.standardSize, (5 + Math.trunc(i / 20)) * Block.standardSize, ANGLES_45[Math.trunc(Math.random() * 4)]);
    else if (random > 0.10)
        randomBlocks[i] = new SimpleRectangleBlock(Math.round((15 ** Math.random()) ** 2), i % 20 * Block.standardSize, (5 + Math.trunc(i / 20)) * Block.standardSize);
    else
        randomBlocks[i] = new DirectionalBlock(CARDINAL_DIRECTIONS[Math.trunc(Math.random() * 4)], i % 20 * Block.standardSize, (5 + Math.trunc(i / 20)) * Block.standardSize);
}*/


initializeLogger?.("debug ran");