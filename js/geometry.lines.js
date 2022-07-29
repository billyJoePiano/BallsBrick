"use strict"; document.currentScript.initTime = performance.now();

function xor(condition1, condition2) { return condition1 ? !condition2 : condition2; }

//NOTE:  NEED TO CHANGE undefined TO null AS PLACEHOLDER FOR NULL X/Y VALUES IN POSITIONS AND DERIVITATIVE CLASSES (E.G. INTERSECTIONS)

class Position {
    constructorArgs() { return ["x", "y"]; }
    skipEnumerationIfConstructed() { return ["X", "Y"]; }

    constructor(x = 0, y = 0) {
        //need to deal with literal undefined values submitted to constructor... should probably change to 'null' rather than 'undefined'!!!
        this.x = x;
        this.y = y;
    }

    get x() { return this.X; }
    get y() { return this.Y; }
    set x(value) {
        if (value === undefined) this.X = undefined;
        else if (!Number.isFinite(this.X = Position.round(value))) throw new Error("");
    }
    set y(value) {
        if (value === undefined) this.Y = undefined;
        else if (!Number.isFinite(this.Y = Position.round(value))) throw new Error("");
    }

    static round(coordinateValue) {
        return Math.round(coordinateValue * 65536) / 65536;
    }

    toString() { return "(" + Math.round(this.x * 1000) / 1000 + " , " + Math.round(this.y * 1000) / 1000 + ")"; }
    equalTo(position) { return this.x === position.x && this.y === position.y; }
    notEqualTo(position) { return this.x !== position.x || this.y !== position.y; }
    get defined() { return Number.isFinite(this.x) && Number.isFinite(this.y); }
    get notDefined() { return !this.defined; }
    copy() {
        if (this.defined) return new Position(this.x, this.y);
        else {
            let copy = new Position();
            copy.x = this.x;
            copy.y = this.y;
            return copy;
        }
    }


    updateFromPosition(position) {
        this.x = position.x;
        this.y = position.y;
        return this;
    }

    updateFromCoordinates(x, y) {
        this.x = x;
        this.y = y;
        return this;
    }



    distanceTo(position) {
        return Math.sqrt((this.x - position.x) ** 2 + (this.y - position.y) ** 2);
    }
    slopeTo(position) {
        if (this.equalTo(position)) return undefined;
        return (this.y - position.y) / (this.x === position.x ? -0 : this.x - position.x);
    }
    invSlopeTo(position) {
        if (this.equalTo(position)) return undefined;
        return (this.x - position.x) / (this.y - position.y); //do I need to use -0 for denominator when the Ys are equal???
    }
    angleTo(position, angleRange = ANGLE_RANGE_360.default) { //undefined or false range means angles facing right will always be positive.  range becomes -90 to 270 by virtute of atan function, and using addition to flip 180 for right-facing angles
        if (angleRange) return angleRange.transform(Angle.degreesFromSlope(this.slopeTo(position)) + (this.x > position.x ? 180 : 0)); //atan needs to be flipped 180 degrees if the second point is to the left of first point on the x axis
        else Angle.degreesFromSlope(this.slopeTo(position)) + (this.x > position.x ? 180 : 0)
    }

    radiansTo(position) {
        return Angle.radiansFromSlope(this.slopeTo(position)) + (this.x > position.x ? PI : 0)
    }

    round(toNearest = 0.25) {
        this.x = Math.round(this.x / toNearest) * toNearest;
        this.y = Math.round(this.y / toNearest) * toNearest;
    }

    draw(context = UI.board.context, radius = 3, fill = false) {
        context.beginPath();
        context.arc(this.x, this.y, radius, 0, TWO_PI);
        if (fill === true) context.fill();
        else if (fill?.toString()) {
            context.fillStyle = fill.toString();
            context.fill();
        }
        else context.stroke();
    }


}

//class Point extends Position { }


class Segment {
    constructorArgs() { return ["point1", "point2"]; }
    //enumerate() { return ["slope", "invSlope", "xIntercept", "yIntercept"]; } //??? not sure

    constructor(point1, point2) {
        if (!point1) point1 = new Position();
        this.point1 = point1;

        if (!point2) point2 = new Position();
        this.point2 = point2;

        if(point1.notEqualTo(point2)) this.recalc();
    }

