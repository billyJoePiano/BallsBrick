"use strict"; document.currentScript.initTime = performance.now();

class Velocity {
    constructorArgs() { return ["speed", "direction"]; }

    constructor(speed = 0, direction = 0) {
        this.speed = speed; // pixels per second

        if (direction instanceof Angle) this.dr = direction;
        else {
            this.dr = new Angle();
            this.direction = direction;
        }
    }

    get direction() { return this.dr; }
    set direction(value) {
        if (value instanceof Angle) this.dr.degrees = value.degrees;
        else this.dr.degrees = value;
    }

    update(velOrSpeed, direction) { //ignores second argument if velOrSpeed is another velocity object
        if (velOrSpeed instanceof Velocity) {
            this.speed = velOrSpeed.speed;
            this.direction = velOrSpeed.direction;
        } else {
            this.speed = velOrSpeed;
            this.direction = direction;
        }
    }

    toString() { return "Speed: " + (Math.round(this.speed * 1000) / 1000) + " pixels per second    Direction: (" + this.direction + ")"; }
    copy() { return new Velocity(this.speed, this.degrees); }

    timeToMove(distance) { return distance / this.speed; }
}

class Vector extends Segment {
    constructorArgs() { return ["currentPosition", "oldPosition", "newPosition"]; }
    skipEnumerationIfConstructed() { return ["point1", "point2"]; }
    //enumerate() { return super.enumerate().concat("delta"); }

    constructor(currentPosition = new Position(), oldPosition = new Position(), newPosition = new Position()) {
        super(oldPosition, newPosition);
        this.currentPosition = currentPosition;
        this.delta = {
            x: 0,
            y: 0
        }
    }

    get oldPosition() { return this.point1; }
    get newPosition() { return this.point2; }
    set oldPosition(value) { this.point1 = value; }
    set newPosition(value) { this.point2 = value; }
    get x() { return this.currentPosition.x; }
    get y() { return this.currentPosition.y; }
    set x(value) { this.currentPosition.x = value; }
    set y(value) { this.currentPosition.y = value; }

    toDegrees() {
        return this.oldPosition.angleTo(this.newPosition);
    }

    updateDirection(angle = this.direction.degrees) {
        //IMPORTANT: newPoint and remainingDistance must be set by intersectionsCache.findNextCollision
        this.oldPosition.updateFromPosition(this.currentPosition);
        if (angle instanceof Angle) angle = angle.degrees;
        if (Number.isFinite(angle)) {
            this.slope = Angle.slopeFromDegrees(angle);
            this.invSlope = Angle.invSlopeFromDegrees(angle);
            this.delta.x = Angle.cosDeg(angle);
            this.delta.y = -Angle.sinDeg(angle);
        } else throw new Error("invalid angle argument sumbitted to vector.updateDirection");
        
        if (Number.isFinite(this.slope)) this.yIntercept = this.currentPosition.y - this.slope * this.currentPosition.x;
        else this.yIntercept = Math.NaN;
        if (Number.isFinite(this.invSlope)) this.xIntercept = this.currentPosition.x - this.invSlope * this.currentPosition.y;
        else this.xIntercept = Math.NaN;
        Line.assignPrimarySecondaryCoordinatesSlopesIntercepts(this);
    }

    updateDestination(newPoint) {
        this.newPosition.updateFromPosition(newPoint);
        this.oldPosition.updateFromPosition(this.currentPosition);
        this.remainingDistance = this.currentPosition.distanceTo(newPoint);
        this.delta.x = (newPoint.x - this.x) / this.remainingDistance;
        this.delta.y = (newPoint.y - this.y) / this.remainingDistance;
        this.recalc();
    }

