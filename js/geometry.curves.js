"use strict"; document.currentScript.initTime = performance.now();

const PARABOLIC_CONSTANT = Math.log(1 + SQRT_2) + SQRT_2;

class Parabola {
    constructor(focus, directrix) {
        if (!(focus instanceof Position)) throw new Error();
        if (!(directrix instanceof Line)) throw new Error();
        this.focus = focus;
        this.directrix = directrix;
        this.directrixCenter = directrix.nearestPointTo(focus);
        this.focusDirectrixDistance = focus.distanceTo(this.directrixCenter);
        this.focalLength = this.focusDirectrixDistance / 2

        this.axisOfSymetry = directrix.perpLine(focus);
        this.angleOfAxis = new Angle(this.directrixCenter.angleTo(this.focus));
        if (this.axisOfSymetry.getPrimarySlope() !== (this.axisOfSymetry.usesXAsPrimary ? Angle.slopeFromDegrees(this.angleOfAxis) : Angle.invSlopeFromDegrees(this.angleOfAxis)))
            //console.log({ msg: "inconsistency between angleOfAxis and slope of axisOfSymetry", parabola: this });

        this.angleOfVertex = new Angle(this.angleOfAxis.degrees > 0 ? this.angleOfAxis.degrees - 180 : this.angleOfAxis.degrees + 180, false);
        this.vertex = new ParabolaPoint(Angle.pointFrom(focus, this.angleOfVertex, this.focalLength),this, this.angleOfVertex.degrees, this.focalLength, 0, 0, 0, "vertex",this.angleOfVertex.degrees + 90);
        this.forwardAngleRange = new AngleRange(this.angleOfAxis.degrees - 90, this.angleOfAxis.degrees + 90);
        this.pointAngleRange = new AngleRange(this.angleOfVertex, this.angleOfVertex);
        this.angleOfVertex.range = this.pointAngleRange;

        this.latusRectum = new Line(this.directrix.slope, this.focus, this.directrix.usesYAsPrimary);
        let lrPoints = this.pointsFromDistanceToFocus(this.focusDirectrixDistance)
        this.latusRectum.point1 = lrPoints[0];
        this.latusRectum.point2 = lrPoints[1];
        this.latusRectum.inRange = Segment.prototype.inRange;
    }

    moveDistance(currentPosition, currentAngle, distanceToMove) { //updates the currentPosition, and returns the new direction angle
        let distanceCheck = {
            focus: this.focus.distanceTo(currentPosition),
            directrix: this.directrix.distanceFrom(currentPosition),
        }
        distanceCheck.difference = distanceCheck.focus - distanceCheck.directrix;
        distanceCheck.log2 = Math.log2(Math.abs(distanceCheck.difference))
        if (distanceCheck.log2 > -13) throw new Error("point does not lie on this parabola");
        else if (distanceCheck.log2 < -15) {
            //console.log("larger than expected rounding error in position on parabola:");
            /*//console.log({
                distanceError: distanceCheck,
                currentPosition: currentPosition.toString(),
                parabola: this
            });*/
        }

        let nearestPoint = this.axisOfSymetry.nearestPointTo(currentPosition);

        
    }

    arcLength(distanceToAxis) { return Parabola.arcLength(distanceToAxis, this.focalLength); }
    static arcLength(distanceToAxis, focalLength) {
        if (distanceToAxis < 0 || focalLength < 0) throw new Error();
        let h = distanceToAxis / 2;
        let q = Math.sqrt(focalLength ** 2 + h ** 2);
        return h * q / focalLength + focalLength * Math.log((h + q) / focalLength);
    }

    distanceToAxisFromAxisLength(axisLength) { return Parabola.distanceToAxisFromAxisLength(axisLength, this.focalLength); }
    static distanceToAxisFromAxisLength(axisLength, focalLength) {
        if (axisLength < 0 || focalLength < 0) throw new Error();
        return Math.sqrt((axisLength + focalLength) ** 2 - (axisLength - focalLength) ** 2)
    }

    axisLengthFromDistanceToAxis(distanceToAxis) { return Parabola.axisLengthFromDistanceToAxis(distanceToAxis, this.focalLength); }
    static axisLengthFromDistanceToAxis(distanceToAxis, focalLength) {
        if (distanceToAxis < 0 || focalLength < 0) throw new Error();
        return (distanceToAxis ** 2) / (4 * focalLength);
    }

    axisCoordinatesFromArcLength(arcLength, precision = 18) { return Parabola.axisCoordinatesFromArcLength(arcLength, this.focalLength, precision); }
    static axisCoordinatesFromArcLength(arcLength, focalLength, precision = 18) { // extrapolation based upon tables of arcLength to distanceToAxis values
        arcLength /= focalLength;
        if (arcLength <= 0 || !Number.isFinite(arcLength)) {
            if (arcLength === 0) return 0;
            else throw new Error();
        }
        
        let i = -1;
        while (arcLength > Parabola.arcLengths[i + 1]) {
            if (++i >= Parabola.arcLengths.length - 1) {
                Parabola.axisLengths.push(Parabola.axisLengths[i - 1] * 2);
                Parabola.distancesToAxis.push(Parabola.distanceToAxisFromAxisLength(Parabola.axisLengths[i + 1], 1))
                Parabola.arcLengths.push(Parabola.arcLength(Parabola.distancesToAxis[i + 1], 1));
            }
        }

        while (i < 0) {
            if (!(arcLength >= Parabola.arcLengths[0])) {
                Parabola.axisLengths.unshift(Parabola.axisLengths[1] / 2);
                Parabola.distancesToAxis.unshift(Parabola.distanceToAxisFromAxisLength(Parabola.axisLengths[0], 1));
                Parabola.arcLengths.unshift(Parabola.arcLength(Parabola.distancesToAxis[0], 1));
            } else i++;
        }

        let distanceToAxis; //relative to focalLength
        let axisLength;
        let err
        if (Parabola.arcLengths[i] === arcLength) axisLength = Parabola.axisLengths[i];
        else {
            axisLength = (arcLength - Parabola.arcLengths[i]) / (Parabola.arcLengths[i + 1] - Parabola.arcLengths[i]) * (Parabola.axisLengths[i + 1] - Parabola.axisLengths[i]) + Parabola.axisLengths[i];
            distanceToAxis = Parabola.distanceToAxisFromAxisLength(axisLength, 1);
            let actualArc = Parabola.arcLength(distanceToAxis, 1);
            err = (arcLength - actualArc) / actualArc;
            let iterations = -1;
            while (iterations++ < precision && Math.abs(err) > (2 ** -precision)) {
                axisLength *= 1 + err;
                distanceToAxis = Parabola.distanceToAxisFromAxisLength(axisLength, 1);
                actualArc = Parabola.arcLength(distanceToAxis, 1);
                err = (arcLength - actualArc) / actualArc;
            }
            Parabola.iterations.push(iterations);
        }

        return { distanceToAxis: distanceToAxis * focalLength, axisLength: axisLength * focalLength, err: err };
    }

