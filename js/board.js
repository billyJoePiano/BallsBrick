"use strict"; document.currentScript.initTime = performance.now();

class Board extends BoardTemplate {
    constructorArgs() { return ["template"]; }
    mustEnumerate() { //some of these could probably be moved to regular enumerate()
        return [
            "balls",
            "ballOrigin",
            "ballVelocity",
            "ballFireInterval",
            "blocks",
            "activeBalls",
            //"engine", //need to figure out how to stringify/revive function queues and engine state
            "hitsPerSecondLog",
            "nextBallIndex",
            "blocksLeft",
            "currentBlocks",
            "blockSpeed",
            "aimTowards",
            "aimDirection",
            "resting",
            "targetDirection",
            "diagonalDistance",
            "accumulatedTime",
            "accumulatedSpeedUps",
            "requestSpeedUps",
            "blockRow",
            "oldDirection",
            "cannonMidpoint",
            "cannonSpeed",
            "secondTargetDirection",
            "engine"
        ];
    }

    constructor(boardTemplate) {
        if (boardTemplate instanceof BoardTemplate) super(boardTemplate);
        else throw new Error("play board must be based on a template!");
        this.template = boardTemplate;

        this.balls = new Array(this.balls);
        for (let i = 0; i < this.balls.length; i++) {
            this.balls[i] = new Ball(this);
            this.balls[i].id = i;
        }
        this.activeBalls = new Array();

        let context;
        defineProperties(this, {
            context: {
                get: () => context,
                set: (value) => {
                    context = value;
                    let offscreens = value?.canvas.offscreenCanvases;
                    this.majorOffscreen = offscreens?.[0];
                    this.minorOffscreen = offscreens?.[1];

                    if (this.majorOffscreen && this.minorOffscreen) {
                        this.blocksToRedraw = [...this.blocks];
                        this.majorOffscreen.context.clearRect(this.x, this.y, this.width, this.height);

                        this.majorOffscreen.redraw = (context) => {
                            //'brute force' is more efficient since it is a total redraw ... no point in calculating dirty regions
                            console.log("redraw invoked on major offscreen");
                            context.clearRect(this.x, this.y, this.width, this.height);
                            for (let block of this.blocks) {
                                block.draw(context);
                            }
                        }
                    }
                }
            }
        });

        this.engine = new Engine(this);
        if(recordMetrics) initializeFrameStats(this);
        if (this.afterEngineConstructionFuncs instanceof Array) this.afterEngineConstructionFuncs.forEach((func) => func(this.engine));

        this.hitsPerSecondLog = new Array(5);

        /* moving these to firstRound
        this.makePointerRect();
        this.bindFunctions();
         */

    }

    afterEngineConstruction(funcToInvoke) {
        if (!(funcToInvoke instanceof Function)) throw new Error();
        if (!this.afterEngineConstructionFuncs) {
            if (this.engine instanceof Engine) throw new Error();
            this.afterEngineConstructionFuncs = new Array();
        }
        this.afterEngineConstructionFuncs.push(funcToInvoke);
    }

    makePointerRect() {
        //after generating the surfaces, the boundaries are expanded to include the canvas borders, for pointer event purposes
        let computedStyle = getComputedStyle(UI.board.canvas);
        let borders = {
            left: Number.parseFloat(computedStyle.borderLeftWidth),
            right: Number.parseFloat(computedStyle.borderRightWidth),
            top: Number.parseFloat(computedStyle.borderTopWidth),
            bottom: Number.parseFloat(computedStyle.borderBottomWidth),
        }

        this.pointerFlags.rectangle = new Rectangle(this.x - borders.left, this.y - borders.top, this.x + this.width + borders.left + borders.right, this.y + this.height + + borders.top + borders.bottom);
    }

    bindFunctions() {  //prevents having to re-create 'bound' versions of these functions everytime they are placed in the engine queue
        this.advanceBlocks = this.advanceBlocks.bind(this);
        this.gatherBalls = this.gatherBalls.bind(this);
        this.moveCannon = this.moveCannon.bind(this);
        this.updateEngineSpeed = this.updateEngineSpeed.bind(this);
    }

    firstRound() {
        this.makePointerRect();
        this.bindFunctions();

        this.balls.forEach((ball, index, array) => { ball.y = board.y + board.height; ball.x = board.x + board.width * index / Math.max(array.length - 1, 1); });
        this.newRound(true);
    }

    endRound() {
        this.hitsPerSecondLog.index = -this.hitsPerSecondLog.index; //??? this could probably be deleted
        Engine.terminate(this.engine.nextFrame, this.engine);
    }

