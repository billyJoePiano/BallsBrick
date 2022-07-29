"use strict"; document.currentScript.initTime = performance.now();

class Engine {

    constructorArgs() { return ["board"]; }
    enumerations() { return ["board", "topLeft", "topRight", "bottomLeft", "bottomRight", "corners", "edges", "surfaces", "timeoutInterval", "frameSeconds", "queues", "terminatorLog", "nextFrame", "runIdleQueues", "currentFrameOffset", "newInterval", "newFrameSeconds", "ballFireInterval", "ballTimer", "cumulativeBallTimer"]; }

    constructor(board) {
        this.board = board;
        this.generateSurfaces(board);

        this.timeoutInterval = timeoutInterval / 2; //default for animation
        this.frameSeconds = frameSeconds / 2;       // these will be set to normal 'full' values once engine is started (on ball fire)

        this.queues = {
            beforeFire: new Array(),
            beforeDraw: new Array(),
            beforeRecalc: new Array(),
            afterRecalc: new Array(),
            empty: new Array(),
            currentName: "system",
            nextName: "rebuildCaches",

            duringRecalc: new Array(),
            afterTermination: new Array(),
            rebuildCaches: new Array(),

            animationBefore: new Array(),
            animationAfter: new Array(),

        }

        this.queues.current = this.queues.next = this.queues.rebuildCaches;

        this.terminatorLog = new Array();

        /* // these queue arrays get shuffled around between variables as they are used and emptied
        //  I used the below IDs to troubleshoot if any arrays were being lost in the shuffling process, and where loses were happening
        this.queues.beforeDraw.id = 0;
        this.queues.beforeRecalc.id = 1;
        this.queues.afterRecalc.id = 2;
        this.queues.empty.id = 3;
        this.queues.beforeFire.id = 4;
        this.queues.afterTermination.id = 5;
        this.queues.rebuildCaches.id = 6
        this.queues.animationBefore.id = 7;
        this.queues.animationAfter.id = 8;
        this.queues.duringRecalc.id = 9;*/

        this.nextFrame = this.nextFrame.bind(this);
        this.runIdleQueues = this.runIdleQueues.bind(this);
    }

    generateSurfaces(board) {
        this.topLeft = new Position(board.x, board.y);
        this.topRight = new Position(board.x + board.width, board.y);
        this.bottomLeft = new Position(board.x, board.y + board.height);
        this.bottomRight = new Position(board.x + board.width, board.y + board.height);
        this.corners = [this.topLeft, this.topRight, this.bottomRight, this.bottomLeft]; //clockwise, so the default surface.bounceAngle points inward, rather than outward

        this.edges = Surface.generateSurfaces(this.corners, undefined, edgeBounceProperties);
        this.edges[2].block = {
            bounce: function (ball, surfaces) {
                this.board.remove(ball);
            },
            board: board
        }

        this.surfaces = [...this.edges];

        let blocks = board.blocks;
        for (let i = 0; i < blocks.length; i++) {
            this.surfaces.push(...(blocks[i].generateSurfaces()));
        }
        //this.rebuildCaches(); //not neccessary because board.moveBlocks invokes at its end.  Before first round, it is called but immediately moves to end (since blocksLeft array is empty)
    }

    rebuildCaches() {
        LineCache.rebuildCaches(this);
        IntersectionsCache.rebuildCaches(this);
        Surface.rebuildCornerBounceRanges(this);
        this.runCurrentQueue("beforeFire", true);
    }