    intersectionsWith(line, minAngle, maxAngle, minInclusive, maxInclusive) {
        let result = this.intersectionsWith_RAW(line, minAngle, maxAngle, minInclusive, maxInclusive);
        result.forEach((point) => {
            point.updateFromPosition(line.nearestPointTo(point));
        });
        return result;
    }

    intersectionsWith_RAW(line, minAngle = undefined, maxAngle = undefined, minInclusive = (minAngle === undefined), maxInclusive = (maxAngle === undefined)) {
        //inclusives default to false when a min/max angle is included, to true when they are not

        if (Line.equalSlope(this.directrix, line)) // directrix and line are parallel
            return this.pointsFromNearestAxisPoint(this.axisOfSymetry.intersectionWith(line), minAngle, maxAngle, minInclusive, maxInclusive);

        this.pointAngleRange.min = minAngle ?? this.pointAngleRange.minXOver;
        this.pointAngleRange.max = maxAngle ?? this.pointAngleRange.maxXOver;

        if (Line.equalSlope(this.axisOfSymetry, line)) { // axis and line are parallel.  One point of intersection
            let directrixIntersection = this.directrix.intersectionWith(line);
            if (!this.directrixCenter.equalTo(directrixIntersection)) {
                let intersectionAngle = this.vertex.angleTo(directrixIntersection, this.pointAngleRange);
                if (intersectionAngle > this.angleOfVertex.degrees)
                    minAngle = Math.max(this.angleOfVertex.degrees, this.pointAngleRange.min.degrees);
                else if (intersectionAngle < this.angleOfVertex.degrees)
                    maxAngle = Math.min(this.angleOfVertex.degrees, this.pointAngleRange.max.degrees);
            }
            let result = this.pointsFromDistanceToAxis(this.directrixCenter.distanceTo(directrixIntersection), minAngle, maxAngle, minInclusive, maxInclusive);
            if (result.length > 1) throw new Error();
            return result;
        }

        let focusLine = line.perpLine(this.focus);
        let directrixIntersection = focusLine.intersectionWith(this.directrix);

        let distFactor = directrixIntersection.distanceTo(this.focus);

        let axisIntersection = this.axisOfSymetry.intersectionWith(line);
        if (!axisIntersection.equalTo(this.focus)) {
            let distFactor2;
            let axisIntersectionAngle = this.focus.angleTo(axisIntersection);
            if (this.forwardAngleRange.inRange(axisIntersectionAngle))
                distFactor2 = distFactor + line.distanceFrom(this.focus) * 2;
            else {
                distFactor2 = distFactor - line.distanceFrom(this.focus) * 2;
                if (distFactor2 < 0) return [];
            }
            distFactor = Math.sqrt(distFactor * distFactor2);
        }

        let centerDistance = this.directrixCenter.distanceTo(directrixIntersection);

        let distanceToAxis1 = distFactor + centerDistance;
        let distanceToAxis2 = distFactor - centerDistance;
        let axisLength1 = this.axisLengthFromDistanceToAxis(distanceToAxis1);
        let axisLength2 = this.axisLengthFromDistanceToAxis(Math.abs(distanceToAxis2));

        let min1 = minAngle;
        let min2 = minAngle;
        let max1 = maxAngle;
        let max2 = maxAngle;

        let directrixIntersectionAngle = this.focus.angleTo(directrixIntersection, this.pointAngleRange);
        if (directrixIntersectionAngle < this.angleOfVertex.degrees) {
            max1 = Math.min(this.angleOfVertex.degrees, this.pointAngleRange.max.degrees);
            if (distanceToAxis2 > 0) min2 = Math.max(this.angleOfVertex.degrees, this.pointAngleRange.min.degrees);
        } else if (directrixIntersectionAngle > this.angleOfVertex.degrees) {
            min1 = Math.max(this.angleOfVertex.degrees, this.pointAngleRange.min.degrees);
            if (distanceToAxis2 > 0) max2 = Math.min(this.angleOfVertex.degrees, this.pointAngleRange.max.degrees);
        } else throw new Error();


        if (centerDistance === 0 || distFactor === 0) { //only one point... don't want duplicates
            let result = this.generatePoints(axisLength1 + this.focalLength, axisLength1 - this.focalLength, min1, max1, minInclusive, maxInclusive, axisLength1, distanceToAxis1);
            if (result.length > 1) throw new Error();
            return result;

        }

        if (distanceToAxis2 < 0) {
            distanceToAxis2 = -distanceToAxis2;
            min2 = min1;
            max2 = max1;
        }

        let result = [  ...this.generatePoints(axisLength1 + this.focalLength, axisLength1 - this.focalLength, min1, max1, minInclusive, maxInclusive, axisLength1, distanceToAxis1),
                        ...this.generatePoints(axisLength2 + this.focalLength, axisLength2 - this.focalLength, min2, max2, minInclusive, maxInclusive, axisLength2, distanceToAxis2)];

        if (result.length > 2) throw new Error();
        return result.sort((result1, result2) => { return result1.angleFromFocus - result2.angleFromFocus; });
    }