    newRound(firstRound = false) { //set to true when invoked from firstRound
        this.canvas.style.cursor = "wait";
        if(!firstRound) this.newBallOrigin();

        this.nextBallIndex = this.balls.length;
        this.balls.forEach((ball) => {
            try {
                ball.updateVectorDestination(this.ballOrigin);
                ball.direction = ball.currentPosition.angleTo(this.ballOrigin);
            }
            catch (err) { if (err.message !== "Cannot recalc line slopes/intercepts when both points are the same") throw err; }
            ball.speed = this.ballVelocity.speed;
        });

        if (this.activeBalls.length > 0) throw new Error("There are still balls in the active balls array!");
        this.activeBalls.push(...this.balls);
        this.activeBalls.sort((ball1, ball2) => { return ball1.x - ball2.x; });
        let halfIndex = Math.ceil(this.activeBalls.length / 2);
        let upperLength = this.activeBalls.length - halfIndex;
        let upperHalf = this.activeBalls.splice(halfIndex, upperLength);
        this.activeBalls.reverse().push(...(upperHalf.reverse()));

        if (firstRound) {
            this.blocksLeft = [];
            this.currentBlocks = [];
            this.blockSpeed = [];

        } else if (this.blocksLeft.length === 0 && this.currentBlocks.length === 0 && this.blockSpeed.length === 0) {
            this.blockRow = this.height - Block.standardSize;
            this.blocksLeft.push(...this.blocks);
            this.currentBlocks.pixelsToAdvance = Block.standardSize;
            this.drawBlocks = function drawBlocksBruteForce(context) {
                for (let block of this.blocks) {
                    block.draw(context);
                }
            }
        } else throw new Exception("Block advancing arrays are not length 0 or do not exist!");



        this.engine.requestAnimation(() => this.engine.requestAnimation(this.advanceBlocks, true), true); //delayed by one frame to allow engine.runIdleQueues to adjust timeoutInterval and frameSeconds
    }

    advanceBlocks(seconds) {

        if (this.blocksLeft.length > 0 || this.currentBlocks.length > 0) {
            if (this.currentBlocks.length <= 0) { // start on next row
                this.blockRow -= Block.standardSize;
                let block = undefined;
                for (let i = 0; i < this.blocksLeft.length; i++) {
                    if (this.blocksLeft[i].y + this.blocksLeft[i].height > this.blockRow) {
                        block = this.blocksLeft.splice(i--, 1)[0];
                        if (block.setNextRoundPositions(this.currentBlocks.pixelsToAdvance)) {
                            this.currentBlocks.push(block);
                            delete block.drawBufferRectangle;
                        }
                    }
                }
                this.blockSpeed.length = this.currentBlocks.length;
                this.blockSpeed.fill(Board.blockMinSpeed);
            }

            for (let i = 0; i < this.currentBlocks.length; i++) {
                let remainingDistance = this.currentBlocks[i].move(seconds * this.blockSpeed[i]);
                if (remainingDistance === 0) {
                    this.currentBlocks.splice(i, 1);
                    this.blockSpeed.splice(i--, 1);
                } else if (remainingDistance <= this.currentBlocks.pixelsToAdvance / 3) {
                    this.blockSpeed[i] = Math.max(this.blockSpeed[i] - Board.blockAccel * seconds * 2, Board.blockMinSpeed); // deccelerate faster since decceleration doesn't start till 2/rds through
                } else {
                    this.blockSpeed[i] += Board.blockAccel * seconds;
                }

            }

            this.engine.requestAnimation(this.advanceBlocks, true);

        } else  {
            if (!this.lostFlag) {
                if (this.drawBlocks !== Board.prototype.drawBlocks) {
                    // reverts back to the prototype function which doesn't brute-force the drawing (only redraws blocks that need it)
                    // the condition is only so this is skipped on the first round, where it is not neccessary
                    delete this.drawBlocks;
                    this.blocksToRedraw = [...this.blocks];
                    this.majorOffscreen.context.clearRect(this.x, this.y, this.width, this.height);
                }

                this.engine.rebuildCaches();
                this.engine.requestAnimation(this.gatherBalls, true);
            }
        }
    }