    recalc() {
        if (this.point1.equalTo(this.point2)) { throw new Error("Cannot recalc line slopes/intercepts when both points are the same"); }

        this.slope = this.point1.slopeTo(this.point2);
        this.invSlope = this.point1.invSlopeTo(this.point2);
        if (Number.isFinite(this.slope) && this.slope != this.point2.slopeTo(this.point1)) console.log("inconsistant slope calculation.  from point1->point2: " + this.slope + "   from point2->point1: " + this.point2.slopeTo(this.point1));
        if (Number.isFinite(this.invSlope) && this.invSlope != this.point2.invSlopeTo(this.point1)) console.log("inconsistant invSlope calculation.  from point1->point2: " + this.invSlope + "   from point2->point1: " + this.point2.invSlopeTo(this.point1));

        if (Number.isFinite(this.slope)) {
            let fromP1 = this.point1.y - this.slope * this.point1.x;
            let fromP2 = this.point2.y - this.slope * this.point2.x;
            this.yIntercept = fromP1 === fromP2 ? fromP1 : (fromP1 + fromP2) / 2; //to prevent losing a sigDigit (in binary) if they are identical.  rounding errors may cause them to be slightly different
        } else this.yIntercept = Math.NaN;
        if (Number.isFinite(this.invSlope)) {
            let fromP1 = this.point1.x - this.invSlope * this.point1.y;
            let fromP2 = this.point2.x - this.invSlope * this.point2.y;
            this.xIntercept = fromP1 === fromP2 ? fromP1 : (fromP1 + fromP2) / 2; //to prevent losing a sigDigit (in binary) if they are identical.  rounding errors may cause them to be slightly different
        } else this.xIntercept = Math.NaN;

        Line.assignPrimarySecondaryCoordinatesSlopesIntercepts(this);
        return this;
    }

    length() { return this.point1.distanceTo(this.point2);}
    angle(range = ANGLE_RANGE_360.default) { return new Angle(this.point1.angleTo(this.point2), range); }
    angleInv() { return new Angle(this.point2.angleTo(this.point1)); }
    deepCopy() { return new Segment(this.point1.copy(), this.point2.copy); }
    toString() { return this.point1.toString() + " --- " + this.point2.toString(); }
    reversePoints() {
        let temp = this.point1;
        this.point1 = this.point2;
        this.point2 = temp;
        return this.recalc();
    }

    get usesYAsPrimary() {
        if (this.primaryCoordinate === coordinate_y && this.primarySlope === slope_invSlope && this.primaryIntercept === intercept_x) return true;
        else if (this.primaryCoordinate === coordinate_x && this.primarySlope === slope_slope && this.primaryIntercept === intercept_y) return false;
        else throw new Error();
    }

    get usesXAsPrimary() {
        if (this.primaryCoordinate === coordinate_x && this.primarySlope === slope_slope && this.primaryIntercept === intercept_y) return true;
        else if (this.primaryCoordinate === coordinate_y && this.primarySlope === slope_invSlope && this.primaryIntercept === intercept_x) return false;
        else throw new Error();
    }

    getPrimarySlope() { return this.primarySlope(this); }
    getSecondarySlope() { return this.secondarySlope(this); }
    getPrimaryIntercept() { return this.primaryIntercept(this); }
    getSecondaryIntercept() { return this.secondaryIntercept(this); }

    directionality(throwErrIfZero = false) { //direction the primary coordinate moves from point1 to point2.  1 for increasing, -1 for decreasing, 0 for unchanged
        let coordinate1 = this.primaryCoordinate(this.point1);
        let coordinate2 = this.primaryCoordinate(this.point2);
        if (coordinate1 < coordinate2) return -1;
        else if (coordinate1 > coordinate2) return 1;
        else if (!throwErrIfZero && Number.isFinite(coordinate1) && Number.isFinite(coordinate2) && coordinate1 === coordinate2) return 0;
        else throw new Error();
    }

    inRange(point, point1Inclusive = true, point2Inclusive = true) {
        //does NOT test if this point is actually on the line, only if its coordinate which corresponds with this segment's primary coordinate is inside the segment
        let coordinate1 = this.primaryCoordinate(this.point1);
        let coordinate2 = this.primaryCoordinate(this.point2);
        let pointCoordinate = this.primaryCoordinate(point);
        if (coordinate1 < coordinate2) {
            return (point1Inclusive ? coordinate1 <= pointCoordinate : coordinate1 < pointCoordinate)
                && (point2Inclusive ? pointCoordinate <= coordinate2 : pointCoordinate < coordinate2);
        } else if (coordinate2 < coordinate1) {
            return (point2Inclusive ? coordinate2 <= pointCoordinate : coordinate2 < pointCoordinate)
                && (point1Inclusive ? pointCoordinate <= coordinate1 : pointCoordinate < coordinate1);
        } else if (coordinate1 === coordinate2) { //this happens with ball vectors during findNextCollisions because the newPoint hasn't been set yet
            if (point1Inclusive || point2Inclusive) return pointCoordinate === coordinate1; else return false;
        } else {
            console.log(this);
            throw new Error("unexpected result in segment.inRange function.  Cannot determine range of the segment.")
        }
    }

    intersectionWith(line, thisPoint1Inclusive = true, thisPoint2Inclusive = true, thatPoint1Inclusive = true, thatPoint2Inclusive = true) {
        // returns undefined if the intersection is out of range of this segment, or out of range of the other line
        let intersection = new Intersection(this, line);
        if (this.inRange(intersection, thisPoint1Inclusive, thisPoint2Inclusive) && line.inRange(intersection, thatPoint1Inclusive, thatPoint2Inclusive))
            return intersection;
        else return undefined;
    }