    generatePoints(focusDistance, axisLengthFromFocus = (focusDistance - this.focusDirectrixDistance), minAngle, maxAngle, minInclusive, maxInclusive, axisLength, distanceToAxis, arcLength, nearestAxisPoint) {
        if (focusDistance < this.focalLength) throw new Error("invalid argument to Parabola.generatePoints.  distance must be at least the distance between focus and vertex");
        this.pointAngleRange.min = minAngle ?? this.pointAngleRange.minXOver;
        this.pointAngleRange.max = maxAngle ?? this.pointAngleRange.maxXOver;

        if (focusDistance === this.focalLength) {
            if (this.pointAngleRange.inRange(this.angleOfVertex, false, minInclusive, maxInclusive))
                return [new ParabolaPoint(this.vertex, this, this.angleOfVertex.degrees, this.focalLength, 0, 0, 0, this.vertex, this.angleOfVertex.degrees + 90)];
            else return [];
        }

        let angleFromFocus = Math.abs(Math.acos(axisLengthFromFocus / focusDistance)); //need to keep the results always returning in order from most clockwise to most counter-clockwise, thus the abs

        let result = [];

        let degrees = this.pointAngleRange.transform(Angle.radiansToDegrees(this.angleOfAxis.radians - angleFromFocus));
        if (this.pointAngleRange.inRange(degrees, true, minInclusive, maxInclusive))
            result.push(new ParabolaPoint(Angle.pointFromRadians(this.focus, this.angleOfAxis.radians - angleFromFocus, focusDistance), this, degrees, focusDistance, axisLength, distanceToAxis, arcLength, nearestAxisPoint));

        degrees = this.pointAngleRange.transform(Angle.radiansToDegrees(this.angleOfAxis.radians + angleFromFocus));
        if (this.pointAngleRange.inRange(degrees, true, minInclusive, maxInclusive))
            result.push(new ParabolaPoint(Angle.pointFromRadians(this.focus, this.angleOfAxis.radians + angleFromFocus, focusDistance), this, degrees, focusDistance, axisLength, distanceToAxis, arcLength, nearestAxisPoint));

        return result;
    }

    pointsFromDistanceToFocus(focusDistance, minAngle, maxAngle, minInclusive = (minAngle === undefined), maxInclusive = (maxAngle === undefined)) { //inclusives default to false when a min/max angle is included, to true when they are not
        return this.generatePoints(focusDistance, focusDistance - this.focusDirectrixDistance, minAngle, maxAngle, minInclusive, maxInclusive);
    }

    pointsFromAxisLength(axisLength, minAngle, maxAngle, minInclusive = (minAngle === undefined), maxInclusive = (maxAngle === undefined)) { //inclusives default to false when a min/max angle is included, to true when they are not
        return this.generatePoints(axisLength + this.focalLength, axisLength - this.focalLength, minAngle, maxAngle, minInclusive, maxInclusive, axisLength);
    }

    pointsFromDistanceToAxis(distanceToAxis, minAngle, maxAngle, minInclusive = (minAngle === undefined), maxInclusive = (maxAngle === undefined)) { //inclusives default to false when a min/max angle is included, to true when they are not
        let axisLength = this.axisLengthFromDistanceToAxis(distanceToAxis);
        return this.generatePoints(axisLength + this.focalLength, axisLength - this.focalLength, minAngle, maxAngle, minInclusive, maxInclusive, axisLength, distanceToAxis);
    }

    pointsFromNearestAxisPoint(nearestAxisPoint, minAngle, maxAngle, minInclusive = (minAngle === undefined), maxInclusive = (maxAngle === undefined)) { //inclusives default to false when a min/max angle is included, to true when they are not
        //NOTE: DOES NOT CHECK IF THE POINT IS ACTUALLY ON THE AXIS OF SYMETRY
        let distance = this.directrixCenter.distanceTo(nearestAxisPoint);
        if (distance < this.focalLength) return [];
        return this.generatePoints(distance, undefined, minAngle, maxAngle, minInclusive, maxInclusive, distance - this.focalLength, undefined, undefined, nearestAxisPoint);
    }

    pointFromArcLength(arcLength, clockwise = true) {
        if (!(arcLength > 0)) {
            if (arcLength === 0) return new ParabolaPoint(this.vertex, this, this.angleOfVertex.degrees, this.focalLength, 0, 0, 0, this.vertex, this.angleOfVertex.degrees + 90);
            else throw new Error()
        }

        let axisCoordinates = this.axisCoordinatesFromArcLength(arcLength);
        let result;
        if (clockwise)
            result = this.generatePoints(axisCoordinates.axisLength + this.focalLength, axisCoordinates.axisLength - this.focalLength, undefined, this.angleOfVertex, true, true, axisCoordinates.axisLength, axisCoordinates.distanceToAxis, arcLength);
        else result = this.generatePoints(axisCoordinates.axisLength + this.focalLength, axisCoordinates.axisLength - this.focalLength, this.angleOfVertex, undefined, true, true, axisCoordinates.axisLength, axisCoordinates.distanceToAxis, arcLength);
        if (result.length !== 1) throw new Error();
        return result[0];
    }

    tangentAngleAt(point) {
        //"forward" angle of tangent line at this point.  add/subtract 180 to make it point back towards the vertex
        //NOTE: does NOT check if the point is actually on the parabola!
        if (point instanceof ParabolaPoint && point.parabola === this) return point.tangentAngle;
        else return Angle.acuteMidpoint(this.focus.angleTo(point), this.angleOfAxis, this.pointAngleRange);
    }