    gatherBalls(seconds) {
        seconds *= Board.ballGatheringSpeedMultiplier
        this.activeBalls[0].onBoard = true;
        this.activeBalls[0].eventTiming = null;

        this.activeBalls[this.activeBalls.length - 1].onBoard = true;
        this.activeBalls[this.activeBalls.length - 1].eventTiming = null;


        let keepGoing = true;
        let lowerSeconds = seconds;
        let upperSeconds = seconds;
        while (this.activeBalls.length > 0 && keepGoing) {
            keepGoing = false;
            if (lowerSeconds > 0 && this.activeBalls[0].move(lowerSeconds)) {
                lowerSeconds = this.activeBalls[0].remainingFrameSeconds
                this.activeBalls.shift();
                if (this.activeBalls.length === 0) break;
                else if (this.activeBalls.length === 1) {
                    lowerSeconds = Math.max(lowerSeconds, upperSeconds);
                    upperSeconds = 0;
                }
                this.activeBalls[0].onBoard = true;
                keepGoing = true;
            } else lowerSeconds = 0;


            if (upperSeconds > 0 && this.activeBalls[this.activeBalls.length - 1].move(upperSeconds)) {
                upperSeconds = this.activeBalls[this.activeBalls.length - 1].remainingFrameSeconds
                this.activeBalls.pop();
                if (this.activeBalls.length === 0) break;
                this.activeBalls[this.activeBalls.length - 1].onBoard = true;
                keepGoing = true;
            } else upperSeconds = 0;

            if(keepGoing) this.draw();
        }
        //this.draw(); //not neccessary here because this will be done by engine.runIdleQueues, which waa the direct invoker of this

        if (this.activeBalls.length <= 0) {
            this.nextBallIndex = 0;
            this.resting = true;
            this.targetDirection = undefined;
            this.canvas.style.cursor = "crosshair";

            disruptLoops_resetVariables();
            this.aim();

        } else {
            this.engine.requestAnimation(this.gatherBalls, true);
        }
    }

    lost() {
        this.lostFlag = {
            top: new DisplayText("GAME LOST", OFF_WHITE, new Position(this.x + this.width / 2, this.y + this.height / 3), undefined, undefined, "48px Times New Roman"),
            bottom: new DisplayText("PRESS 'RESTART GAME' TO TRY AGAIN", OFF_WHITE, new Position(this.x + this.width / 2, this.y + this.height * 2 / 3), undefined, undefined, "24px Times New Roman"),
        };
    }

    pointerMoved(event) {
        this.aim(event);
    }

    pointerEvent(event) {
        this.aim(event);
    }

    keydown(event) {
        if (event.which === 27) this.esc();
    }

    esc() {
        this.aimDirection = undefined;
        this.escapeFromClick();

        if (this.resting) this.draw();
    }

    click(event) {
        //console.info(event?.type, event, Object.assign({ x: this.pointerFlags.position.x, y: this.pointerFlags.position.y }, this.pointerFlags));
        if (Number.isFinite(this.aimDirection)) {
            if (event.shiftKey) {
                board.ballOrigin.x = event.offsetX;
                board.ballOrigin.y = event.offsetY;
                board.balls.forEach((ball) => {
                    ball.setPosition(event.offsetX, event.offsetY);
                });
            } else {
                fireTime = performance.now();
                this.fire();
            }
        }
    }


    aim(event) {
        /*
        let pointerFlags = Object.assign({ x: this.pointerFlags.position.x, y: this.pointerFlags.position.y }, this.pointerFlags);
        pointerFlags.hoverPointers = Object.assign([], this.pointerFlags.hoverPointers);
        pointerFlags.depressedPointers = Object.assign([], this.pointerFlags.depressedPointers);
        delete pointerFlags.position;
        console.log(event?.type, event, Object.assign({ x: this.pointerFlags.position.x, y: this.pointerFlags.position.y }, this.pointerFlags));
        */

        let towards = this.pointerFlags.position
        if (this.pointerFlags.depressedAndOver && !this.pointerFlags.escapeFromClick && this.ballOrigin.notEqualTo(towards)) {
            this.aimDirection = this.angleTo(towards);

        } else if (this.aimDirection === (this.aimDirection = undefined)) {
            return; //no need to re-draw;
        }

        if (this.resting) this.draw();
    }

    drawPredictionBounces() {
        this.balls.forEach(ball => ball.position = this.ballOrigin);
        if (!this.aimDirection) return; // can't draw a prediction without a direction
        this.balls[0].direction = this.aimDirection
        this.balls[0].speed = this.ballVelocity.speed;
        this.balls[0].newBounceLog();

        this.context.strokeStyle = "rgb(255, 255, 255)"

        for (let i = 0; i < Board.predictionBounces; i++) {
            let prediction = this.engine.predict(this.balls[0]);

            this.context.beginPath();
            this.context.lineWidth = 1.5;
            this.context.moveTo(prediction[0].x, prediction[0].y);
            this.context.lineTo(this.balls[0].x, this.balls[0].y);
            this.context.lineTo(prediction[0].x, prediction[0].y);
            if (prediction.bounced) {
                if (i + 1 >= Board.predictionBounces) { //draw final bounce, predicted direction
                    this.context.lineTo(prediction[1].x, prediction[1].y);
                    this.context.lineTo(prediction[0].x, prediction[0].y);
                }
                this.context.stroke();
                if (prediction[2] && i < 1) {
                    this.context.beginPath();
                    this.context.lineWidth = 0.5;
                    this.context.moveTo(prediction[0].x, prediction[0].y);
                    this.context.lineTo(prediction[2].x, prediction[2].y);
                    this.context.stroke();
                }
            } else {
                this.context.stroke();
                i--;
            }
            this.balls[0].currentPosition = prediction[0];
        }


        this.balls[0].currentPosition = this.ballOrigin;
        this.balls[0].direction = this.aimDirection
        this.balls[0].collisionSurfaces.length = 0;
    }