    start(ballFireInterval) {
        disruptLoops_resetVariables();
        this.frameSeconds = frameSeconds;
        this.timeoutInterval = timeoutInterval;
        this.newInterval = false;
        this.newFrameSeconds = false;

        if (this.queues.nextName != "beforeFire" || this.queues.next != this.queues.beforeFire) throw new Error("engine.start    unexpected engine.queues.next/nextName: " + this.queues.nextName.toString() + "     (beforeFire expected)");
        this.runCurrentQueue("beforeDraw", true);

        if (Engine.intervalHandler === this.runIdleQueues) {
            Engine.terminate(this.runIdleQueues);
            this.queues.beforeDraw.push(...this.queues.animationBefore.splice(0, this.queues.animationBefore.length));
            this.queues.afterRecalc.push(...this.queues.animationAfter.splice(0, this.queues.animationAfter.length));
        }
        Engine.startInterval(this.nextFrame, this.timeoutInterval);
        //console.log("Frame seconds: " + this.frameSeconds + "    timeout Interval: " + this.timeoutInterval);

        this.ballFireInterval = ballFireInterval;
        this.ballTimer = 0;
        this.cumulativeBallTimer = 0;
        this.nextFrame();

    }

    static startInterval(handler, timeout) {
        if (!(handler instanceof Function)) throw new Error("must submit handler function!");
        if (Engine.intervalID !== undefined) throw new Error("cannot start a new interval when there is already one running!");
        Engine.intervalID = window.setInterval(handler, timeout);
        Engine.intervalHandler = handler;

        window.addEventListener("error", Engine.terminateOnError);
    }

    static terminateOnError() {
        window.clearInterval(Engine.intervalID);
        delete Engine.intervalID;
        delete Engine.intervalHandler;
    }

    static replaceInterval(handler, timeout) {
        if (handler !== Engine.intervalHandler) throw new Error("Cannot replace interval unless the requester is the same as the current interval handler!");
        window.clearInterval(Engine.intervalID);
        Engine.intervalID = window.setInterval(handler, timeout);
    }

    static isRunning() { return Engine.intervalID !== undefined; }

    nextFrame() {
        newFrameStartTime = performance.now();
        if (this.newTimeoutInterval > 0) {
            var newInterval = Math.round(this.newTimeoutInterval);
            Engine.replaceInterval(this.nextFrame, newInterval);
            ////console.log("speed up timout interval: " + newInterval);
            this.newTimeoutInterval = false;
        }


        this.currentFrameOffset = this.frameSeconds;
        this.queues.duringRecalc.forEach((event) => event.eventTiming += this.frameSeconds);

        this.runCurrentQueue("beforeRecalc"); // assigns "beforeRecalc" as the "next" queue.  uses the old "next" (in this case, "beforeDraw") as the current queue to run
        this.queues.currentName = "draw";
        this.run((seconds) => { this.board.draw(); }, true);

        this.runCurrentQueue("afterRecalc");
        this.queues.currentName = "recalc";
        this.run((seconds) => { this.moveBalls(seconds); }, false);

        this.runCurrentQueue("beforeDraw");
        this.queues.currentName = "system";


        if (newInterval) this.timeoutInterval = newInterval;
        if (this.newFrameSeconds > 0) {
            this.frameSeconds = this.newFrameSeconds;
            this.newFrameSeconds = false;
            ////console.log("speed up frame seconds: " + this.frameSeconds);
        }
        frameEndTime = performance.now();
    }

    runCurrentQueue(next, invokeAllUnconditionally = false) {
        // 'next' argument is a little confusing, becuase it designates the queue to run the *next* time this function is called, not the current time
        // invokeAllUnconditionally is used for running events in the afterTermination and beforeFire queues, since those obviously run even though the engine has terminated or is not yet running
        //this.accountForAllQueues();
        this.queues.currentName = this.queues.nextName;
        this.queues[this.queues.currentName] = this.queues.empty;
        if (this.queues.current == this.queues[this.queues.currentName]) throw new Error("ERROR in engine.runCurrentQueue.  Current cue and next iteration of current cue should not be the same array object!");
        //this.accountForAllQueues();
        this.queues.nextName = next;
        this.queues.next = this.queues[next];

        //this.accountForAllQueues();
        while (this.queues.current.length > 0) {
            this.run(...(this.queues.current.shift()), invokeAllUnconditionally);
        }
        this.queues.empty = this.queues.current;
        this.queues.current = this.queues.next;
        //this.accountForAllQueues();
    }