    draw(context = UI.board.context, rectangle = board.rectangle) {
        context.strokeStyle = WHITE.string;
        context.lineWidth = 1;

        let rectLines = [
            new Line(0, rectangle.y, false),
            new Line(0, rectangle.y + rectangle.height, false),
            new Line(0, rectangle.x, true),
            new Line(0, rectangle.x + rectangle.width, true)
        ];

        let rawIntersections = [];
        rectLines.forEach((line) => {
            let group = this.intersectionsWith(line);
            group.line = line;
            rawIntersections.push(group);
        });
        
        let rectIntersections = [];

        rawIntersections.forEach((group) => {
            group.forEach((intersection) => {
                let nearestPoint = group.line.nearestPointTo(intersection);
                if (rectangle.inside(nearestPoint.x, nearestPoint.y) || rectangle.inside(intersection.x, intersection.y)) {
                    let duplicate = false;
                    rectIntersections.forEach((establishedIntersection) => {
                        let dist = Math.min(    establishedIntersection.distanceTo(intersection),
                                                establishedIntersection.distanceTo(nearestPoint),
                                                establishedIntersection.nearestPoint.distanceTo(intersection),
                                                establishedIntersection.nearestPoint.distanceTo(nearestPoint)
                                            );
                        if (dist < this.focalLength * 2 ** -8) duplicate = true;
                    });
                    if (!duplicate) {
                        intersection.nearestPoint = nearestPoint;
                        rectIntersections.push(intersection);
                    }
                }
            });
        });

        if (!(rectIntersections.length % 2 === 0 && rectIntersections.length > 0)) throw new Error();
        rectIntersections.sort((int1, int2) => { return int1.angleFromFocus - int2.angleFromFocus });

        let inc = this.focalLength / 64;

        for (let segment = 0; segment < rectIntersections.length; segment += 2) {
            if (rectIntersections[segment].angleFromFocus < this.angleOfVertex.degrees && rectIntersections[segment + 1].angleFromFocus > this.angleOfVertex.degrees)
                rectIntersections.splice(segment + 1, 0, this.vertex, this.vertex);

            context.beginPath();
            context.moveTo(rectIntersections[segment].x, rectIntersections[segment].y);
            let tempPoint = rectIntersections[segment];
            let signedInc = inc * (rectIntersections[segment].angleFromFocus < this.angleOfVertex.degrees ? -1 : 1);
            while (tempPoint && tempPoint.distanceToFocus + signedInc >= this.focalLength) {
                context.lineTo(tempPoint.x, tempPoint.y);
                tempPoint = this.pointsFromDistanceToFocus(tempPoint.distanceToFocus + signedInc, rectIntersections[segment].angleFromFocus, rectIntersections[segment + 1].angleFromFocus)[0];
            }
            context.lineTo(rectIntersections[segment + 1].x, rectIntersections[segment + 1].y)
            context.stroke();
        }
    }
}

Parabola.iterations = new Array();

class ParabolaPoint extends Position {
    constructor(point, parabola, angleFromFocus = undefined, distanceToFocus = undefined, axisLength = undefined, distanceToAxis = undefined, arcLength = undefined, nearestAxisPoint = undefined, tangentAngle = undefined) {
        super(point.x, point.y);
        if (parabola instanceof Parabola) this.parabola = parabola;
        else throw new Error();

        let props = {};

        if (Number.isFinite(angleFromFocus)) props.angleFromFocus = { value: angleFromFocus };

        if (Number.isFinite(distanceToFocus)) props.distanceToFocus = { value: distanceToFocus };
        else if (Number.isFinite(axisLength)) props.distanceToFocus = { value: axisLength + parabola.focalLength };

        if (Number.isFinite(axisLength)) props.axisLength = { value: axisLength };
        else if (Number.isFinite(distanceToFocus)) props.axisLength = { value: distanceToFocus - parabola.focalLength };

        if (Number.isFinite(distanceToAxis)) props.distanceToAxis = { value: distanceToAxis };

        if (Number.isFinite(arcLength)) props.arcLength = { value: arcLength };

        if (Number.isFinite(tangentAngle)) props.tangentAngle = { value: tangentAngle };

        if (nearestAxisPoint === "vertex") nearestAxisPoint = this;
        if (nearestAxisPoint instanceof Position) props.nearestAxisPoint = { value: nearestAxisPoint };

        Object.defineProperties(this, props);
    }

    get angleFromFocus() {
        Object.defineProperty(this, "angleFromFocus", { value: this.parabola.focus.angleTo(this, this.parabola.pointAngleRange) });
        return this.angleFromFocus;
    }
    get distanceToFocus() {
        Object.defineProperty(this, "distanceToFocus", { value: this.axisLength + this.parabola.focalLength });
        return this.distanceToFocus;
    }
    get axisLength() {
        Object.defineProperty(this, "axisLength", { value: this.nearestAxisPoint.distanceTo(this.parabola.vertex) });
        return this.axisLength;
    }
    get distanceToAxis() {
        Object.defineProperty(this, "distanceToAxis", { value: this.nearestAxisPoint.distanceTo(this) });
        return this.distanceToAxis;
    }
    get arcLength() {
        Object.defineProperty(this, "arcLength", { value: this.parabola.arcLength(this.distanceToAxis) });
        return this.arcLength;
    }
    get nearestAxisPoint() {
        Object.defineProperty(this, "nearestAxisPoint", { value: this.parabola.axisOfSymetry.nearestPointTo(this) });
        return this.nearestAxisPoint;
    }
    get tangentAngle() {
        Object.defineProperty(this, "tangentAngle", { value: Angle.acuteMidpoint(this.angleFromFocus, this.parabola.angleOfAxis, this.parabola.pointAngleRange) });
        return this.tangentAngle;
    }
    get error() {
        Object.defineProperty(this, "error", { value: Math.abs(this.parabola.directrix.distanceFrom(this) - this.parabola.focus.distanceTo(this)) });
        return this.error;
    }
    get errorLog2() {
        Object.defineProperty(this, "errorLog2", { value: Math.log2(this.error) });
        return this.errorLog2;
    }
    get error_FL() {
        Object.defineProperty(this, "error_FL", { value: this.error / this.parabola.focalLength });
        return this.error_FL;
    }
};

class Circle extends ObjectWithPosition {
    constructor(xOrPosition, y, radius) {
        super(xOrPosition, y);
        this.radius = radius;
    }

    set radius(value) { if (Number.isFinite(value) && value >= 0) this.rd = value; else throw new Error(); }
    get radius() { return this.rd; }
    get width() { return this.radius * 2; }
    get height() { return this.radius * 2; }
    get diameter() { return this.radius * 2; }
    area() { return PI * this.radius ** 2; }
    circumference() { return 2 * PI * this.radius; }