    fire() {
        if (this.resting) {
            this.resting = false;
            this.nextBallIndex = 0;
            this.ballVelocity.direction = this.aimDirection;
            this.engine.start(this.ballFireInterval);
        } else if (this.nextBallIndex < this.balls.length) {
            if (this.targetDirection === undefined) {
                this.newFireDirection(this.aimDirection);
            } else {
                this.secondTargetDirection = this.aimDirection;
            }
        }
    }

    angleTo(point) { return Math.min(Math.max(this.ballOrigin.angleTo(point, ANGLE_RANGE_360.mostlyPositive), Board.minFireAngle), Board.maxFireAngle)}

    nextBall() {
        if (this.nextBallIndex < this.balls.length) {
            let ball = this.balls[this.nextBallIndex++];
            //this.activeBalls.push(ball);  //this has been moved to the engine, so the ball is added in remaining frame seconds sequence
            ball.velocity.update(this.ballVelocity);
            return ball;
        } else {
            this.canvas.style.cursor = "not-allowed";
            this.accumulatedTime = this.engine.timeoutInterval; //time since last ball fired
            this.accumulatedSpeedUps = 0;
            this.hitsPerSecondLog.fill([0, 0]);
            this.hitsPerSecondLog.index = 0;
            this.requestSpeedUps = new Array();
            this.engine.addToQueue("afterRecalc", this.updateEngineSpeed);
            return undefined;
        }
    }

    updateEngineSpeed() {
        let log = this.hitsPerSecondLog;
        this.accumulatedTime += this.engine.timeoutInterval;
        log[log.index][1] += this.engine.timeoutInterval // ?  / 1000   ??  convert from milliseconds to seconds?  maybe better to keep everything as integers?

        if (log[log.index][1] >= 1000) { //re-evaluate metrics ~once per second, otherwise request speeds up at specified intervals (below 'else' clause)
            let totalSecondsLogged = 0;
            let accumulatedSecondsLogged = 0;
            let weightedTotalHits = 0;
            let weightedDivisor = 0;
            let weightedHitsPerSecond = 0;

            log.forEach((sec) => { totalSecondsLogged += (sec ? sec[1] : 0); }); //add up the number of milliseconds logged, excluding undefined values

            for (let i = log.index; i < log.length; ++i == log.index ? i = log.length : (i == log.length && log.index != 0 ? i = 0 : i)) {
            //starts at the 'index' index, and loops around to the index right before it
                if (log[i][1] <= 0) continue;
                weightedTotalHits += log[i][0] / log[i][1] * (totalSecondsLogged - accumulatedSecondsLogged);
                weightedDivisor += totalSecondsLogged - accumulatedSecondsLogged
                accumulatedSecondsLogged += log[i][1];
            }
            weightedHitsPerSecond = weightedTotalHits / weightedDivisor;

            let numRequests = Math.min(8, Math.round(0.2 / weightedHitsPerSecond));

            if (numRequests > 0) {
                this.engine.speedUp;
                this.accumulatedSpeedUps++;
                this.requestSpeedUps.length = numRequests - 1;
                this.requestSpeedUps.fill(false);
            } else this.requestSpeedUps.length = 0;

            if (++this.hitsPerSecondLog.index == this.hitsPerSecondLog.length) this.hitsPerSecondLog.index = 0;
            this.hitsPerSecondLog[this.hitsPerSecondLog.index] = [0, 0];

        } else if (this.requestSpeedUps.length > 0) { //request speed-ups at specified intervals between metrics measurement
            let currentRequestNum = Math.floor(log[log.index][1] * (this.requestSpeedUps.length + 1) / 1000);
            for (let i = 0; i < currentRequestNum; i++) {
                if (this.requestSpeedUps[i] === false) {
                    if (this.engine.speedUp()) {
                        this.requestSpeedUps[i] = true;
                        this.accumulatedSpeedUps++;
                        break;
                    } else return;
                }
            }
        }
        this.engine.addToQueue("afterRecalc", this.updateEngineSpeed);
    }

    logHit() {
        if (this.hitsPerSecondLog.index >= 0)
            this.hitsPerSecondLog[this.hitsPerSecondLog.index][0]++;
    }

    newFireDirection(angle) {
        if (angle == this.ballVelocity.direction.degrees) return;
        this.targetDirection = angle;
        this.oldDirection = this.ballVelocity.direction.degrees;
        this.cannonMidpoint = (this.oldDirection + angle * 2) / 3; //not the actual halfway-point, obviously... this is the point after which the cannon starts to decelerate
        this.cannonSpeed = 0;
        this.secondTargetDirection = undefined;
        this.moveCannon();
    }