    /*accountForAllQueues() {
        let exists = new Array(10);
        exists.fill(false);
        exists[this.queues.current.id] = true;
        exists[this.queues.next.id] = true;
        exists[this.queues.beforeDraw.id] = true;
        exists[this.queues.beforeRecalc.id] = true;
        exists[this.queues.afterRecalc.id] = true;
        exists[this.queues.empty.id] = true;
        exists[this.queues.beforeFire.id] = true;
        exists[this.queues.afterTermination.id] = true;
        exists[this.queues.animationBefore.id] = true;
        exists[this.queues.animationAfter.id] = true;
        exists[this.queues.duringRecalc.id] = true;
        exists[this.queues.rebuildCaches.id] = true;
        exists.forEach((value) => { if (!value) throw new Error("one of the queues was lost!"); });
        if (this.queues.empty.length > 0) throw new Error();
    }*/

    run(functionToInvoke, invokeIfEngineTerminates, invokeUnconditionally = false) {
        // invokeAllUnconditionally is used for running events in the afterTermination and beforeFire queues, since those obviously run even though the engine has terminated or is not yet running
        //returns true if a function was run without errors
        if (Engine.intervalHandler === this.nextFrame || invokeIfEngineTerminates === true || invokeUnconditionally) {
            //try {
                functionToInvoke(this.frameSeconds);
            /*} catch (err) {
                if (err instanceof EngineTermination) {
                    if (invokeIfEngineTerminates instanceof Function) this.run(invokeIfEngineTerminates, true);
                }
                throw err;
            }*/
            return true;
        } else if (invokeIfEngineTerminates instanceof Function) {
            this.run(invokeIfEngineTerminates, true);
            return true;
        }
        return false;
    }

/*Note about invokeIfEngineTerminates argument:
 *       "true" (boolean, not string) means run the function in the first argument even if the engine has terminated before it gets to this place in the queue (will happen during the emptyQueuesAfterTermination function)
 *       If another function is provided, that function will run in the event of
 *           1) termination before the engine gets to this place in the queue, OR
 *           2) termination during the exeuction of the first function
 *       Note: If termination happens in subsequent invocations in the queue, after this event has finished executing, this event will do nothing as this is considered complete
 *       Undefined, false, or non-function/non-boolean argument means do nothing in the event of termination.
 *       To re-run the first function in the event it causes termination, provide that function as the second argument too...
 *           ...rather than simply using "true" which will only run it if the engine terminates *before* arriving at this position in the queue
 */

    addToQueue(queueName, functionToInvoke, invokeIfEngineTerminates) {
        /* Valid queueName arguments (pass as strings): beforeDraw, beforeRecalc, afterRecalc, current, next, beforeFire, afterTermination
         * String name of current and next queues are available in engine.queues.currentName and engine.queues.nextName
         * IMPORTANT: while the engine is running draw() and moveBalls(), engine.queues.currentName is set to "draw" and "recalc" respectively, and to "system" once the engine has relinquished control of the thread
         * ...which are NOT valid queue names, and will result in your function not being run!  Additionally, currentName has " emptying after termination" appended to it when emptying the queues after engine termination, which will also result in an invalid queue name
         * Note that if you try to add to a queue while it is currently running, your function will not be run until the next frame
         * To add to the end of the *currently executing* queue, pass "current" to the queueName argument
         * IF the engine is not currently executing a queue (or is executing "draw" or "recalc") then queueName "current" is equivalent to "next"
         */
        if (functionToInvoke instanceof Function) {
            if (queueName != "empty" && this.queues[queueName] instanceof Array)
                this.queues[queueName].push([functionToInvoke, invokeIfEngineTerminates]);
            else { throw new Error("invalid queue name: " + queueName); }
        } else console.log("Must provide a function to invoke: " + functionToInvoke);
    }    