    inRange(point, oldPositionInclusive = false, newPositionInclusive = true) {
        // vectors need to be point1 (oldPosition) exclusive for certain collision functions to work correctly
        return super.inRange(point, oldPositionInclusive, newPositionInclusive)
    }

// like segment.inRange, vector.isForward does not determine if the point is actually on the vector, only if its coordinate corresponding with the vector's primary coordinate is in the 'forward' direction for the vector
// it is upto the calling function to ensure the point is an accurate (and up-to-date) intersection point
    isForward(point) {
        let coordinateOld = this.primaryCoordinate(this.oldPosition);
        let coordinateNew = this.primaryCoordinate(this.newPosition);
        let coordinate = this.primaryCoordinate(point);
        if (coordinateOld < coordinateNew) { //primary coordinate is increasing as the vector moves forward
            return coordinate > coordinateOld;
        } else if (coordinateNew < coordinateOld) { //primary coordinate is decreasing as the vector moves forward
            return coordinate < coordinateOld;
        } else if (coordinateOld === coordinateNew) {
            console.log("unexpected result in vector.isForward function.  Primary coordinates for both vector points are equal, it has no range since it is point1 exclusive");
            return false;
        } else throw new Error("unexpected result in segment.inRange function.  Cannot determine range of the segment.")
    }

    distance() { return this.length(); }
    toString() { return this.oldPosition.toString() + " ---" + this.currentPosition.toString() + "--> " + this.newPosition.toString() + "  slope: " + this.slope; }
    deepCopy() { return new Vector(this.oldPosition.copy(), this.newPosition.copy()); }
}

ObjectWithPositionVelocityAndVector.prototype.updateVectorDirection = Vector.prototype.updateDirection;
ObjectWithPositionVelocityAndVector.prototype.updateVectorDestination = Vector.prototype.updateDestination;
ObjectWithPositionVelocityAndVector.prototype.recalc = Vector.prototype.recalc;
ObjectWithPositionVelocityAndVector.prototype.inRange = Vector.prototype.inRange;
ObjectWithPositionVelocityAndVector.prototype.isForward = Vector.prototype.isForward;