    moveCannon() {
        if (this.targetDirection > this.oldDirection) {
            if (this.ballVelocity.direction.degrees > this.cannonMidpoint) {
                this.cannonSpeed = Math.max(this.cannonSpeed - Board.cannonAccel * this.engine.frameSeconds * 2, Board.cannonMinSpeed); //deceleration after 'mid-point' (actually 2/3rds point) is twice as fast, since it is only half as long
            } else { this.cannonSpeed += Board.cannonAccel * this.engine.frameSeconds; }

            this.ballVelocity.direction.degrees = Math.min(this.ballVelocity.direction.degrees + this.cannonSpeed, Board.maxFireAngle);

            if (this.ballVelocity.direction.degrees >= this.targetDirection) {
                this.ballVelocity.direction.degrees = this.targetDirection;
                if (this.secondTargetDirection !== undefined)
                    this.newFireDirection(this.secondTargetDirection);
                else this.targetDirection = undefined;
                return;
            }
        } else if (this.targetDirection < this.oldDirection) { //probably not neccessary, since an equality check is done by newFireDirection before launcing this loop
            if (this.ballVelocity.direction.degrees < this.cannonMidpoint) {
                this.cannonSpeed = Math.max(this.cannonSpeed - Board.cannonAccel * this.engine.frameSeconds * 2, Board.cannonMinSpeed); //deceleration after 'mid-point' (actually 2/3rds point) is twice as fast, since it is only half as long
            } else { this.cannonSpeed += Board.cannonAccel * this.engine.frameSeconds; }

            this.ballVelocity.direction.degrees = Math.max(this.ballVelocity.direction.degrees - this.cannonSpeed, Board.minFireAngle);

            if (this.ballVelocity.direction.degrees <= this.targetDirection) {
                this.ballVelocity.direction.degrees = this.targetDirection;
                this.targetDirection = undefined;
                if (this.secondTargetDirection !== undefined) this.newFireDirection(this.secondTargetDirection);
                return;
            }
        } else {
            console.log("unexpected result in board.moveCannon.  targetDirection: " + targetDirection + "  oldDirection: " + oldDirection + "  currentDirection: " + this.ballVelocity.direction);
            return;
        }

        //THIS SHOULD BE REFACTORED FOR "duringRecalc"
        this.engine.addToQueue("beforeRecalc", this.moveCannon);
    }




    destroy(block) {
        this.blocks.splice(this.blocks.indexOf(block), 1);
        block.destroyed = true;
        this.engine.destroy(block);
        frameBlocksDestroyedCounter++;

        this.markForRedraw(block);
    }

    remove(ball) {
        this.activeBalls.splice(this.activeBalls.indexOf(ball), 1);
        ball.onBoard = false;
        if (this.activeBalls.length === 0 && this.nextBallIndex >= this.balls.length) this.endRound();
    }

    newBallOrigin() {
        let xs = new Array(this.balls.length)
        this.balls.forEach((ball, index) => {
            xs[index] = ball.x;
        });
        /*let mean = myMean(xs);
        let std = myStd(xs, 1, xs.mean);
        let med = myMedian(xs);
        console.log("Before:    mean: " + mean + "    med: " + med + "    std: " + std);
        xs.splice(xs.length / 3, xs.length / 3);

        mean = myMean(xs);
        std = myStd(xs, 1, xs.mean);
        med = myMedian(xs);
        console.log("After:    mean: " + mean + "    med: " + med + "    std: " + std);

        this.ballOrigin.x = med;*/
        this.ballOrigin.x = myMedian(xs);
    }

    markForRedraw(block) {
        if (!this.blocksToRedraw.includes(block)) this.blocksToRedraw.push(block);
    }

    draw(context = this.context) {
        context.clearRect(this.x, this.y, this.width, this.height);
        this.drawBlocks(context);
        this.drawBalls(context);
        if (this.lostFlag) {
            context.fillStyle = "rgba(0,0,0,0.5)";
            context.fillRect(this.x, this.y, this.width, this.height);
            this.lostFlag.top.draw(context);
            this.lostFlag.bottom.draw(context);

        } else if (this.resting) {
            this.drawPredictionBounces();

        } else if (this.nextBallIndex < this.balls.length) {
            this.drawCannon(context);
        }
    }