    intersectionsWithLine(line) { //returns all points regardless of whether they are in-range.  Segments are treated as abstract lines
        let a = line.getPrimarySlope() ** 2 + 1;
        let b = line.getPrimarySlope() * (line.getPrimaryIntercept() - line.secondaryCoordinate(this)) - line.primaryCoordinate(this);
        b *= 2;
        let c = this.x ** 2 + this.y ** 2 - this.radius ** 2 + line.getPrimaryIntercept() * (line.getPrimaryIntercept() - 2 * line.secondaryCoordinate(this));
        let primaryCoords = quadraticFormula(a, b, c);
        if (primaryCoords) {
            let result = [];
            primaryCoords.forEach((coord) => {
                result.push(Line.prototype.pointFromPrimary.call(line, coord));
            });
            return result;
        } else return undefined;
    }

    intersectionsWithSegment(segment, point1Inclusive = true, point2Inclusive = true) { //returns only points that are in-range.  Lines are treated as segments (but by default always return 'true' to in-range)
        let a = segment.getPrimarySlope() ** 2 + 1;
        let b = segment.getPrimarySlope() * (segment.getPrimaryIntercept() - segment.secondaryCoordinate(this)) - segment.primaryCoordinate(this);
        b *= 2;
        let c = this.x ** 2 + this.y ** 2 - this.radius ** 2 + segment.getPrimaryIntercept() * (segment.getPrimaryIntercept() - 2 * segment.secondaryCoordinate(this));
        let primaryCoords = quadraticFormula(a, b, c);
        if (primaryCoords) {
            let result = [];
            primaryCoords.forEach((coord) => {
                let intersection = Line.prototype.pointFromPrimary.call(segment, coord);
                if (segment.inRange(intersection, point1Inclusive, point2Inclusive)) result.push(intersection);
            });
            if (result.length > 0) return result; else return undefined;
        } else return undefined;
    }

    draw(context = UI.board.context, drawCenter = true) {
        context.beginPath();
        context.arc(this.x, this.y, this.radius, 0, TWO_PI);
        context.stroke();
        if (drawCenter) this.position.draw();

    }

    partialArea(angle1, angle2) {
        return this.area() * Angle.acuteDistance(angle1, angle2) / 360;
    }

    arcArea(angle1, angle2) {
        let angle = Angle.acuteDistance(angle1, angle2);
        return this.area() * angle / 360 - Math.sin(Angle.degreesToRadians(2 * angle)) / 2 * this.radius;
    }

    overlappingAreaWithPolygon(polygon) {
        let intersectionPoints = [];
        polygon.segments.forEach((segment, index) => {
            let points = this.intersectionsWithSegment(segment);
            if (!points) return;

            points.forEach((point) => {
                let intersectionObj
                intersectionPoints.forEach((intersection) => { //check for redundancy
                    if (intersection.point.distanceTo(point) < 2 ** -14) {
                        if (intersectionObj) throw new Error();
                        else intersectionObj = intersection;
                    }
                });
                if (!intersectionObj) {
                    if (intersection.point.distanceTo(surface.point1) < 2 ** -14) 
                        point = surface.point1;

                    if (intersection.point.distanceTo(surface.point2) < 2 ** -14)
                        point = surface.point2;

                    intersectionObj = {
                        point: point,
                        segments: [],
                        angle: this.position.angleTo(point)
                    };
                    intersectionObj.tangentAngleRange = new AngleRange(intersectionObj.angle - 90, intersectionObj.angle + 90);
                    intersectionPoints.push(intersectionObj);
                };
                let segmentObj = {
                    segment: segment,
                    index: index,
                    angle: segment.point1.angleTo(segment.point2),
                }
                if (intersectionObj.tangentAngleRange.inRange(segmentObj.angle, false, false, false))
                    segmentObj.enteringClockwise = false;
                else if (!intersectionObj.tangentAngleRange.inRange(segmentObj.angle, false, true, true))
                    segmentObj.enteringClockwise = true;
                else
                    segmentObj.enteringclockwise = null; //this segment is a tangent line, the circle does not actually cross over it

                intersectionObj.segments.unshift(segmentObj);

            });
        });

        for (let i = 0; i < intersectionPoints.length; i++) {
            if (intersectionPoints[i].segments.length === 1) {
                if ((intersectionPoints[i].segments.enteringClockwise = intersectionPoints[i].segments[0].enteringClockwise) === null)
                    intersectionPoints.splice(i--, 1);
                continue;
            } else if (intersectionPoints[i].segments.length !== 2) throw new Error();

            if ((intersectionPoints[i].segments.enteringClockwise = intersectionPoints[i].segments[0].enteringClockwise) !== intersectionPoints[i].segments[1].enteringClockwise)
                throw new Error();
            if (intersectionPoints[i].segments.enteringClockwise === null)
                intersectionPoints.splice(i--, 1);
        }

        if (intersectionPoints.length % 2 > 0) throw new Error();



        let clippedPolygon = [];
        let arcAreas = [];
    }
}

function quadraticFormula(a, b, c) {
    let sqrt = Math.sqrt(b ** 2 - 4 * a * c);
    if (Number.isFinite(sqrt)) {
        a *= 2;
        if (sqrt === 0) return [-b / a];
        else return [(-b + sqrt) / a, (-b - sqrt) / a];
    } else return undefined;
}