    containsPoint(point, point1Inclusive = true, point2Inclusive = true) {
        if (this.secondaryCoordinate(point) === Position.round(this.primaryCoordinate(point) * this.primarySlope(this) + this.primaryIntercept(this))) {
            if (this.primaryCoordinate(point) !== Position.round(this.secondaryCoordinate(point) * this.secondarySlope(this) + this.secondaryIntercept(this))) Line.inconsistent++;
            else Line.consistent++;
            return this.inRange(point, point1Inclusive, point2Inclusive);
        } else if (this.primaryCoordinate(point) === Position.round(this.secondaryCoordinate(point) * this.secondarySlope(this) + this.secondaryIntercept(this))) {
            Line.inconsistent++;
            return this.inRange(point, point1Inclusive, point2Inclusive);
        }
        Line.consistent++;
        return false;
    }

    perpLine(throughPoint = new Position((this.point1.x + this.point2.x) / 2, (this.point1.y + this.point2.y) / 2)) {
        //identical to Line class function of the same name, except for the default position argument
        return new Line(-this.primarySlope(this), throughPoint, this.usesXAsPrimary);
    }

    parLine(throughPoint = this.setPrimarySecondaryCoordinates(0, this.getPrimaryIntercept())) {
        //identical to Line class function of the same name, except for default position argument
        return new Line(this.getPrimarySlope(), throughPoint, this.usesYAsPrimary);
    }

    distanceFrom(point) {
        if (this.slope === 0) {
            if (this.point1.x > this.point2.x) {
                if (point.x > this.point1.x)
                    return point.distanceTo(this.point1);
                else if (point.x < this.point2.x)
                    return point.distanceTo(this.point2);

            } else if (this.point1.x < this.point2.x) {
                if (point.x < this.point1.x)
                    return point.distanceTo(this.point1);
                else if (point.x > this.point2.x)
                    return point.distanceTo(this.point2);
            }
            return Math.abs(point.y - this.point1.y);

        } else if (this.invSlope === 0) {
            if (this.point1.y > this.point2.y) {
                if (point.y > this.point1.y)
                    return point.distanceTo(this.point1);
                else if (point.y < this.point2.y)
                    return point.distanceTo(this.point2);

            } else if (this.point1.y < this.point2.y) {
                if (point.y < this.point1.y)
                    return point.distanceTo(this.point1);
                else if (point.y > this.point2.y)
                    return point.distanceTo(this.point2);
            }
            return Math.abs(point.x - this.point1.x);

        } else return point.distanceTo(this.nearestPointTo(point));
    }

    nearestPointTo(point) {
        let intersection = new Intersection(this, this.perpLine(point));

        if (this.inRange(intersection))
            return intersection;
        else if (this.primaryCoordinate(this.point1) > this.primaryCoordinate(this.point2)) {
            if (this.primaryCoordinate(intersection) > this.primaryCoordinate(this.point1))
                return this.point1;
            else if (this.primaryCoordinate(intersection) < this.primaryCoordinate(this.point2))
                return this.point2;
            else throw new Error("inconsistant result!");

        } else if (this.primaryCoordinate(this.point1) < this.primaryCoordinate(this.point2)) {
            if (this.primaryCoordinate(intersection) < this.primaryCoordinate(this.point1))
                return this.point1;
            else if (this.primaryCoordinate(intersection) > this.primaryCoordinate(this.point2))
                return this.point2;
            else throw new Error("inconsistant result!");

        } else throw new Error("inconsistant result!");
    }

