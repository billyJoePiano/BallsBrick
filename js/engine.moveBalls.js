"use strict"; document.currentScript.initTime = performance.now();

Engine.prototype.fireNextBall = function () {
    frameBallsThrownCounter++;
    let ball = this.board.nextBall();
    if (ball) {

        ball.newBounceLog();
        ball.warning = 0;
        ball.insideBlock = 0;

        ball.remainingFrameSeconds = this.ballTimer;
        ball.fireTiming = this.cumulativeBallTimer - this.ballTimer; //use by disrupt loops, to synchronize bounce angle changes based on fire timing
        Ball.disruptLoopsVars.maxFireTiming = ball.fireTiming;
        this.ballTimer -= this.ballFireInterval;
        return ball;
    } else {
        this.ballTimer = Number.NaN;
        this.cumulativeBallTimer = Number.NaN;
    }
}

Ball.prototype.newBounceLog = function () {
    this.bounceLog = { positions: new Array(), incomingAngles: new Array(), details: new Array() };
    this.disruptLoopsVars = Ball.disruptLoopsVars.vars[Ball.disruptLoopsVars.vars.length - 1]; //should be index 0
}

Engine.prototype.moveBalls = function (seconds = this.frameSeconds) {
    let ballsWithEvents = [];
    let ballsNoEvents = new Array(this.board.activeBalls.length);
    let b = 0;
    this.board.activeBalls.forEach((ball) => {
        ball.remainingFrameSeconds += seconds;
        if (ball.predictEvents()) ballsWithEvents.push(ball);
        else ballsNoEvents[b++] = ball;
    });

    this.ballTimer += seconds
    this.cumulativeBallTimer += seconds;
    while (this.ballTimer >= 0) {
        let newBall = this.fireNextBall(); 
        if (newBall === undefined) break;
        else ballsNoEvents.length++;

        ballsWithEvents.push({ addBall: true, ball: newBall, eventTiming: newBall.remainingFrameSeconds });
    }

    disruptLoops_incrementTiming(seconds);

    ballsWithEvents.sort(compareBallEvents); //sorts based on timing of collisions/events

    let e = ballsWithEvents.length - 1;
    while (e >= 0 || this.queues.duringRecalc[0]?.eventTiming > 0) {

        let ball = ballsWithEvents[e];

        while (this.queues.duringRecalc[0]?.eventTiming > (ball?.eventTiming ?? 0)) {
            if (!(this.currentFrameOffset >= (this.currentFrameOffset = this.queues.duringRecalc[0].eventTiming))) throw new Error();
            if (this.queues.duringRecalc[0].advanceAllBalls === true) this.advanceAllBalls();
            this.run(...this.queues.duringRecalc.shift());
        }

        if (!ball) break;

        if (!(this.currentFrameOffset >= (this.currentFrameOffset = ball.eventTiming))) throw new Error();

        if (ball.addBall) {
            ball = ball.ball;
            this.board.activeBalls.push(ball);
            ball.updateVectorDirection();
            ball.intersectionsCache.findNextCollision();

            if (ball.predictEvents()) {
                ballsWithEvents[e] = ball;
                ballsWithEvents.sort(compareBallEvents);

            } else {
                ballsNoEvents[b++] = ball;
                ballsWithEvents.pop();
                e--;
            }

        } else if (ball.move()) {
            if (ball.bounce()) {
                ball.draw();
                if (ball.onBoard) ball.updateVectorDirection();
                if (ball.insideBlock) ball.insideBlock--;
                if (ball.warning) ball.warning--;

            }

            if (ball.onBoard) {
                ball.intersectionsCache.findNextCollision();
                if (ball.predictEvents())
                    ballsWithEvents.sort(compareBallEvents);
                else {
                    ballsNoEvents[b++] = ballsWithEvents.pop();
                    e--;
                }
            } else {
                ballsWithEvents.pop();
                e--;
            }
        } else {
            if (ball.onBoard) ballsNoEvents[b++] = ballsWithEvents.pop();
            else ballsWithEvents.pop();
            e--;
        }
    }

    if (!(this.currentFrameOffset >= (this.currentFrameOffset = 0))) throw new Error();
    ballsNoEvents.forEach((ball) => {
        if (ball.eventTiming !== 0 || ball.move()) throw new Error();
    });

    while (this.queues.duringRecalc[0]?.eventTiming >= 0) {
        if (this.queues.duringRecalc[0].eventTiming !== 0) throw new Error();
        if (this.queues.duringRecalc[0].advanceAllBalls) this.advanceAllBalls();
        this.run(...this.queues.duringRecalc.shift());
    }

}