    speedUp() {
        if (this.timeoutInterval > 10) this.changeTimeoutInterval(this.timeoutInterval - 1);
        else if (this.frameSeconds < 0.04) this.changeFrameSeconds(this.frameSeconds * 17 / 16);
        else { disruptLoops_incrementVariables(); }
        return true;
    }

    slowDown() {
        this.changeFrameSeconds(0.0005);
    }

    changeTimeoutInterval(newInterval) {
        //if (Engine.intervalID !== undefined) {
            this.newTimeoutInterval = newInterval;
        //} else console.log("cannot change timeout interval when engine is not running");
    }

    changeFrameSeconds(newFrameSeconds) {
        //if (Engine.intervalID !== undefined) {
            this.newFrameSeconds = newFrameSeconds;
        //} else console.log("cannot change frame seconds when engine is not running");
    }

    static terminate(requester, engineInstance = false, startNewRound = true) {
        if (Engine.intervalID === undefined)
            throw new Error("Cannot terminate engine when it is not running!");
        else if (requester !== Engine.intervalHandler)
            throw new Error("Cannot terminate engine if the requester is different from the current handler!");

        window.clearInterval(Engine.intervalID);
        delete Engine.intervalID;
        delete Engine.intervalHandler;
        window.removeEventListener("error", Engine.terminateOnError);

        if (engineInstance) {
            if (!engineInstance instanceof Engine) throw new Error("invalid engineInstance argument");

            frameEndTime = performance.now();

            let terminator = engineInstance.terminator = new EngineTermination(engineInstance, startNewRound);
            engineInstance.terminatorLog.push(terminator);
            engineInstance.suspendNextRound = false;
            engineInstance.emptyQueuesAfterTermination(terminator);

            //console.log(err);
            //console.log("functions run while emptying run-time queues: ");
            //console.log(err.functionsRun);
            //console.log("functions discarded while emptying run-time queues: ")
            //console.log(err.functionsDiscarded);
            //console.log("current queues: ");
            //console.log(engineInstance.queues);

            if (!(engineInstance.suspendNextRound || engineInstance.checkForSuspendNextRound())) {
                delete engineInstance.terminator;

                engineInstance.changeTimeoutInterval(timeoutInterval / 2);
                engineInstance.changeFrameSeconds(frameSeconds / 2);
                if (startNewRound) {
                    engineInstance.board.newRound();
                }

            } else {
                if (engineInstance.queues.animationBefore.length <= 0 && engineInstance.queues.animationAfter.length <= 0 && engineInstance.queues.duringRecalc.length <= 0) throw new Error();
                engineInstance.suspendNextRound = true; //in case the only event(s) are in the duringRecalc queue

                if (!Engine.intervalHandler) {
                    if (engineInstance.queues.animationBefore.length > 0 || engineInstance.queues.animationAfter.length > 0) throw new Error(); //engineInstance should *only* happen when there is an event in 'duringRecalc' with a negative 'eventTiming' value
                    Engine.startInterval(engineInstance.runIdleQueues, engineInstance.timeoutInterval);
                } else if (Engine.intervalHandler !== engineInstance.runIdleQueues) throw new Error();
            }
            return;
        }
    }