class ParabolicVector extends Parabola {
    constructor(focus, directrix, object) { //object = object with position, vector, and velocity
        super(focus, directrix);

        if (this.focus.distanceTo(object.currentPosition) - this.directrix.distanceFrom(object.currentPosition) > 2 ** -12) throw new Error();

        this.currentPosition = new ParabolaPoint(object.currentPosition, this);
        if ((object.velocity.direction.degrees - this.currentPosition.tangentAngle) > 2 ** -6) throw new Error();

        if (this.currentPosition.tangentAngle < this.angleOfVertex.degrees) this.goingGlockwise = true;
        else if (this.currentPosition.tangentAngle > this.angleOfVertex.degrees) this.goingClockwise = false;
        else throw new Error();

        if (this.currentPosition.angleFromFocus < this.angleOfVertex.degrees) this.currentlyClockwise = true;
        else if (this.currentPosition.angleFromFocus > this.angleOfVertex.degrees) this.currentlyClockwise = false;
        else if (this.currentPosition.angleFromFocus === this.angleOfVertex.degrees) this.currentlyClockwise = this.goingClockwise;
        else throw new Error();

        if (object.vector instanceof Vector) object.linearVector = object.vector;
        else if (!(object.vector instanceof ParabolicVector && object.linearVector instanceof Vector)) throw new Error();
        object.vector = this;
        this.objectWithPositionVectorAndVelocity = object;

        object.move = this.move;
        object.updateVectorDirection = this.updateDirection;
        object.updateVectorDestination = this.updateDestination;
        object.inRange = this.inRange;
        object.isForward = this.isForward;
        object.tailPoint = this.tailPoint
    }

    restoreObjectWithPositionVectorAndVelocity(object) {
        if (this.objectWithPositionVectorAndVelocity !== object) throw new Error();
        delete object.move;
        delete object.updateVectorDirection;
        delete object.updateVectorDestination;
        delete object.inRange;
        delete object.isForward;
        delete object.tailPoint;
        if (!(object.linearVector instanceof Vector)) throw new Error();
        object.vector = object.linearVector;
        delete object.linearVector;
        object.updateVectorDirection();
    }

    move(seconds = this.remainingFrameSeconds, velocity = this.velocity) {
        let distance = seconds * velocity.speed;
        if (this.remainingDistance > distance) {
            this.remainingDistance -= distance;
            this.remainingFrameSeconds -= seconds;

            if (this.vector.goingClockwise === this.vector.currentlyClockwise) { //heading away from vertex
                this.vector.currentPosition = this.vector.pointFromArcLength(this.vector.currentPosition.arcLength + distance, this.vector.goingClockwise);
                this.direction = this.vector.currentPosition.tangentAngle;

            } else if (xor(this.vector.goingClockwise, this.vector.currentlyClockwise)) { //heading towards vertex
                if (distance < this.vector.currentPosition.arcLength) { //will not reach the vertex in this frame
                    this.vector.currentPosition = this.vector.pointFromArcLength(this.vector.currentPosition.arcLength - distance, this.vector.currentlyClockwise);
                    this.direction = this.vector.currentPosition.tangentAngle + 180;

                } else if ((distance -= this.vector.currentPosition.arcLength) >= 0) { //will reach vertex in this frame
                    this.vector.currentlyClockwise = !this.vector.currentlyClockwise;
                    this.vector.currentPosition = this.vector.pointFromArcLength(distance, this.vector.currentlyClockwise);
                    if (this.goingClockwise === (this.vector.currentPosition.tangentAngle < this.vector.angleOfVertex.degrees ? true : (this.vector.currentPosition.tangentAngle > this.vector.angleOfVertex.degrees ? false : undefined))) {
                        this.direction = this.vector.currentPosition.tangentAngle;
                    } else {
                        if (!( this.vector.currentPosition.equalTo(this.vector.vertex)
                            || this.vector.currentPosition.angleFromFocus === this.vector.angleOfVertex.degrees
                            || this.vector.currentPosition.distanceToFocus === this.vector.focalLength
                            || this.vector.currentPosition.axisLength === 0
                            || this.vector.currentPosition.distanceToAxis === 0
                            || this.vector.currentPosition.arcLength === 0
                            || this.vector.currentPosition.nearestAxisPoint.equalTo(this.vector.vertex)
                          )) throw new Error();
                        let direction = this.vector.pointAngleRange.transform(this.vector.currentPosition.tangentAngle + 180);
                        if (this.goingClockwise !== (direction < this.vector.angleOfVertex.degrees ? true : (direction > this.vector.angleOfVertex.degrees ? false : undefined)))
                            throw new Error();
                        this.direction = direction;
                    }
                } else throw new Error();
            } else throw new Error();

            return false;
        } else {
            this.vector.currentPosition = this.vector.newPosition;
            this.remainingFrameSeconds -= this.remainingDistance / velocity.speed;
            this.remainingDistance = 0;
            return true;
        }
    }

    tailPoint(distance = this.velocity.speed / 20) {
        if (this.currentPosition.distanceTo(this.oldPosition) <= distance) return this.oldPosition;
        else return Angle.pointFrom(this.currentPosition, this.direction.degrees - 180, distance);
    }

    updateDirection(angle = this.direction) {
        // do nothing
    }

    updateDestination(newPoint) {
        throw new Error();
    }

    inRange(point, oldPositionInclusive = false, newPositionInclusive = true) {
        let angleFromFocus = this.vector.focus.angleTo(point, this.vector.pointAngleRange);

        if (this.vector.oldPosition.angleFromFocus < this.vector.newPosition.angleFromFocus)  //angleFromFocus is increasing as it moves forward
            return (oldPositionInclusive ? (this.vector.oldPosition.angleFromFocus <= angleFromFocus) : (this.vector.oldPosition.angleFromFocus < angleFromFocus))
                && (newPositionInclusive ? (this.vector.newPosition.angleFromFocus >= angleFromFocus) : (this.vector.newPosition.angleFromFocus > angleFromFocus));

        else if (this.vector.oldPosition.angleFromFocus > this.vector.newPosition.angleFromFocus)  //angleFromFocus is decreasing as it moves forward
            return (oldPositionInclusive ? (this.vector.oldPosition.angleFromFocus >= angleFromFocus) : (this.vector.oldPosition.angleFromFocus > angleFromFocus))
                && (newPositionInclusive ? (this.vector.newPosition.angleFromFocus <= angleFromFocus) : (this.vector.newPosition.angleFromFocus < angleFromFocus));

        else throw new Error();
    }