    drawBlocks(context) {
        let dirtyRegionsTime;
        let bruteForceTime;
        let benchmarks;
        const blocksToRedraw = this.blocksToRedraw.length;
        const THIS = this;

        /*
        switch (Math.random() < 0.5) {
            case true:
                bruteForce();
                context.clearRect(this.x, this.y, this.width, this.height);
                dirtyRegions();
                break;

            case false:
                dirtyRegions();
                context.clearRect(this.x, this.y, this.width, this.height);
                bruteForce();
        }
        

        drawTimeDifferential = bruteForceTime - dirtyRegionsTime;
        */

        dirtyRegions();
        drawTimeDifferential = dirtyRegionsTime;

        function bruteForce() {
            let startTime = performance.now();

            for (let block of THIS.blocks) {
                block.draw(context);
            }

            let endTime = performance.now();

            bruteForceTime = endTime - startTime;
        }

        function dirtyRegions() {
            let startTime = performance.now();

            benchmarks = THIS.drawBlocks_dirtyRegions(THIS.majorOffscreen.context);
            context.drawImage(THIS.majorOffscreen, THIS.x, THIS.y, THIS.width, THIS.height, THIS.x, THIS.y, THIS.width, THIS.height);

            let endTime = performance.now();
            benchmarks._5drawBoard = endTime;

            dirtyRegionsTime = endTime - startTime;
        }

        /*let method = "error"
        if (drawTimeDifferential < -5 || ((method = "info") && Math.max(dirtyRegionsTime, bruteForceTime) > 40) || ((method = "log") && Math.random() < 0.001)) {
            let lastPerformanceNow = null;
            let rects = benchmarks.rects;
            delete benchmarks.rects;
            console[method](bruteForceTime.toFixed(2) + "ms brute force\n" + dirtyRegionsTime.toFixed(2) + "ms (" + blocksToRedraw + " blocks)\n" + drawTimeDifferential.toFixed(2) + "ms difference\n",
                            calc(benchmarks), rects);

            function calc(benchmarks) {
                let start = lastPerformanceNow;
                for (let key in benchmarks) {
                    let temp = benchmarks[key];
                    switch (typeof temp) {
                        case "number":
                            if (lastPerformanceNow === null) {
                                start = temp;

                            } else {
                                benchmarks[key] = Math.round((temp - lastPerformanceNow) * 100) / 100;
                            }

                            lastPerformanceNow = temp;
                            break;

                        case "object":
                            if (temp !== null) calc(temp);
                            else delete benchmarks[key];
                    }
                }
                benchmarks._total = Math.round((lastPerformanceNow - start) * 100) / 100
                return benchmarks;
            }
        }*/
    }