    pointsBetween(otherSegmentOnSameLine, onlyIfOverlapping = false, overlapIncludesSharedEndpoint = true) {
        if (!Line.equalSlope(this, otherSegmentOnSameLine) ||
            this.getPrimaryIntercept() !== otherSegmentOnSameLine.getPrimaryIntercept() ||
            this.usesXAsPrimary !== otherSegmentOnSameLine.usesXAsPrimary
           )
            throw new Error();

        let minP1;
        let maxP1;
        if (this.primaryCoordinate(this.point1) <= this.primaryCoordinate(this.point2)) {
            minP1 = this.point1;
            maxP1 = this.point2;
        } else if (this.primaryCoordinate(this.point1) > this.primaryCoordinate(this.point2)) {
            minP1 = this.point2;
            maxP1 = this.point1;
        } else throw new Error();

        let minP2;
        let maxP2;
        if (this.primaryCoordinate(otherSegmentOnSameLine.point1) <= this.primaryCoordinate(otherSegmentOnSameLine.point2)) {
            minP2 = otherSegmentOnSameLine.point1;
            maxP2 = otherSegmentOnSameLine.point2;
        } else if (this.primaryCoordinate(otherSegmentOnSameLine.point1) > this.primaryCoordinate(otherSegmentOnSameLine.point2)) {
            minP2 = otherSegmentOnSameLine.point2;
            maxP2 = otherSegmentOnSameLine.point1;
        } else throw new Error();

        let min1 = this.primaryCoordinate(minP1);
        let max1 = this.primaryCoordinate(maxP1);
        let min2 = this.primaryCoordinate(minP2);
        let max2 = this.primaryCoordinate(maxP2);
        let p1 = undefined;
        let p2 = undefined;

        if (min1 <= min2) {
            p1 = minP2;

            if (max1 >= max2) //line 1 completely contains line2 (or they are identical)
                p2 = maxP2;

            else if (max1 < max2) {
                if (max1 <= min2) {
                    if(onlyIfOverlapping || (overlapIncludesSharedEndpoint && max1 === min2)) p1 = maxP1;
                    else return undefined; //no overlap

                } else if (max1 > min2) {
                    p2 = maxP1;

                } else throw new Error();

            } else throw new Error("unexpected result in segment.overlappingSegmentWith");

        } else if (min1 > min2) {
            p1 = minP1;

            if (max1 <= max2) //line 2 completely contains line 1
                p2 = maxP1;

            else if (max1 > max2) {
                if (min1 >= max2) {
                    if (onlyIfOverlapping || (overlapIncludesSharedEndpoint && min1 === max2)) p2 = maxP2;
                    else return undefined; //no overlap

                } else if (min1 < max2) {
                    p2 = maxP2;

                } else throw new Error();

            } else throw new Error("unexpected result in segment.overlappingSegmentWith");

        } else throw new Error("unexpected result in segment.overlappingSegmentWith");

        return [p1, p2];
    }

    overlappingSegmentWith(otherSegmentOnSameLine, endpointsInclusive = true, copyPoints = false) {
        let points = this.pointsBetween(otherSegmentOnSameLine, true, endpointsInclusive);
        if (points) {
            if (copyPoints) return new Segment(points[0].copy(), points[1].copy());
            else return new Segment(points[0], points[1]);
        } else return undefined;
    }

    midpointBetween(otherSegmentOnSameLine, onlyIfOverlapping = false, overlapIncludesSharedEndpoint = true) {
        let points = this.pointsBetween(otherSegmentOnSameLine, onlyIfOverlapping, overlapIncludesSharedEndpoint);
        if (points) {
            return new Position(myMid(points[0].x, points[1].x), myMid(points[0].y, points[1].y));
        } else return undefined;
    }

    draw(context = UI.board.context, drawPoints = false) {
        context.beginPath();
        context.moveTo(this.point1.x, this.point1.y);
        context.lineTo(this.point2.x, this.point2.y);
        context.stroke();
        if (drawPoints) {
            this.point1.draw();
            this.point2.draw();
        }
    }
}


class Line {
    //abstract line defined by y/x intercept and slope/invSlope, with no defined start or end points
    //this class is used to group segments/surfaces that all lie on the same abstract line, for simplifying ball collision calculations

    constructorArgs() { return [(() => this.getPrimarySlope()), (() => this.getPrimaryIntercept()), "usesYAsPrimary"]; }
    enumerate() { return ["slope", "invSlope", "xIntercept", "yIntercept"]; }