    // like segment.inRange, vector.isForward does not determine if the point is actually on the vector, only if its coordinate corresponding with the vector's primary coordinate is in the 'forward' direction for the vector
    // it is upto the calling function to ensure the point is an accurate (and up-to-date) intersection point
    isForward(point) {
        let angleFromFocus = this.vector.focus.angleTo(point, this.vector.pointAngleRange);

        if (this.vector.currentPosition.angleFromFocus < this.vector.newPosition.angleFromFocus)  //angleFromFocus is increasing as it moves forward
            return (this.vector.currentPosition.angleFromFocus < angleFromFocus) && (this.vector.newPosition.angleFromFocus >= angleFromFocus);

        else if (this.vector.currentPosition.angleFromFocus > this.vector.newPosition.angleFromFocus)  //angleFromFocus is decreasing as it moves forward
            return (this.vector.currentPosition.angleFromFocus > angleFromFocus) && (this.vector.newPosition.angleFromFocus <= angleFromFocus);

        else throw new Error();
    }
}


//establish table of arc lengths to axis lengths & (half-chord) axis distances for extrapolations
//all of these assume a focal length of '1', so must be interpretted as a ratio of focal length
Parabola.axisLengths = [1];
Parabola.distancesToAxis = [2];
Parabola.arcLengths = [PARABOLIC_CONSTANT];

for (let i = 1; i <= 16; i++) {
    let axisLengths = [     [2 ** -i        ,  1.5 * 2 ** -i],
                            [0.75 * 2 ** i  ,  2 ** i       ]     ];

    let distancesToAxis = [];
    let arcLengths = [];
    for (let j = 0; j < 2; j++) {
        distancesToAxis[j] = [
            Math.sqrt((axisLengths[j][0] + 1) ** 2 - (axisLengths[j][0] - 1) ** 2),
            Math.sqrt((axisLengths[j][1] + 1) ** 2 - (axisLengths[j][1] - 1) ** 2)
        ];
        arcLengths[j] = [
            Parabola.arcLength(distancesToAxis[j][0], 1),
            Parabola.arcLength(distancesToAxis[j][1], 1)
        ];
    }

    Parabola.axisLengths.unshift(...axisLengths[0]);
    Parabola.axisLengths.push(...axisLengths[1]);

    Parabola.distancesToAxis.unshift(...distancesToAxis[0]);
    Parabola.distancesToAxis.push(...distancesToAxis[1]);

    Parabola.arcLengths.unshift(...arcLengths[0]);
    Parabola.arcLengths.push(...arcLengths[1]);    
}






function drawParabola(focusX = 250, focusY = 100, directrixSlope = 0, directrixIntercept = 0, invertSlopeXIntercept) {
    let parabola = new Parabola(new Position(focusX, focusY), new Line(directrixSlope, directrixIntercept, invertSlopeXIntercept))
    parabola.draw();
    let context = UI.board.context;
    context.fillStyle = WHITE.string;

    context.beginPath();
    context.arc(parabola.vertex.x, parabola.vertex.y, 3, 0, TWO_PI);
    context.fill();

    context.beginPath();
    context.arc(parabola.focus.x, parabola.focus.y, 3, 0, TWO_PI);
    context.fill();

    return parabola;
}

function drawParabolaAndLine(parabola, slope, intercept, invertSlopeXIntercept) {
    parabola.draw();
    parabola.focus.draw();
    parabola.vertex.draw();
    parabola.directrix.draw();

    let line = new Line(slope, intercept, invertSlopeXIntercept);
    line.draw();

    //console.log("NEW METHOD");
    let points1 = parabola.intersectionsWith(line, undefined, undefined, true, true, false, true, false);
    //console.log(points1);

    UI.board.context.strokeStyle = GREEN.toString();
    points1[0]?.draw();

    UI.board.context.strokeStyle = RED.toString();
    points1[1]?.draw();

    let omp1l = points1?.[0] ? Math.log2(line.distanceFrom(points1[0])) : undefined;
    let omp2l = points1?.[1] ? Math.log2(line.distanceFrom(points1[1])) : undefined;

    //console.log({ p1: points1[0]?.errorLog2, p2: points1[1]?.errorLog2, p1l: omp1l, p2l: omp2l });
}


function testExtrapolation() {
    let lowestLog2 = Math.log2(Parabola.arcLengths[1]);
    let highestLog2 = Math.log2(Parabola.arcLengths[Parabola.arcLengths.length - 1]);
    let angle = (1 - Math.random()) * 180 - 90;
    let slope = Angle.slopeFromDegrees(angle);
    let useInvSlope = slope > 1 || slope <= -1;
    if (useInvSlope) slope = Angle.invSlopeFromDegrees(angle);

    if (!(Number.isFinite(lowestLog2) && Number.isFinite(highestLog2) && Number.isFinite(angle) && Number.isFinite(slope))) throw new Error();

    let directrix = new Line(slope, (2 ** (Math.random() * 32 - 16)) * (Math.random() < 0.5 ? 1 : -1), useInvSlope);
    let intercept = new Position();
    directrix.setPrimarySecondaryCoordinates(intercept, 0, directrix.getPrimaryIntercept());

    let focalLength = 2 ** (Math.random() * 16 - 8);
    let position = (2 ** (Math.random() * 32 - 16));
    position = Angle.pointFrom(intercept, angle + Math.random() < 0.5 ? 0 : 180, position);
    position = Angle.pointFrom(position, angle + Math.random() < 0.5 ? 90 : -90, focalLength)

    let parabola = new Parabola(position, directrix)
    //console.log(parabola);

    let results = new Array();
    results.avgError = 0;
    results.maxError = 0;
    results.failedTests = 0;
    results.negativeErrs = new Array();
    let errors = new Array();

    let calcTime = performance.now();
    for (let i = 0; i < 2 ** 16; i++) {
        let rndArc = 2 ** (((1 - Math.random()) * 1.0625 - 0.03125) * (highestLog2 - lowestLog2) + lowestLog2);
        let result = parabola.axisCoordinatesFromArcLength(rndArc);
        let distanceToAxis = result.distanceToAxis;
        let axisLength = result.axisLength;
        let actualArc = parabola.arcLength(distanceToAxis);
        let error = (actualArc - rndArc) / actualArc * 100;
        if (Number.isFinite(error)) {
            if (Math.abs((result.err * -100 - error)) / Math.max(Math.abs(result.err * -100), Math.abs(error)) > 2 ** -4) throw new Error();
            results.avgError += Math.abs(error);
            if (Math.abs(error) > Math.abs(results.maxError)) {
                results.maxError = error;
                results.maxErrorIndex = i;
            }
            results.push({ randomArc: rndArc, actualArc: actualArc, error: error, distanceToAxis: distanceToAxis, axisLength: axisLength });
            if (error < 0) results.negativeErrs.push({ randomArc: rndArc, actualArc: actualArc, error: error, distanceToAxis: distanceToAxis, index: i, axisLength: axisLength });

            errors.push(Math.abs(error));
        } else {
            i--;
            results.failedTests++;
        }
    }
    results.calcTime = performance.now() - calcTime;
    results.avgError /= results.length;
    results.medianError = myMedian(errors);

    //console.log(results);
}