    drawBlocks_dirtyRegions(offscreenContext) {
        const benchmarks = {
            start: performance.now(),
            _1initialize: null,
            _2iterations: [],
            _3drawMinor: null,
            _4drawMajor: null,
            _5drawBoard: null,
            finalRedrawList: null,
            redrawRectangles: null,
            rects: null
        };

        const affectedBlocks = this.blocksToRedraw;
        if (!(affectedBlocks.length > 0)) return benchmarks;

        const blocks = this.blocks;
        const unaffectedBlocks = blocks.filter(block => !affectedBlocks.includes(block));
        const finalRedrawList = [];

        const minorCanvas = this.minorOffscreen;
        const minorContext = minorCanvas.context;
        const redrawRectangles = [];

        benchmarks._1initialize = performance.now();


        while (affectedBlocks.length > 0) {
            const startingBlock = this.blocksToRedraw.pop();
            const startingRect = startingBlock.rectangle;
            const upperLeft = startingRect.position.copy();
            const lowerRight = startingRect.position.copy();
            lowerRight.x += startingRect.width;
            lowerRight.y += startingRect.height;

            finalRedrawList.push(startingBlock);
            addToContinuousGroup(startingBlock);

            //code continues below function closures...

            function addToContinuousGroup(block) {
                const rect = getDrawBufferRectangle(block);

                upperLeft.x = Math.min(upperLeft.x, rect.x);
                upperLeft.y = Math.min(upperLeft.y, rect.y);
                lowerRight.x = Math.max(lowerRight.x, rect.x + rect.width);
                lowerRight.y = Math.max(lowerRight.y, rect.y + rect.height);

                const overlapsWith = rect.overlappingBlocks;
                const blocksToInvokeAddToContinuousGroup = [];
                //have to defer this until after iteration, because the function call may mutate the 'overlapsWith' array

                for (let i = 0; i < overlapsWith.length; i++) {
                    let otherBlock = overlapsWith[i];
                    let index = affectedBlocks.indexOf(otherBlock);
                    if (index >= 0) {
                        affectedBlocks.splice(index, 1);
                        blocksToInvokeAddToContinuousGroup.push(otherBlock);
                        finalRedrawList.push(otherBlock);

                    } else if ((index = unaffectedBlocks.indexOf(otherBlock)) >= 0) {
                        unaffectedBlocks.splice(index, 1);
                        finalRedrawList.push(otherBlock);

                    } else {
                        overlapsWith.splice(i--, 1);
                    }
                }

                for (let otherBlock of blocksToInvokeAddToContinuousGroup) {
                    addToContinuousGroup(otherBlock);
                }
            }

            function getDrawBufferRectangle(block) {
                //expanded by two pixels on each side, and then rounded up/down, to account for anti-aliasing "fuzz"
                let rect = block.drawBufferRectangle;
                if (rect === undefined) {
                    rect = block.drawBufferRectangle = block.rectangle.copy();
                    let newX = Math.floor(rect.x - 2);
                    let newY = Math.floor(rect.y - 2);
                    rect.width = Math.ceil(rect.width + 2 + (rect.x - newX));
                    rect.height = Math.ceil(rect.height + 2 + (rect.y - newY));
                    rect.x = newX;
                    rect.y = newY;
                    rect.overlappingBlocks = [];
                    for (let block of blocks) {
                        if (rect.overlapsWith(getDrawBufferRectangle(block, true))) {
                            rect.overlappingBlocks.push(block);
                        }
                    }

                }
                return rect;
            }

            benchmarks._2iterations.push([performance.now(), null, null]);

            //while loop code continues...

            const redrawRect = new Rectangle(upperLeft.x, upperLeft.y, lowerRight.x - upperLeft.x, lowerRight.y - upperLeft.y);

            //check for any other affected blocks inside the redraw area, but not directly adjacent to other affected blocks
            for (let repeatIterationUntil = true; repeatIterationUntil;) {
                repeatIterationUntil = false;
                for (let i = 0; i < affectedBlocks.length; i++) {
                    if (redrawRect.overlapsWith(affectedBlocks[i])) {
                        let block = affectedBlocks.splice(i--, 1)[0];
                        let prevBlock = affectedBlocks[i];

                        finalRedrawList.push(block);
                        addToContinuousGroup(block); //MAY MUTATE THE AFFECTED BLOCKS ARRAY, including indexs before i !!!
                        redrawRect.updateFromCoordinates(upperLeft.x, upperLeft.y, lowerRight.x - upperLeft.x, lowerRight.y - upperLeft.y);

                        i = affectedBlocks.indexOf(prevBlock); //...therefore need to recheck on i ... if it is -1 it will increment to zero on the next loop
                        repeatIterationUntil = i !== -1 ? prevBlock : false; //if the redrawRect expanded, we need to iterate over the entire list again, up until this point
                    }
                    if (affectedBlocks[i] === repeatIterationUntil) {
                        repeatIterationUntil = false;
                        break;
                    }
                }
            }

            benchmarks._2iterations[benchmarks._2iterations.length - 1][1] = performance.now();

            //check for unaffected blocks that are in the redraw rectangle
            for (let i = 0; i < unaffectedBlocks.length; i++) {
                if (redrawRect.overlapsWith(unaffectedBlocks[i].rectangle, true)) {
                    finalRedrawList.push(unaffectedBlocks.splice([i--], 1)[0]);
                }
            }

            redrawRectangles.push(redrawRect);

            benchmarks._2iterations[benchmarks._2iterations.length - 1][2] = performance.now();
        }

        
        minorContext.clearRect(this.x - 3, this.y - 3, this.width + 6, this.height + 6);

        finalRedrawList.sort((a, b) => this.blocks.indexOf(a) - this.blocks.indexOf(b));

        for (let block of finalRedrawList) {
            if(!block.destroyed) block.draw(minorContext);
        }

        benchmarks._3drawMinor = performance.now();

        for (let redrawRect of redrawRectangles) {
            //Safari drawImage fails if any of the source coordinates are outside range
            if (redrawRect.x < 0) {
                redrawRect.width -= redrawRect.x;
                redrawRect.x = 0;
            }

            if (redrawRect.y < 0) {
                redrawRect.height -= redrawRect.y;
                redrawRect.y = 0;
            }

            let maxWidth = minorCanvas.width - redrawRect.x;
            if (redrawRect.width > maxWidth)
                redrawRect.width = maxWidth;

            let maxHeight = minorCanvas.height - redrawRect.y;
            if (redrawRect.height > maxHeight)
                redrawRect.height = maxHeight;

            offscreenContext.clearRect(redrawRect.x, redrawRect.y, redrawRect.width, redrawRect.height);
            offscreenContext.drawImage(minorCanvas, redrawRect.x, redrawRect.y, redrawRect.width, redrawRect.height, redrawRect.x, redrawRect.y, redrawRect.width, redrawRect.height)
        }

        
        benchmarks._4drawMajor = performance.now();
        benchmarks.finalRedrawList = String(finalRedrawList.length);
        benchmarks.redrawRectangles = String(redrawRectangles.length);
        benchmarks.rects = redrawRectangles;
        return benchmarks;
        
    }

    drawBalls(context) {
        for (let i = 0; i < this.activeBalls.length; i++) {
            this.activeBalls[i].drawTail(context);
        }
        for (let i = 0; i < this.nextBallIndex + 1 && i < this.balls.length; i++) {
            this.balls[i].draw(context);
        }
    }