    constructor(point1orSlope, point2orIntercept, invertSlopeXIntercept = false) { //use invert = true when the invSlope and XIntercept are passed.  Default is slope and YIntercepet
        if (point1orSlope instanceof Position) {
            let point1 = point1orSlope, point2 = point2orIntercept;
            if (Number.isFinite(point2)) { //an intercept and a point.  Convert the intercept into a point
                if (invertSlopeXIntercept === true) point2 = new Position(point2orIntercept, 0);
                else if (invertSlopeXIntercept === false) point2 = new Position(0, point2orIntercept);
                else throw new Error("invalid point2orIntercept argument");
            } else if (!(point2 instanceof Position)) throw new Error("invalid point2orIntercept argument");

            if (point1.equalTo(point2)) throw new Error("cannot construct a line from two identical points");
            if (point1.x === point2.x) {
                this.slope = Number.POSITIVE_INFINITY;
                this.invSlope = 0;
                this.xIntercept = point1.x;
                this.yIntercept = Number.NaN;
                Line.substituteFunctions_vert(this);
            } else if (point1.y === point2.y) {
                this.slope = 0;
                this.invSlope = Number.POSITIVE_INFINITY;
                this.xIntercept = Number.NaN;
                this.yIntercept = point1.y;
                Line.substituteFunctions_horz(this);
            } else {
                this.slope = point1.slopeTo(point2);
                if (this.slope != point2.slopeTo(point1)) console.log("inconsistant slope calculation.  from point1->point2: " + this.slope + "   from point2->point1: " + point2.slopeTo(point1));

                this.invSlope = point1.invSlopeTo(point2);
                if (this.invSlope != point2.invSlopeTo(point1)) console.log("inconsistant invSlope calculation.  from point1->point2: " + this.invSlope + "   from point2->point1: " + point2.invSlopeTo(point1));

                let fromP1 = point1.y - this.slope * point1.x;
                let fromP2 = point2.y - this.slope * point2.x;
                this.yIntercept = fromP1 === fromP2 ? fromP1 : (fromP1 + fromP2) / 2; //to prevent losing a sigDigit (in binary) if they are identical.  rounding errors may cause them to be slightly different

                fromP1 = point1.x - this.invSlope * point1.y;
                fromP2 = point2.x - this.invSlope * point2.y;
                this.xIntercept = fromP1 === fromP2 ? fromP1 : (fromP1 + fromP2) / 2; //to prevent losing a sigDigit (in binary) if they are identical.  rounding errors may cause them to be slightly different

                if (!(Number.isFinite(this.slope) && Number.isFinite(this.invSlope) && Number.isFinite(this.xIntercept) && Number.isFinite(this.yIntercept))) throw new Error();
            }

        } else if(Number.isFinite(point1orSlope)) {
            if (point2orIntercept instanceof Position) { //a slope and a point.  convert them into the intercept
                if (invertSlopeXIntercept === true) point2orIntercept = point2orIntercept.x - point1orSlope * point2orIntercept.y;
                else if (invertSlopeXIntercept === false) point2orIntercept = point2orIntercept.y - point1orSlope * point2orIntercept.x;
                else throw new Error("invalid point2orIntercept argument");
            } else if (!Number.isFinite(point2orIntercept)) throw new Error("invalid point2orIntercept argument");

            if (invertSlopeXIntercept === true) {
                this.invSlope = point1orSlope;
                this.xIntercept = point2orIntercept;
                this.slope = 1 / this.invSlope;
                this.yIntercept = -(this.xIntercept / this.invSlope);
            } else if (invertSlopeXIntercept === false) {
                this.slope = point1orSlope;
                this.yIntercept = point2orIntercept;
                this.invSlope = 1 / this.slope;
                this.xIntercept = -(this.yIntercept / this.slope);
            } else throw new Error("invalid argument to Line constructor, invertSlopeXIntercept: " + invertSlopeXIntercept);

        } else throw new Error("invalid point1orSlope argument");

        Line.assignPrimarySecondaryCoordinatesSlopesIntercepts(this);
    }

    //default functions below

    containsSegment(segment) {
        if (segment.slope === this.slope && segment.yIntercept === this.yIntercept) {
            if (segment.invSlope !== this.invSlope || segment.xIntercept !== this.xIntercept) {
                console.log("inconsistant result in line.containsSegment");
            }
            return true;
        } else if (segment.invSlope === this.invSlope || segment.xIntercept === this.xIntercept) {
            console.log("inconsistant result in line.containsSegment");
            return true;
        } else return false;
    }

    containsPoint(point) {
        if (this.secondaryCoordinate(point) === Position.round(this.primaryCoordinate(point) * this.primarySlope(this) + this.primaryIntercept(this))) {
            if (this.primaryCoordinate(point) !== Position.round(this.secondaryCoordinate(point) * this.secondarySlope(this) + this.secondaryIntercept(this))) Line.inconsistent++;
            else Line.consistent++;
            return true;
        } else if (this.primaryCoordinate(point) === Position.round(this.secondaryCoordinate(point) * this.secondarySlope(this) + this.secondaryIntercept(this))) {
            Line.inconsistent++;
            return true;
        }
        Line.consistent++;
        return false;
    }

    get usesYAsPrimary() {
        if (this.primaryCoordinate === coordinate_y && this.primarySlope === slope_invSlope && this.primaryIntercept === intercept_x) return true;
        else if (this.primaryCoordinate === coordinate_x && this.primarySlope === slope_slope && this.primaryIntercept === intercept_y) return false;
        else throw new Error();
    }

    get usesXAsPrimary() {
        if (this.primaryCoordinate === coordinate_x && this.primarySlope === slope_slope && this.primaryIntercept === intercept_y) return true;
        else if (this.primaryCoordinate === coordinate_y && this.primarySlope === slope_invSlope && this.primaryIntercept === intercept_x) return false;
        else throw new Error();
    }

    getPrimarySlope() { return this.primarySlope(this); }
    getSecondarySlope() { return this.secondarySlope(this); }
    getPrimaryIntercept() { return this.primaryIntercept(this); }
    getSecondaryIntercept() { return this.secondaryIntercept(this); }

    primarySlope() { return null; } //these functions will be replaced upon construction
    secondarySlope() { return null; }
    primaryIntercept() { return null; }
    secondaryIntercept() { return null; }

    intersectionWith(line) { //line or segment
        return new Intersection(this, line);
    }