Engine.prototype.advanceAllBalls = function (toRemainingFrameSeconds = this.currentFrameOffset) {
    //IMPORTANT: REQUIRES THAT THE INVOKING FUNCTION SUBMIT THE 'CURRENT' FRAME TIME POSITION (ball.remainingFrameSeconds) OF THE MOST RECENTLY MOVED BALL
    //IF ANY ACTIVE BALL REACHES AN EVENT (aka bounce), OR IS ALREADY PAST THIS FRAME TIME POSITION, THIS WILL THROW AN ERROR!
    board.activeBalls.forEach((ball) => {
        if (ball.remainingFrameSeconds <= toRemainingFrameSeconds) {
            if (ball.remainingFrameSeconds === toRemainingFrameSeconds) return;
            else throw new Error();
        }
        if (ball.move(ball.remainingFrameSeconds - toRemainingFrameSeconds)) throw new Error();
    });
}

ObjectWithPositionVelocityAndVector.prototype.predictEvents = function (seconds = this.remainingFrameSeconds) {
    this.eventTiming = Math.max(0, seconds - this.remainingDistance / this.velocity.speed);
    return this.eventTiming > 0;
}

ObjectWithPositionVelocityAndVector.prototype.move = function (seconds = this.remainingFrameSeconds, velocity = this.velocity) {
    let distance = seconds * velocity.speed;
    if (this.remainingDistance >= distance) {
        this.currentPosition.x += distance * this.delta.x;
        this.currentPosition.y += distance * this.delta.y;
        this.remainingDistance -= distance;
        this.remainingFrameSeconds -= seconds;
        return false;
    } else if (this.remainingDistance < distance) {
        this.currentPosition.updateFromPosition(this.newPosition);
        this.remainingFrameSeconds = this.eventTiming;
        this.remainingDistance = 0;
        return true;
    } else throw new Error();
}

ObjectWithPositionVelocityAndVector.prototype.tailPoint = function (distance = this.velocity.speed / 12.5) {
    if (this.currentPosition.distanceTo(this.oldPosition) <= distance) return this.oldPosition;
    else return Angle.pointFrom(this.currentPosition, this.direction.degrees - 180, distance);
}

Engine.prototype.destroy = function(block) {
    let firstSurfaceIndex = this.surfaces.indexOf(block.surfaces[0]);
    this.surfaces.splice(firstSurfaceIndex, block.surfaces.length); //requires that all surfaces from a single block are in a row, and start with element 0 (from block's array)
    LineCache.destroy(block.surfaces);
    block.markSurfacesDestroyed();
}

function compareBallEvents(ball1, ball2) { //sorting function
    if (ball1.eventTiming < ball2.eventTiming) return -1;
    if (ball1.eventTiming > ball2.eventTiming) return 1;
    if (ball1.eventTiming === ball2.eventTiming) return 0;
    console.log(ball1);
    console.log(ball2);
    throw new Error("unexpected error in compareBallEvents function");
}

Engine.prototype.predict = function (ball, lengthOfBounce = 40) {
    /* returns an array of 3 points:  [ point of first bounce,
     *                                   point after bounce, after lengthOfBounce,
     *                                   point to board edge (if applicable, otherwise undefined) ] */
    if (!this.board.diagonalDistance) this.board.diagonalDistance = Math.ceil(Math.sqrt(this.board.width ** 2 + this.board.height ** 2));
    ball.updateVectorDirection();
    ball.intersectionsCache.findNextCollision();
    let edges = ball.intersectionsCache.getEdgeIntersections();

    let i = 0;
    for (i = 0; i < edges.length; i++) {
        if(edges[i].findIntersection().inRange2 && ball.isForward(edges[i])) break;
        if (i === 4) throw new Error ("unexpected result in predict function.  one of the board edges should have an in-range intersection with the vector");
    }

    let result = new Array(3);

    ball.currentPosition.updateFromPosition(ball.newPosition); //temporarily move ball to position of the bounce, to ensure accurate bounce behavior
    result.bounced = ball.bounce(false);
    ball.currentPosition.updateFromPosition(ball.oldPosition); //move back to original position
    result[0] = ball.oldPosition.updateFromPosition(ball.newPosition);      //substitute old position for the new bounce position
    result[1] = Angle.pointFrom(ball.oldPosition, ball.direction.degrees, lengthOfBounce, ball.newPosition); //use newPosition to illustrate the start of the new bounce vector

    if (edges[i].equalTo(ball.oldPosition)) result[2] = undefined; //edge intersection is the first bounce!
    else result[2] = edges[i];

    return result;
}

initializeLogger?.("engine.moveBalls ran");