    drawCannon(context, lengthOfVectors = 50) {
        let endPoint = Angle.pointFrom(this.ballOrigin, this.ballVelocity.direction.degrees, lengthOfVectors);
        context.beginPath();
        context.strokeStyle = "rgb(255, 255, 255)"
        context.moveTo(this.ballOrigin.x, this.ballOrigin.y);
        context.lineTo(endPoint.x, endPoint.y);
        context.stroke();

        if (this.aimDirection) {
            let endPoint = Angle.pointFrom(this.ballOrigin, this.aimDirection, lengthOfVectors);
            context.beginPath();
            context.strokeStyle = RUST.toString();
            context.moveTo(this.ballOrigin.x, this.ballOrigin.y);
            context.lineTo(endPoint.x, endPoint.y);
            context.stroke();
        }
    }
}

Board.minFireAngle = 2
Board.maxFireAngle = 178;
Board.cannonAccel = 1.2; //degrees per second
Board.cannonMinSpeed = Board.cannonAccel / 8 //minimum cannon speed (during the deceleration phase only)
Board.predictionBounces = 1;
Board.ballGatheringSpeedMultiplier = 4;
Board.blockAccel = 800; //pixels per second
Board.blockMinSpeed = Board.blockAccel / 8;

(function createOffScreenBoardCanvases() {
    if (typeof UI.board.canvas.addOffscreen === "function") {
        let majorOffScreen = UI.board.canvas.addOffscreen();
        let minorOffScreen = UI.board.canvas.addOffscreen();

    } else {
        if (typeof window.OffscreenCanvas === "function") {
            UI.board.canvas.offscreenCanvases = [new OffscreenCanvas(1, 1), new OffscreenCanvas(1, 1)];
        } else {
            UI.board.canvas.offscreenCanvases = [document.createElement("canvas"), document.createElement("canvas")];
        }

        UI.board.canvas.offscreenCanvases.forEach(canvas => {
            canvas.context = canvas.getContext("2d");
            canvas.width = UI.board.canvas.width;
            canvas.height = UI.board.canvas.height;
        });
    }
})();



class Ball extends ObjectWithPositionVelocityAndVector {
    constructorArgs() { return ["board"]; } //possible source of unresolveable circular references?
    mustEnumerate() { return Object.getOwnPropertyNames(this).filter(key => key !== "board"); }

    /*{ return [
        "psn",
        "velocity",
        "vector",
        "bounds",
        "onBoard",
        "color",
        "bounceColor",
        "inactiveColor",
        "radius",
        "id",
        "remainingDistance",
        "collisionSurfaces",
        "eventTiming",
        "remainingFrameSeconds",
        "bounceLog",
        "disruptLoopsVars",
        "warning",
        "insideBlock",
        "fireTiming"
    ]; }*/

    constructor(board) {
        super(board.ballOrigin.x, board.ballOrigin.y, board);
        this.board = board;
        this.onBoard = false;
        //this.position = new Position(350, 750); //for corner bounce testing
        //this.velocity = new Velocity(100, -180 / 4); //for corner bounce testing
        this.color = OFF_WHITE;
        this.bounceColor = GREEN;
        this.inactiveColor = GREY;
        this.radius = Ball.standardRadius;
    }

    draw(context = this.board.context, color = this.onBoard ? this.color : this.inactiveColor) {
        if (this.insideBlock) {
            context.fillStyle = RED.string;
        } else if (this.warning) {
            context.fillStyle = Ball.warningColors[Math.min(Math.round(this.warning/3) - 1, Ball.warningColors.length - 1)];
        } else context.fillStyle = color.string;
        context.beginPath();
        context.arc(this.psn.x, this.psn.y, this.radius, 0, TWO_PI);
        context.fill();
    }

    drawTail(context = this.board.context) {
        let tailPoint = this.tailPoint();
        let gradient = context.createLinearGradient(this.x, this.y, tailPoint.x, tailPoint.y)
        gradient.addColorStop(0, this.color.toStringWithAlpha(0.5));
        gradient.addColorStop(1, this.color.toStringWithAlpha(0.1));
        let p1 = Angle.pointFrom(this, this.direction.degrees + 90, this.radius);
        let p2 = Angle.pointFrom(this, this.direction.degrees - 90, this.radius);

        context.beginPath();
        context.fillStyle = gradient;
        context.moveTo(p1.x, p1.y);
        context.lineTo(tailPoint.x, tailPoint.y);
        context.lineTo(p2.x, p2.y);
        context.lineTo(p1.x, p1.y);
        context.fill();
    }
}

Ball.standardRadius = 3.75;
Ball.warningColors = [LIGHT_PEACH, PEACH, LIGHT_ORANGE, ORANGE, DEEP_ORANGE];

initializeLogger?.("board ran");