    perpLine(throughPoint = new Position()) {
        return new Line(-this.getPrimarySlope(), throughPoint, this.usesXAsPrimary);
    }

    parLine(throughPoint = new Position()) {
        return new Line(this.getPrimarySlope(), throughPoint, this.usesYAsPrimary);
    }

    nearestPointTo(point) {
        return new Intersection(this, this.perpLine(point));
    }

    distanceFrom(point) {
        let result = Math.abs(this.getPrimaryIntercept() + this.getPrimarySlope() * this.primaryCoordinate(point) - this.secondaryCoordinate(point)) / Math.sqrt(this.getPrimarySlope() ** 2 + 1);
        if (this.nearestPointTo(point).distanceTo(point) != result) console.log("unexpected result in line.distanceFrom(point) function.  Algebraicly Simplified formula: " + result + "   line.nearestPointTo(point).distanceTo(point): " + this.nearestPointTo(point).distanceTo(point));
        return result;
    }

    inRange(point) { if (point instanceof Position) return true; else throw new Error("invalid point argument to line.inRange"); }

    pointFromX(xCoordinate) {
        if (!Number.isFinite(this.slope)) return undefined;
        return new Position(xCoordinate, xCoordinate * this.slope + this.yIntercept);
    }

    pointFromY(yCoordinate) {
        if (!Number.isFinite(this.invSlope)) return undefined;
        return new Position(yCoordinate * this.invSlope + this.xIntercept, yCoordinate);
    }

    pointFromPrimary(primaryCoordinate) {
        return this.setPrimarySecondaryCoordinates(new Position(), primaryCoordinate, primaryCoordinate * this.getPrimarySlope() + this.getPrimaryIntercept());
    }

    pointFromSecondary(secondaryCoordinate) {
        if (!Number.isFinite(this.getSecondarySlope())) return undefined;
        return this.setPrimarySecondaryCoordinates(new Position(), secondaryCoordinate * this.getSecondarySlope() + this.getSecondaryIntercept(), secondaryCoordinate);
    }

    angle(range = ANGLE_RANGE_360.default) {
        if (this.usesXAsPrimary) return Angle.degreesFromSlope(this.getPrimarySlope(), range);
        else if (this.usesYAsPrimary) return Angle.degreesFromInvSlope(this.getPrimarySlope(), range);
        else throw new Error();
    }

    static fromPointAndAngle(point, angle) {
        let slope = Angle.slopeFromDegrees(angle);
        let useInvSlope = slope > -1 && slope <= 1 ? false : true;
        if (useInvSlope) {
            slope = Angle.invSlopeFromDegrees(angle)
            if (slope < -1 || slope >= 1) throw new Error();
        }
        return new Line(slope, point, useInvSlope);
    }

    static substituteFunctions_vert(line) {
        line.containsSegment = containsSegment_vert;
        line.containsPoint = containsPoint_vert;
        line.distanceFrom = distanceFrom_vert;
        this.primaryCoordinate = coordinate_y;
        this.secondaryCoordinate = coordinate_x;
    }

    static substituteFunctions_horz(line) {
        line.containsSegment = containsSegment_horz;
        line.containsPoint = containsPoint_horz;
        line.distanceFrom = distanceFrom_horz;
        this.primaryCoordinate = coordinate_x;
        this.secondaryCoordinate = coordinate_y;
    }

    static assignPrimarySecondaryCoordinates(line) {
        if (line.slope > -1 && line.slope <= 1) { //use 'x' as primary coordinate
            line.primaryCoordinate = coordinate_x;
            line.setPrimaryCoordinate = setCoordinate_x;
            line.secondaryCoordinate = coordinate_y;
            line.setSecondaryCoordinate = setCoordinate_y;
            line.setPrimarySecondaryCoordinates = setCoordinates_x_y;
            return true;
        } else if (line.invSlope >= -1 && line.invSlope < 1) { //use 'y' as primary coordinate
            line.primaryCoordinate = coordinate_y;
            line.setPrimaryCoordinate = setCoordinate_y;
            line.secondaryCoordinate = coordinate_x;
            line.setSecondaryCoordinate = coordinate_x;
            line.setPrimarySecondaryCoordinates = setCoordinates_y_x;
            return false;
        } else {
            console.log(line);
            throw new Error("Cannot determine primary coordinate for line object");
        }
    }

    static assignPrimarySecondaryCoordinatesSlopesIntercepts(line) {
        if (Line.assignPrimarySecondaryCoordinates(line)) { //use 'x' as primary coordinate
            line.primaryIntercept = intercept_y;    //  NOTE that the intercepts are reversed from coordinates
            line.secondaryIntercept = intercept_x;
            line.primarySlope = slope_slope;
            line.secondarySlope = slope_invSlope;
        } else { //use 'y' as primary coordinate
            line.primaryIntercept = intercept_x;    //  NOTE that the intercepts are reversed from coordinates
            line.secondaryIntercept = intercept_y;
            line.primarySlope = slope_invSlope;
            line.secondarySlope = slope_slope;
        }
    }