    emptyQueuesAfterTermination(terminator) {
        terminator.functionsRun = new Array();
        terminator.functionsDiscarded = new Array();
        let currentName = this.queues.currentName;
        let nextName = undefined;
        this.queues.next = this.queues.afterTermination;
        this.queues.nextName = "afterTermination";
        switch (currentName) {
            case "draw": currentName = "beforeRecalc"; break;
            case "recalc": currentName = "afterRecalc"; break;
            case "system": currentName = "beforeDraw"; break;
        }

        while (this.queues.current.length > 0 || this.queues.beforeDraw.length > 0 || this.queues.beforeRecalc.length > 0 || this.queues.afterRecalc.length > 0 || this.queues.duringRecalc[0]?.eventTiming >= 0) {

            this.queues.currentName = currentName + " emptying after termination";
            switch (currentName) {
                case "beforeDraw": nextName = "beforeRecalc"; break;
                case "beforeRecalc": nextName = "afterRecalc"; break;
                case "afterRecalc": nextName = "beforeDraw"; break;
            }

            this.queues[currentName] = this.queues.empty;
            while (this.queues.current.length > 0) {
                var func = this.queues.current.shift()
                if (this.run(...func)) terminator.functionsRun.push({ queue: currentName, event: func });
                else terminator.functionsDiscarded.push({ queue: currentName, event: func });
            }

            if (currentName === "beforeRecalc") {
                while (this.queues.duringRecalc[0]?.eventTiming >= 0) {
                    if (!(this.currentFrameOffset >= (this.currentFrameOffset = this.queues.duringRecalc[0].eventTiming))) throw new Error();
                    func = this.queues.duringRecalc.shift();
                    if (this.run(...func)) terminator.functionsRun.push({ queue: "duringRecalc", event: func });
                    else terminator.functionsDiscarded.push({ queue: "duringRecalc", event: func });
                }
                if (!(this.currentFrameOffset >= (this.currentFrameOffset = 0))) throw new Error();
            }

            this.queues.empty = this.queues.current;
            this.queues.current = this.queues[nextName];
            currentName = nextName;
        }

        this.queues.current = this.queues.afterTermination;
        this.runCurrentQueue("rebuildCaches", true);
        this.queues.currentName = "rebuildCaches";
    }

    requestDuringRecalc(eventTiming_fromCurrentOffset, functionToInvoke, invokeIfEngineTerminates, advanceAllBalls = false, suspendNextRound = false) {
        if (functionToInvoke instanceof Function && Number.isFinite(eventTiming_fromCurrentOffset)) {
            let request;
            if (Engine.intervalHandler === this.nextFrame) {
                request = [functionToInvoke, invokeIfEngineTerminates];
                request.advanceAllBalls = advanceAllBalls;

            } else {
                if (invokeIfEngineTerminates === true)
                    request = [functionToInvoke, true];

                else if (invokeIfEngineTerminates instanceof Function)
                    request = [invokeIfEngineTerminates, true];

                else if (invokeIfEngineTerminates === false) return;
                else throw new Error();

                if (suspendNextRound) {
                    //this.suspendNextRound = true // //we do this on requestAnimation but NOT requestDuringRecalc because animations are guarenteed to run once and only once per frame
                    if (!(this.terminator instanceof EngineTermination)) throw new Error();
                }

                if (!Engine.intervalHandler) {
                    Engine.startInterval(this.runIdleQueues, this.timeoutInterval);
                } else if (Engine.intervalHandler !== this.runIdleQueues) throw new Error();
            }

            request.suspendNextRound = suspendNextRound;
            request.eventTiming = this.currentFrameOffset - eventTiming_fromCurrentOffset;

            let i = this.queues.duringRecalc.length;

            while (i > 0 && request.eventTiming > this.queues.duringRecalc[i - 1].eventTiming) { i--; }
            this.queues.duringRecalc.splice(i, 0, request);

        } else throw new Error();
    }

    requestAnimation(functionToInvoke, invokeBeforeDrawBoard = false, suspendNextRound = false) {
        if (functionToInvoke instanceof Function) {
            if (Engine.intervalHandler === this.nextFrame) {
                this.addToQueue(invokeBeforeDrawBoard ? "beforeDraw" : "afterRecalc", functionToInvoke, true);

            } else {
                let request = [functionToInvoke, true];
                request.suspendNextRound = suspendNextRound;
                this.queues["animation" + (invokeBeforeDrawBoard ? "Before" : "After")].push(request);
                if (suspendNextRound) {
                    if (this.terminator instanceof EngineTermination) this.suspendNextRound = true; //we do this on requestAnimation but NOT requestDuringRecalc because animations are guarenteed to run once and only once per frame
                    else throw new Error();
                }

                if (!Engine.intervalHandler) {
                    Engine.startInterval(this.runIdleQueues, this.timeoutInterval);
                } else if (Engine.intervalHandler !== this.runIdleQueues) throw new Error();
            }
        } else throw new Error();
    }