function findTrig(focusX = 250, focusY = 100, directrixSlope = 0, directrixIntercept = 0, invertSlopeXIntercept) {
    let result = new Array();

    //result.push(["Arc / Focal Length", "Vertex Distance / Arc", "Arc / Vertex Distance", "Arc / Focal Distance", "Arc / Directrix Center Distance","Focal Distance / Focal Length", "Axis / Focal Length", "Chord / Focal Length", "Axis / Chord", "Chord / Axis", "Axis / Distance", "Chord / Distance", "Focal Angle radians", "Focal Angle degrees", "Vertex Angle radians", "Vertex Angle degrees", "Directrix Angle radians", "Directrix Angle degrees"]);
    result.push("Axis / Distance");
    let parabola = new Parabola(new Position(focusX, focusY), new Line(directrixSlope, directrixIntercept, invertSlopeXIntercept));

    let lastPoint = { arcDistance: 0 };

    for (let i = parabola.focalLength + 2 ** -8; i <= 2000; i < parabola.focalLength + 1 ? i += 2 ** -8 : i++) {
        let point = parabola.pointFromFocusDistance(i, false);
        point.arcDistance = Parabola.arcLength(point.distanceFromAxis, parabola.focalLength);
        result.push((point.distance - parabola.focalLength) / point.distance);

        /*result.push([   point.arcDistance / parabola.focalLength,
                        Math.sqrt(point.distanceFromAxis ** 2 + (point.distance - parabola.focalLength) ** 2) / point.arcDistance,
                        point.arcDistance / Math.sqrt(point.distanceFromAxis ** 2 + (point.distance - parabola.focalLength) ** 2),
                        point.arcDistance / point.distance,
                        point.arcDistance / Math.sqrt(point.distanceFromAxis ** 2 + point.distance ** 2),
                        point.distance / parabola.focalLength,
                        (point.distance - parabola.focalLength) / parabola.focalLength,
                        point.distanceFromAxis / parabola.focalLength,
                        (point.distance - parabola.focalLength) / point.distanceFromAxis,
                        point.distanceFromAxis / (point.distance - parabola.focalLength),
                        (point.distance - parabola.focalLength) / point.distance,
                        point.distanceFromAxis / parabola.focalLength,
                        point.angleFromFocus_radians,
                        point.angleFromFocus_degrees,
                        parabola.vertex.radiansTo(point.pointFromAxis) - parabola.angleOfAxis.radians,
                        parabola.vertex.angleTo(point.pointFromAxis) - parabola.angleOfAxis.degrees,
                        parabola.directrixCenter.radiansTo(point.pointFromAxis) - parabola.angleOfAxis.radians,
                        parabola.directrixCenter.angleTo(point.pointFromAxis)  - parabola.angleOfAxis.degrees,
                    ]);*/

        /*//console.log("dst: " + (i < parabola.focusVertexDistance + 1 ? i.toFixed(7) : i) +
            " \tcrv: " + point.arcDistance.toFixed(4) +
            " \tAx/Ch: " + ((point.distance - parabola.focusVertexDistance) / point.distanceFromAxis).toFixed(4) +
            " \tCh/Ax: " + (point.distanceFromAxis / (point.distance - parabola.focusVertexDistance)).toFixed(4) +
            " \tHyp/crv: " + (parabola.vertex.distanceTo(point.pointFromFocusAngle) / point.arcDistance).toFixed(6));
            */
            /*" \t\u0394: " + (point.arcDistance - lastPoint.arcDistance).toFixed(4) +
            " \t1/\u0394: " + (1 / (point.arcDistance - lastPoint.arcDistance)).toFixed(4) +
            " \trtAx: " + (point.arcDistance / point.distance).toFixed(4) +
            " \t1/Ax: " + (point.distance / point.arcDistance).toFixed(4) +
            " \trtCh: " + (point.arcDistance / (point.distanceFromAxis * 2)).toFixed(4) +
            " \t1/Ch: " + ((point.distanceFromAxis * 2) / point.arcDistance).toFixed(4) +
            " \tAx/Ch: " + (point.distance / (point.distanceFromAxis * 2)).toFixed(4) +
            " \tCh/Ax: " + ((point.distanceFromAxis * 2) / point.distance).toFixed(4))*/

            /*
            " \ts: " + Math.sin(point.angleFromFocus_radians).toFixed(4) +
            " \tc: " + Math.cos(point.angleFromFocus_radians).toFixed(4) +
            " \ts: " + Math.sin(parabola.vertex.radiansTo(point.pointFromFocusAngle)).toFixed(4) +
            " \tc: " + Math.cos(parabola.vertex.radiansTo(point.pointFromFocusAngle)).toFixed(4) +
            " \ts: " + Math.sin(parabola.directrixCenter.radiansTo(point.pointFromFocusAngle)).toFixed(4) +
            " \tc: " + Math.cos(parabola.directrixCenter.radiansTo(point.pointFromFocusAngle)).toFixed(4));*/

        lastPoint = point;
    }

    delete result.toJSON;
    for (let prop in result) {
        delete result[prop].toJSON;
    }

    return result;
}

initializeLogger?.("geometry.curves ran");