    static primaryInterceptIncreasing_vectorAngleRange(line) {
        //returns the angle range for which a vector, as it moves forward, will cause the lines at the currentPoint of the vector, parallel to this line (aka with the same slope), to have increasing primary intercepts as the vector moves forward
        let rightwardAngle = Angle.angleFromSlope(line.slope, false);

        if (line.slope < 0 && line.invSlope < 0) {
            //vectors with angles down and right of the line angle, as they move forward, will increase BOTH x and y intercepts of the intersection line parallel to this line
            return new AngleRange(rightwardAngle.degrees - 180, rightwardAngle);

        } else if (line.primaryIntercept === intercept_y && line.slope > 0 && line.invSlope > 0) {
            //vector with angles down and left of the line angle, as they move forward, will increase y intercepts of the intersections lines parallel to this line
            return new AngleRange(rightwardAngle.degrees - 180, rightwardAngle);

        } else if (line.primaryIntercept === intercept_x && line.slope > 0 && line.invSlope > 0) {
            //vector with angles up and right of the line angle, as they move forward, will increase y intercepts of the intersections lines parallel to this line
            return new AngleRange(rightwardAngle, rightwardAngle.degrees + 180);

        } else throw new Error("Line.primaryInterceptIncreasing_vectorAngleRange Cannot generate angle range for a line without a valid primary intercept function or with contradictory slope/invSlope");
    }

    static equalSlope(line1, line2) {
        if (line1.slope === line2.slope || ((line1.slope == Number.POSITIVE_INFINITY || line1.slope == Number.NEGATIVE_INFINITY) && (line2.slope == Number.POSITIVE_INFINITY || line2.slope == Number.NEGATIVE_INFINITY)))
            if (line1.invSlope === line2.invSlope || ((line1.invSlope == Number.POSITIVE_INFINITY || line1.invSlope == Number.NEGATIVE_INFINITY) && (line2.invSlope == Number.POSITIVE_INFINITY || line2.invSlope == Number.NEGATIVE_INFINITY)))
                return true;
            else throw new Error("unexpected result in Line.equalSlope");
        else if (line1.invSlope === line2.invSlope || ((line1.invSlope == Number.POSITIVE_INFINITY || line1.invSlope == Number.NEGATIVE_INFINITY) && (line2.invSlope == Number.POSITIVE_INFINITY || line2.invSlope == Number.NEGATIVE_INFINITY)))
            throw new Error("unexpected result in Line.equalSlope");
        return false;
    }

    draw(context = UI.board.context, rectangle = board.rectangle) {
        let points = new Array(6);
        points[0] = this.pointFromX(board.x);
        points[1] = this.pointFromX(board.x + board.width);
        points[2] = this.pointFromY(board.y);
        points[3] = this.pointFromY(board.y + board.height);

        for (let i = 0; i < 4; i++) {
            if (points[i] && !rectangle.inside(points[i].x, points[i].y, false)) {
                if (!points[4]) points[4] = points[i];
                else if (!points[4].equalTo(points[i])) {
                    points[5] = points[i];
                    break;
                }
            }
        }
        if (!points[4] || !points[5]) {
            for (let i = 0; i < 4; i++) {
                if (!points[4]) points[4] = points[i];
                else if (!points[4].equalTo(points[i])) {
                    points[5] = points[i];
                    break;
                }
            }
        }

        context.beginPath();
        context.moveTo(points[4].x, points[4].y);
        context.lineTo(points[5].x, points[5].y);
        context.stroke();
    }
}

Line.consistent = 0;
Line.inconsistent = 0;

//substitution functions for Line class (and other classes)

function containsSegment_vert(segment) { return segment.point1.x === this.xIntercept && segment.point2.x === this.xIntercept; }
function containsPoint_vert(point) { return point.x === this.xIntercept; }
function distanceFrom_vert(point) { return Math.abs(point.x - this.xIntercept); }

function containsSegment_horz(segment) { return segment.point1.y === this.yIntercept && segment.point2.y === this.yIntercept; }
function containsPoint_horz(point) { return point.y === this.yIntercept; }
function distanceFrom_horz(point) { return Math.abs(point.y - this.yIntercept); }

function coordinate_x(point) { return point.x; }
function coordinate_y(point) { return point.y; }
function intercept_x(line) { return line.xIntercept; }
function intercept_y(line) { return line.yIntercept; }
function slope_slope(line) { return line.slope; }
function slope_invSlope(line) { return line.invSlope; }

function setCoordinate_x(point, value) { point.x = value; return point; }
function setCoordinate_y(point, value) { point.y = value; return point; }
function setCoordinates_x_y(point, primaryCoordinate, secondaryCoordinate) { point.x = primaryCoordinate; point.y = secondaryCoordinate; return point; }
function setCoordinates_y_x(point, primaryCoordinate, secondaryCoordinate) { point.y = primaryCoordinate; point.x = secondaryCoordinate; return point; }