IntersectionsCache.prototype.findNextCollision = function () {
    let ball = this.ball;

    let i = 0;
    let lineCaches = LineCache.vertCaches;
    let distance = undefined;
    let closestDistance = Number.POSITIVE_INFINITY;
    let closestIntersection = new Array();
    let surfaces = undefined;
    let newCollisionSurfaces = undefined;

    //vertical surfaces
    if (ball.delta.x > 0) { //x is increasing
        while (i < lineCaches.length && lineCaches[i].xIntercept <= ball.x) { i++; }
        while (i < lineCaches.length && (distance = this.vertIntersections[i].findIntersection().distanceTo(ball)) <= closestDistance) {
            surfaces = lineCaches[i].getSurfacesAt(this.vertIntersections[i]);
            if (!(surfaces && this.verifySurfaces(surfaces))) { i++; continue; }
            if (distance < closestDistance) {
                closestDistance = distance;
                closestIntersection.length = 1;
                closestIntersection[0] = this.vertIntersections[i];
                newCollisionSurfaces = surfaces;
                break;
            } else if (distance == closestDistance) {
                closestIntersection.push(this.vertIntersections[i]);
                newCollisionSurfaces.push(...surfaces);
                break;
            } else throw new Error("");
            i++;
        }
    } else if (ball.delta.x < 0) { //x is decreasing
        i = lineCaches.length - 1;
        while (i >= 0 && lineCaches[i].xIntercept >= ball.x) { i--; }
        while (i >= 0 && (distance = this.vertIntersections[i].findIntersection().distanceTo(ball)) <= closestDistance) {
            surfaces = lineCaches[i].getSurfacesAt(this.vertIntersections[i]);
            if (!(surfaces && this.verifySurfaces(surfaces))) { i--; continue; }
            if (distance < closestDistance) {
                closestDistance = distance;
                closestIntersection.length = 1;
                closestIntersection[0] = this.vertIntersections[i];
                newCollisionSurfaces = surfaces;
                break;
            } else if (distance == closestDistance) {
                closestIntersection.push(this.vertIntersections[i]);
                newCollisionSurfaces.push(...surfaces);
                break;
            } else throw new Error("");
            i--;
        }
    }

    //horizontal surfaces
    i = 0;
    lineCaches = LineCache.horzCaches;
    if (ball.delta.y > 0) { //y is increasing
        while (i < lineCaches.length && lineCaches[i].yIntercept <= ball.y) { i++; }
        while (i < lineCaches.length && (distance = this.horzIntersections[i].findIntersection().distanceTo(ball)) <= closestDistance) {
            surfaces = lineCaches[i].getSurfacesAt(this.horzIntersections[i]);
            if (!(surfaces && this.verifySurfaces(surfaces))) { i++; continue; }
            if (distance < closestDistance) {
                closestDistance = distance;
                closestIntersection.length = 1;
                closestIntersection[0] = this.horzIntersections[i];
                newCollisionSurfaces = surfaces;
                break;
            } else if (distance == closestDistance) {
                closestIntersection.push(this.horzIntersections[i]);
                newCollisionSurfaces.push(...surfaces);
                break;
            } else throw new Error("");
            i++;
        }
    } else if (ball.delta.y < 0) { //y is decreasing
        i = lineCaches.length - 1;
        while (i >= 0 && lineCaches[i].yIntercept >= ball.y) { i--; }
        while (i >= 0 && (distance = this.horzIntersections[i].findIntersection().distanceTo(ball)) <= closestDistance) {
            surfaces = lineCaches[i].getSurfacesAt(this.horzIntersections[i]);
            if (!(surfaces && this.verifySurfaces(surfaces))) { i--; continue; }
            if (distance < closestDistance) {
                closestDistance = distance;
                closestIntersection.length = 1;
                closestIntersection[0] = this.horzIntersections[i];
                newCollisionSurfaces = surfaces;
                break;
            } else if (distance == closestDistance) {
                closestIntersection.push(this.horzIntersections[i]);
                newCollisionSurfaces.push(...surfaces);
                break;
            } else throw new Error("");
            i--;
        }
    }

    //angled surfaces
    let j = 0;
    let intercept = undefined;
    for (i = 0; i < LineCache.angledCaches.length; i++) {
        lineCaches = LineCache.angledCaches[i]
        if (ball.slope === lineCaches.slope) continue; //vector is parallel to the lines in this sub-array
        intercept = lineCaches.secondaryCoordinate(ball) - lineCaches.primarySlope(lineCaches) * lineCaches.primaryCoordinate(ball);
        //intercept of the line with this sub-array's slope that intersects with ball's current position. 
        // ...For quickly determining whether a line is in the 'forward' position for the ball's vector/direction, to avoid unneccessary findIntersection() calculations
        if (lineCaches.primaryInterceptIncreasing_vectorAngleRange.inRange(ball.direction)) { //intercept of intersection line is increasing as vector moves forward
            intercept = Math.floor(intercept * 262144 + 1) / 262144 // two extra binary precision digits over what the Position class permits (2^18 instead of 2^16) because it has one added/subracted (to digit of least significance) in the direction the ball is moving, then rounded in the *opposite* direction, so it will be at most 1 more/less (in digit of least signifiance)
            j = 0;
            while (j < lineCaches.length && lineCaches.primaryIntercept(lineCaches[j]) <= intercept) { j++; }
            while (j < lineCaches.length && (distance = this.angledIntersections[i][j].findIntersection().distanceTo(ball)) <= closestDistance) {
                surfaces = lineCaches[j].getSurfacesAt(this.angledIntersections[i][j]);
                if (!(surfaces && this.verifySurfaces(surfaces))) { j++; continue; }
                if (distance < closestDistance) {
                    closestDistance = distance;
                    closestIntersection.length = 1;
                    closestIntersection[0] = this.angledIntersections[i][j];
                    newCollisionSurfaces = surfaces;
                    break;
                } else if (distance == closestDistance) {
                    closestIntersection.push(this.angledIntersections[i][j]);
                    newCollisionSurfaces.push(...surfaces);
                    break;
                } else throw new Error("");
                j++;
            }
        } else { //intercept of intersection line is decreasing as vector moves forward
            intercept = Math.ceil(intercept * 262144 - 1) / 262144  // two extra binary precision digits over what the Position class permits (2^18 instead of 2^16) because it has one added/subracted (to digit of least significance) in the direction the ball is moving, then rounded in the *opposite* direction, so it will be at most 1 more/less (in digit of least signifiance)
            j = lineCaches.length - 1;
            while (j >= 0 && lineCaches.primaryIntercept(lineCaches[j]) >= intercept) { j--; }
            while (j >= 0 && (distance = this.angledIntersections[i][j].findIntersection().distanceTo(ball)) <= closestDistance) {
                surfaces = lineCaches[j].getSurfacesAt(this.angledIntersections[i][j]);
                if (!(surfaces && this.verifySurfaces(surfaces))) { j--; continue; }
                if (distance < closestDistance) {
                    closestDistance = distance;
                    closestIntersection.length = 1;
                    closestIntersection[0] = this.angledIntersections[i][j];
                    newCollisionSurfaces = surfaces;
                    break;
                } else if (distance == closestDistance) {
                    closestIntersection.push(this.angledIntersections[i][j]);
                    newCollisionSurfaces.push(...surfaces);
                    break;
                } else throw new Error("");
                j--;
            }
        }
    }


    if (!(newCollisionSurfaces?.length > 0)) {
        console.log(ball);
        throw new Error("Could not find ball's next collision!!  BALL ID: " + ball.id);
    }

    for (let i = 0; i < closestIntersection.length; i++) {
        for (let j = i + 1; j < closestIntersection.length; j++) {
            if (closestIntersection[i].equalTo(closestIntersection[j]) && closestIntersection[j].equalTo(closestIntersection[i])) continue;
            throw new Error("Intersections did not match!!");
        }
    }


    let doubleCheck = (LineCache.getAllSurfacesAt(closestIntersection[0])) ?? [];
    let counter = 0;
    let counter2 = 0;
    newCollisionSurfaces.forEach((surface) => {
        if (doubleCheck.indexOf(surface) === -1) counter2++;
    });
    if (this.verifySurfaces(doubleCheck, closestIntersection[0])) {
        doubleCheck.forEach((surface) => {
            if (newCollisionSurfaces.indexOf(surface) === -1) {
                newCollisionSurfaces.push(surface);
                counter++;
            }
        });
    }

    if (counter || counter2) {
        //console.log("lineCache found " + counter + " surface(s) which intersectionsCache.findNextCollision missed\nfindNextCollisions found " + counter2 + " surface(s) which lineCache missed\nBALL ID: " + ball.id);
        //ball.warning += (counter + counter2) * 3;
        //board.engine.slowDown();
    }

    ball.newPosition = closestIntersection[0];
    // ball.recalc(); //??? is this done elsewhere, or not done for a reason???
    ball.remainingDistance = closestDistance;
    ball.collisionSurfaces = newCollisionSurfaces;
}

IntersectionsCache.prototype.verifySurfaces = function (surfaces, collisionPoint = undefined) {
    //ensures that the surface just bounced on is not being used as the next collision surface
    for (let i = 0; i < surfaces.length; i++) {
        if (this.ball.collisionSurfaces.indexOf(surfaces[i]) >= 0) {
            if (collisionPoint && (surfaces[i].point1.equalTo(collisionPoint) || surfaces[i].point2.equalTo(collisionPoint))) {
                //is at a corner
                console.log("Included a collision surface just bounced on because the collision point was precisely at one of its corners!");
                continue;
            } else {
                //console.log("intersectionsCache.verifySurfaces found a surface which was just bounced on... removing.  BALL ID: " + this.ball.id);
                surfaces.splice(i--, 1)
                //this.ball.warning += 15;
                //board.engine.slowDown();
            }
        }
    }
    return surfaces.length > 0;
}

initializeLogger?.("engine.physics ran");