    runIdleQueues() { //only used when Engine is not running
        if (this.newTimeoutInterval > 0) { //stolen code from nextFrame
            var newInterval = Math.round(this.newTimeoutInterval);
            Engine.replaceInterval(this.runIdleQueues, newInterval);
            this.newTimeoutInterval = false;
        }

        this.currentFrameOffset = this.frameSeconds;
        this.queues.duringRecalc.forEach((event) => event.eventTiming += this.frameSeconds);

        let queue = this.queues.animationBefore;
        this.queues.animationBefore = this.queues.empty;
        if (this.queues.empty.length > 0) throw new Error();
        this.queues.empty = queue;

        while(queue.length > 0) {
            let request = queue.shift();
            request[0](this.frameSeconds);
        }

        this.board.draw();

        queue = this.queues.duringRecalc;
        while (queue[0]?.eventTiming >= 0) {
            let request = queue.shift();
            if (!(this.currentFrameOffset >= (this.currentFrameOffset = request.eventTiming))) throw new Error();
            request[0](this.frameSeconds);
        }

        if (!(this.currentFrameOffset >= (this.currentFrameOffset = 0))) throw new Error();

        queue = this.queues.animationAfter;
        this.queues.animationAfter = this.queues.empty;
        if (this.queues.empty.length > 0) throw new Error();
        this.queues.empty = queue;

        while (queue.length > 0) {
            let request = queue.shift();
            request[0](this.frameSeconds);
        }

        if (this.checkForSuspendNextRound()) {
            if (this.queues.animationBefore.length <= 0 && this.queues.animationAfter.length <= 0 && this.queues.duringRecalc.length <= 0) throw new Error();
            this.suspendNextRound = true;

        } else if (this.suspendNextRound) {
            if (!this.terminator) throw new Error();

            this.suspendNextRound = false;
            this.changeTimeoutInterval(timeoutInterval / 2);
            this.changeFrameSeconds(frameSeconds / 2);

            if (this.terminator.startNewRound === true)
                this.board.newRound();

            delete this.terminator;
        }

        if (this.queues.animationBefore.length <= 0 && this.queues.animationAfter.length <= 0 && this.queues.duringRecalc.length <= 0) {
            if (this.suspendNextRound || this.terminator) throw new Error();
            Engine.terminate(this.runIdleQueues);
        }

        if (newInterval) this.timeoutInterval = newInterval; //stolen code from nextFrame
        if (this.newFrameSeconds > 0) {
            this.frameSeconds = this.newFrameSeconds;
            this.newFrameSeconds = false;
        }

        if (this.queues.empty.length > 0) throw new Error();
    }

    checkForSuspendNextRound() {
        for (let i = 0; i < this.queues.duringRecalc.length; i++) {
            if (this.queues.duringRecalc[i].suspendNextRound === true) return true;
        }
        for (let i = 0; i < this.queues.animationBefore.length; i++) {
            if (this.queues.animationBefore[i].suspendNextRound === true) return true;
        }
        for (let i = 0; i < this.queues.animationAfter.length; i++) {
            if (this.queues.animationAfter[i].suspendNextRound === true) return true;
        }

        return false;
    }
}

Engine.intervalID = undefined;
Engine.errCounter = 0;

Block.prototype.markSurfacesDestroyed = function () {
    for (let i = 0; i < this.surfaces.length; i++) {
        this.surfaces[i].destroyed = true;
    }
}

class EngineTermination extends Error {
    constructor(engine, startNewRound) {
        super("Engine Terminated while running " + engine?.queues?.currentName);
        this.name = "EngineTermination";
        this.startNewRound = startNewRound;
    }
}

initializeLogger?.("engine ran");