class Intersection extends Position {

    constructorArgs() { return ["line1", "line2"]; }
    enumerate() { return ["x", "y"]; }

    constructor(line1, line2, findImmediately = true) {
        super();
        this.line1 = line1;
        this.line2 = line2;
        if (findImmediately) this.findIntersection();
    }

    setNotDefined() { this.x = undefined; this.y = undefined; this.inRange = false; this.inRange1 = false; this.inRange2 = false; }

    findIntersection(line1 = this.line1, line2 = this.line2, swappedLines = false) { //make sure the slopes and intercepts are recalced if a vector has changed!
        if (Line.equalSlope(line1, line2)) {
            //the lines are parallel!
            if (line1.primaryIntercept(line1) === line1.primaryIntercept(line2)) {
                if (line1.usesXAsPrimary !== line2.usesXAsPrimary) throw new Error();
                //the lines are the same!!
                if (line1 instanceof Segment) {
                    if (line2 instanceof Segment) {
                        //BOTH are segments/surfaces/vectors.  Find their overlap (if it exists) and the midpoint in it, or the midpoint between them if they do not overlap

                        this.updateFromPosition(line1.midpointBetween(line2));

                        //delegating the below to new functions in Segment class
                        /*let min1 = Math.min(line1.primaryCoordinate(line1.point1), line1.primaryCoordinate(line1.point2));
                        let max1 = Math.max(line1.primaryCoordinate(line1.point1), line1.primaryCoordinate(line1.point2));
                        let min2 = Math.min(line1.primaryCoordinate(line2.point1), line1.primaryCoordinate(line2.point2));
                        let max2 = Math.max(line1.primaryCoordinate(line2.point1), line1.primaryCoordinate(line2.point2));
                        let p1 = undefined;
                        let p2 = undefined;

                        if (min1 <= min2) {
                            p1 = min2;
                            if (max1 >= max2) //line 1 completely contains line2 (or they are identical)
                                p2 = max2;
                            else if (max1 < max2)
                                p2 = max1;
                            else throw new Error("unexpected result in findIntersection");
                        } else if (min1 > min2) {
                            p1 = min1;
                            if (max1 <= max2) //line 2 completely contains line 1
                                p2 = max1;
                            else if (max1 > max2)
                                p2 = max2;
                            else throw new Error("unexpected result in findIntersection");
                        } else throw new Error("unexpected result in findIntersection");

                        let midPoint = (p1 + p2) / 2
                        line1.setPrimaryCoordinate(this, midPoint);
                        line1.setSecondaryCoordinate(this, midPoint * line1.primarySlope(line1) )*/


                    //otherwise if only one is a segment/vector, use the mid-point of that one
                    } else this.updateFromCoordinates(myMid(line1.point1.x, line1.point2.x), myMid(line1.point1.y, line1.point2.y));
                } else if (line2 instanceof Segment) {
                    this.updateFromCoordinates(myMid(line2.point1.x, line2.point2.x), myMid(line2.point1.y, line2.point2.y));

                } else { // neither is a segment/vector, both are abstract lines so no intersection point can be defined.  Howver this object will test "in range" of both lines because of the line.inRange function
                    this.x = undefined;
                    this.y = undefined;
                }
            } else this.setNotDefined(); //the lines never intersect

        } else if (Number.isFinite(line1.slope) && Number.isFinite(line2.invSlope)) { //normal case (FINALLY!) two non-parallel lines
            this.y = (line1.slope * line2.xIntercept + line1.yIntercept) / (1 - line1.slope * line2.invSlope);
            this.x = line2.invSlope * this.y + line2.xIntercept;

        } else if (Number.isFinite(line1.invSlope) && Number.isFinite(line2.slope)) { //the two lines need to be swapped to run this function
            return this.findIntersection(line2, line1, true);
        } else {
            ////console.log("error in intersectionPoint function of 'Segment' class: " + line1?.toString() + "   AND    " + line2?.toString());
            this.setNotDefined();
        }

        if (swappedLines) {
            this.line2 = line1;
            this.line1 = line2;
        } else {
            this.line1 = line1;
            this.line2 = line2;
        }

        if (this.defined) {
            this.inRange1 = this.line1.inRange(this);
            this.inRange2 = this.line2.inRange(this);
            this.inRange = this.inRange1 && this.inRange2;
        }

        return this;
    }

    update() {
        return this.findIntersection(this.line1, this.line2);
        ////console.log(this + " inRange: " + this.inRange + "   point1inclusive: " + this.line1.inRange.point1Inclusive + "  line 1: " + this.line1.toString());
    }

    fullString() { return this.toString() + " intersection of line1: " + this.line1 + "   and line2: " + this.line2; }
}

initializeLogger?.("geometry.lines ran");