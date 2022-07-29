"use strict"; document.currentScript.initTime = performance.now();

class Dimension {
    constructorArgs() { return ["width", "height"]; }

    constructor(width = 0, height = 0) {
        this.width = width;
        this.height = height;
    }
    area() { return this.width * this.height; }
    get width() { return this.wd; }
    get height() { return this.ht; }
    set width(value) { if (Number.isFinite(value) && value >= 0) this.wd = value; else throw new Error("Cannot set width " + value); }
    set height(value) { if (Number.isFinite(value) && value >= 0) this.ht = value; else throw new Error("Cannot set height " + value); }
}



class Rectangle extends ObjectWithPosition {
    constructorArgs() { return ["position", UNDEFINED, "dimension"]; }

    constructor(xOrPos = 0, y = 0, widthOrDim = 0, height = 0) {
        super(xOrPos, y);
        if (widthOrDim instanceof Dimension) this.dm = widthOrDim;
        else this.dm = new Dimension(widthOrDim, height);
    }

    set dimension(value) {
        if (value instanceof Dimension) {
            this.dm.width = value.width;
            this.dm.height = value.height;
        } else throw new Error("invalid assignment to dimension property of Rectangle class");
    }
    get dimension() { return this.dm; }
    get width() { return this.dm.width; }
    get height() { return this.dm.height; }
    set width(value) { this.dm.width = value; }
    set height(value) { this.dm.height = value; }

    area() { return this.dm.area(); }
    copy() { return new Rectangle(this.x, this.y, this.width, this.height); }

    updateFromRectangle(rectangle) { this.updateFromCoordinates(rectangle.x, rectangle.y, rectangle.width, rectangle.height); }
    updateFromCoordinates(x, y, width, height) { this.x = x; this.y = y; this.width = width; this.height = height; }

    points(copyThis_position) {
        return [
            copyThis_position ? this.position.copy() : this.position,
            new Position(this.x, this.y + this.height),
            new Position(this.x + this.width, this.y + this.height),
            new Position(this.x + this.width, this.y)

        ];
    }

    inside(x, y, edgeInclusive = true) {
        if (edgeInclusive) return (x >= this.x) && (x <= (this.x + this.width)) && (y >= this.y) && (y <= (this.y + this.height));
        else return (x > this.x) && (x < (this.x + this.width)) && (y > this.y) && (y < (this.y + this.height));
    }

    overlapsWith(rect, edgeInclusive = false) {
        if (this.x < rect.x) {
            let thisX2 = this.x + this.width;
            if (thisX2 < rect.x) return false;

            if (this.y < rect.y) {
                let thisY2 = this.y + this.height;
                if (thisY2 < rect.y) return false;

                if (edgeInclusive) {
                    if (thisX2 >= rect.x && thisY2 >= rect.y) return true;
                    else throw new Error();

                } else {
                    if (thisX2 > rect.x && thisY2 > rect.y) return true;
                    else if (thisX2 === rect.x || thisY2 === rect.y) return false;
                    else throw new Error();
                }


            } else if (this.y > rect.y) {
                let rectY2 = rect.y + rect.height;
                if (this.y > rectY2) return false;

                if (edgeInclusive) {
                    if (thisX2 >= rect.x && this.y <= rectY2) return true;
                    else throw new Error();

                } else {
                    if (thisX2 > rect.x && this.y < rectY2) return true;
                    else if (thisX2 === rect.x || this.y === rectY2) return false;
                    else throw new Error();
                }


            } else if (this.y === rect.y) {
                if (edgeInclusive) {
                    if (thisX2 >= rect.x && Number.isFinite(this.y)) return true;
                    else throw new Error();

                } else if (Number.isFinite(this.y)) {
                    if (thisX2 > rect.x) {
                        if (this.height > 0 && rect.height > 0) return true;
                        else return false;

                    } else if (thisX2 === rect.x) {
                        return false;

                    } else throw new Error();
                } else throw new Error();
            } else throw new Error();



        } else if (this.x > rect.x) {
            let rectX2 = rect.x + rect.width;
            if (this.x > rectX2) return false;

            if (this.y < rect.y) {
                let thisY2 = this.y + this.height;
                if (thisY2 < rect.y) return false;

                if (edgeInclusive) {
                    if (thisY2 >= rect.y && this.x <= rectX2) return true;
                    else throw new Error();

                } else {
                    if (thisY2 > rect.y && this.x < rectX2) return true;
                    else if (thisY2 === rect.y || this.x === rectX2) return false;
                    else throw new Error();
                }


            } else if (this.y > rect.y) {
                let rectY2 = rect.y + rect.height;
                if (this.y > rectY2) return false;

                if (edgeInclusive) {
                    if (this.x <= rectX2 && this.y <= rectY2) return true;
                    else throw new Error();

                } else {
                    if (this.x < rectX2 && this.y < rectY2) return true;
                    else if (this.x === rectX2 || this.y === rectY2) return false;
                    else throw new Error();
                }


            } else if (this.y === rect.y) {
                if (edgeInclusive) {
                    if (this.x <= rectX2 && Number.isFinite(this.y)) return true;
                    else throw new Error();

                } else if (Number.isFinite(this.y)) {
                    if (this.x < rectX2) {
                        if (this.height > 0 && rect.height > 0) return true;
                        else return false;

                    } else if (this.x === rectX2) {
                        return false;

                    } else throw new Error();
                } else throw new Error();
            } else throw new Error();



        } else if (this.x === rect.x) {
            if (this.y < rect.y) {
                let thisY2 = this.y + this.height;
                if (thisY2 < rect.y) return false;

                if (edgeInclusive) {
                    if (Number.isFinite(this.x) && thisY2 >= rect.y) return true;
                    else throw new Error();

                } else if (Number.isFinite(this.x)) {
                    if (thisY2 > rect.y) {
                        if (this.width > 0 && rect.width > 0) return true;
                        else return false;

                    } else if (thisY2 === rect.y) {
                        return false;

                    } else throw new Error();
                } else throw new Error();

            } else if (this.y > rect.y) {
                let rectY2 = rect.y + rect.height;
                if (this.y > rectY2) return false;

                if (edgeInclusive) {
                    if (Number.isFinite(this.x) && this.y <= rectY2) return true;
                    else throw new Error();

                } else if (Number.isFinite(this.x)) {
                    if (this.y < rectY2) {
                        if (this.width > 0 && rect.width > 0) return true;
                        else return false;

                    } else if (this.y === rectY2) {
                        return false

                    } else throw new Error();
                } else throw new Error();

            } else if (this.y === rect.y) {
                if (Number.isFinite(this.x) && Number.isFinite(this.y)) {
                    if (edgeInclusive) {
                        return true;

                    } else {
                        if (this.height > 0 && rect.height > 0 && this.width > 0 && rect.width > 0) return true;
                        else return false;

                    }
                } else throw new Error();
            } else throw new Error();
        } else throw new Error();

        /*
        if (this.x === rect.x || this.x + this.width === rect.x + rect.width) { //shared left/right edges
            if (edgeInclusive ? ((this.y >= rect.y && this.y <= rect.y + rect.height) ||
                (rect.y >= this.y && rect.y <= this.y + this.height))
                : ((this.y > rect.y && this.y < rect.y + rect.height) ||
                    (rect.y > this.y && rect.y < this.y + this.height) ||
                    (this.y === rect.y && this.height === rect.height))
            ) return true;

        }

        if (this.y === rect.y || this.y + this.height === rect.y + rect.height) { //shared top/bottom edges
            if (edgeInclusive ? ((this.x >= rect.x && this.x <= rect.x + rect.width) ||
                (rect.x >= this.x && rect.x <= this.x + this.width))
                : ((this.x > rect.x && this.x < rect.x + rect.width) ||
                    (rect.x > this.x && rect.x < this.x + this.width) ||
                    (this.x === rect.x && this.width === rect.width))
            ) return true;
        }

        //ruling out the scenario where rectangles form a 'cross' where neither's vertices are inside each other but they still overlap
        if (this.x < rect.x && this.x + this.width > rect.x) {
            if (rect.y < this.y && rect.y + rect.height > this.y) return true;
        } else if (rect.x < this.x && rect.x + rect.width > this.x) {
            if (this.y < rect.y && this.y + this.height > rect.y) return true;
        }

        return this.inside(rect.x, rect.y, edgeInclusive)
            || this.inside(rect.x + rect.width, rect.y, edgeInclusive)
            || this.inside(rect.x, rect.y + rect.height, edgeInclusive)
            || this.inside(rect.x + rect.width, rect.y + rect.height, edgeInclusive)
            || rect.inside(this.x, this.y, edgeInclusive)
            || rect.inside(this.x + this.width, this.y, edgeInclusive)
            || rect.inside(this.x, this.y + this.height, edgeInclusive)
            || rect.inside(this.x + this.width, this.y + this.height, edgeInclusive);
        */
    }
}

class Polygon extends ObjectWithRectangle {
    //constructorArgs() { throw new Error("polygon is an effectively abstract class.  Must be constructed by a subclass implementation"); }

    constructor(pointsOrSegmentsOrXOrPosOrRect, yOrDim, widthOrDim, height) {
        if (pointsOrSegmentsOrXOrPosOrRect instanceof Array) {
            Polygon.findRectangleBounds(pointsOrSegmentsOrXOrPosOrRect);
            super(pointsOrSegmentsOrXOrPosOrRect.x, pointsOrSegmentsOrXOrPosOrRect.y, pointsOrSegmentsOrXOrPosOrRect.width, pointsOrSegmentsOrXOrPosOrRect.height);
        } else {
            super(pointsOrSegmentsOrXOrPosOrRect, yOrDim, widthOrDim, height)
        }
    }

    static findRectangleBounds(pointsOrSegments) {
        //points = array of points or segments.  Can be a mix of points & segments
        //this will add 6 properties to the array (x, y, xMax, yMax, width, height) and then return it
        if (!(pointsOrSegments instanceof Array)) throw new Error();
        pointsOrSegments.x = Number.POSITIVE_INFINITY;
        pointsOrSegments.y = Number.POSITIVE_INFINITY;
        pointsOrSegments.xMax = Number.NEGATIVE_INFINITY;
        pointsOrSegments.yMax = Number.NEGATIVE_INFINITY;
        pointsOrSegments.forEach((ptOrSg) => {
            if (ptOrSg instanceof Position) {
                pointsOrSegments.x = Math.min(pointsOrSegments.x, ptOrSg.x);
                pointsOrSegments.y = Math.min(pointsOrSegments.y, ptOrSg.y);
                pointsOrSegments.xMax = Math.max(pointsOrSegments.xMax, ptOrSg.x);
                pointsOrSegments.yMax = Math.max(pointsOrSegments.yMax, ptOrSg.y);

            } else if (ptOrSg instanceof Segment) {
                pointsOrSegments.x = Math.min(pointsOrSegments.x, ptOrSg.point1.x, ptOrSg.point2.x);
                pointsOrSegments.y = Math.min(pointsOrSegments.y, ptOrSg.point1.y, ptOrSg.point2.y);
                pointsOrSegments.xMax = Math.max(pointsOrSegments.xMax, ptOrSg.point1.x, ptOrSg.point2.x);
                pointsOrSegments.yMax = Math.max(pointsOrSegments.yMax, ptOrSg.point1.y, ptOrSg.point2.y);

            } else throw new Error();
        });

        if (!(Number.isFinite(pointsOrSegments.x) && Number.isFinite(pointsOrSegments.y) && Number.isFinite(pointsOrSegments.xMax) && Number.isFinite(pointsOrSegments.yMax)))
            throw new Error();

        pointsOrSegments.width = pointsOrSegments.xMax - pointsOrSegments.x;
        pointsOrSegments.height = pointsOrSegments.yMax - pointsOrSegments.y;
        return pointsOrSegments;
    }

    area() { return Math.abs(Polygon.areaSigned(this.segments, this.rectangle.y)); }
    static areaSigned(segments, boundingRectY = 0) {
        let areasUnderSegments = new Array(segments.length);
        segments.forEach((segment, index) => {
            areasUnderSegments[index] = (segment.point2.x - segment.point1.x) * ((segment.point2.y + segment.point1.y) / 2 - boundingRectY);
        });
        return myOrderedSum(areasUnderSegments);
    }

    inside(point, edgeInclusive = false, testLine = undefined) {
        return this.rectangle.inside(point.x, point.y) && Polygon.inside(point, this.segments, edgeInclusive, testLine);
    }
    static inside(point, polygonSegments, edgeInclusive = false, testLine = undefined) {
        //'test line' is a horizontal line segment extending from the point to the furthest right x position + 1
        //testLine is optional, to prevent constructing the same segment multiple times over numerous iterations of this function,
        //the invoker can provide that testLine instead.  If it is not provided, this funciton will construct its own

        if (testLine === undefined) {
            testLine = new Segment(point, new Position(point.x + 1, point.y));
        } else if (testLine instanceof Segment) {
            if (testLine.point2 === point) throw new Error("testLine point2 must be a unique point object!")
            if (testLine.point2.x <= point.x) testLine.point2.x = point.x + 1; // does not require recalc since this would not change the slope or y-intercept of a horizontal line

            if (testLine.point1 !== point) {
                testLine.point1 = point;
                if (testLine.point2.y !== point.y) testLine.point2.y = point.y;
                testLine.recalc();
            } else if (testLine.point2.y !== point.y) {
                testLine.point2.y = point.y;
                testLine.recalc();
            }
        } else throw new Error();

        //start by copying segments array and testing then culling any with slope === 0 (same as test line)
        let segments = [...polygonSegments];
        for (let i = 0; i < segments.length; i++) {
            if (point === segments[i].point1 || point === segments[i].point2 || testLine.point2 === segments[i].point1 || testLine.point2 === segments[i].point2)
                throw new Error("testLine points must be unique point objects!"); //safety check

            if (segments[i].slope === 0) {
                if (segments[i].yIntercept === point.y && segments[i].inRange(point, true, true)) return edgeInclusive; //point is on this edge!
                segments.splice(i, 1);
                i--;
            }
        }

        let intersections = new Array(segments.length);
        intersections.count = 0;
        for (let i = 0; i < segments.length; i++) {
            testLine.point2.x = Math.max(testLine.point2.x, segments[i].point1.x + 1, segments[i].point2.x + 1);

            if (segments[i].containsPoint(point, true, true)) return edgeInclusive;
            intersections[i] = testLine.intersectionWith(segments[i], true, true, true, true);

            if (!intersections[i]) continue;

            if (point.equalTo(intersections[i])) return edgeInclusive;

            let vertex = false;
            let ascendingThis = undefined;
            let ascendingAdjacent = undefined;
            if (intersections[i].equalTo(segments[i].point1)) {
                vertex = true;
                //test whether the surface is ascending or descending from the vertex.  if the adjacent surface is doing the opposite, then this intersection is counted, otherwise not
                ascendingThis = segments[i].point1.y < segments[i].point2.y;
                ascendingAdjacent = segments[(i === 0 ? segments.length : i) - 1].point2.y < segments[(i === 0 ? segments.length : i) - 1].point1.y;
                if (ascendingThis === (segments[i].point1.y >= segments[i].point2.y) || ascendingAdjacent === (segments[(i === 0 ? segments.length : i) - 1].point2.y >= segments[(i === 0 ? segments.length : i) - 1].point1.y))
                    throw new Error("slope 0 has already been ruled out.  intersection at a vertex is returning inconsistant result!");
            }
            if (intersections[i].equalTo(segments[i].point2)) {
                if (vertex) throw new Error("unexpected result in 'polygon.inside' function.  intersection at a vertex is returning inconsistant result!");
                vertex = true;
                //test whether the surface is ascending or descending from the vertex.  if the adjacent surface is doing the opposite, then this intersection is counted, otherwise not
                ascendingThis = segments[i].point2.y < segments[i].point1.y;
                ascendingAdjacent = segments[i === segments.length - 1 ? 0 : i + 1].point1.y < segments[i === segments.length - 1 ? 0 : i + 1].point2.y;
                if (ascendingThis === (segments[i].point2.y >= segments[i].point1.y) || ascendingAdjacent === (segments[i === segments.length - 1 ? 0 : i + 1].point1.y >= segments[i === segments.length - 1 ? 0 : i + 1].point2.y))
                    throw new Error("slope 0 has already been ruled out.  intersection at a vertex is returning inconsistant result!");
            }

            if (vertex)
                intersections.count += xor(ascendingThis, ascendingAdjacent) ? 0.5 : 0; //only add half, because this will happen twice per vertex, with the adjacent surface as well
            else
                intersections.count++;
        }

        if (intersections.count % 2 === 1) return true;
        else if (intersections.count % 2 === 0) return false;
        else throw new Error("unexpected result in 'polygon.inside' function!")
    }

    overlapsWith(otherPolygon, edgeInclusive = false, testLine1 = undefined, testLine2 = undefined) {
        if (this.rectangle.overlapsWith(otherPolygon.rectangle ?? otherPolygon))
            return Polygon.overlaps(this.segments, otherPolygon.segments, edgeInclusive, testLine1, testLine2);
        else return false;
    }
    static overlaps(segments1, segments2, edgeInclusive = false, testLine1 = undefined, testLine2 = undefined) {
        //test lines are optional, for when iterating over many polygons, to prevent constructing the same testLine for 'polygon.inside' function multiple times
        //if not supplied, the 'polygon.inside' function will contsruct its own test line

        if (Polygon.inside(segments1[0].point1, segments2, edgeInclusive, testLine1) || Polygon.inside(segments2[0].point1, segments1, edgeInclusive, testLine2))
            return true;

        if (edgeInclusive) {
            for (let i = 0; i < segments1.length; i++) {
                for (let j = 0; j < segments2.length; j++) {
                    if (segments1[i].intersectionWith(segments2[j], true, true, true, true)) return true;
                }
            }
            return false;
        }

        let intersection = undefined;
        for (let i = 0; i < segments1.length; i++) {
            for (let j = 0; j < segments2.length; j++) {
                if (Line.equalSlope(segments1[i], segments2[j])) {
                    //if both surfaces have the same slope (they are parallel)
                    if (segments1[i].intersectionWith(segments2[j], false, false, false, false)) {
                        //overlapping parallel segments... need to determine if they are facing each other or the same direction, based on counter-clockwise block construction
                        let s1p1 = segments1[i].primaryCoordinate(segments1[i].point1);
                        let s1p2 = segments1[i].primaryCoordinate(segments1[i].point2);
                        let s2p1 = segments1[i].primaryCoordinate(segments2[j].point1);
                        let s2p2 = segments1[i].primaryCoordinate(segments2[j].point2);
                        if (s1p1 === s1p2 || s2p1 === s2p2 || !Number.isFinite(s1p1) || !Number.isFinite(s1p2) || !Number.isFinite(s2p1) || !Number.isFinite(s2p2))
                            throw new Error("surfaces cannot have the same value for both points in their primary coordinate, and the primary coordinates must be finite and defined!");

                        let ascending1 = s1p1 < s1p2;
                        let ascending2 = s2p1 < s2p2;
                        if (ascending1 === ascending2) return true;
                    }

                } else if (intersection = segments1[i].intersectionWith(segments2[j], true, true, true, true)) {
                    if (segments1[i].inRange(intersection, false, false)) {
                        if (segments2[j].inRange(intersection, false, false)) return true;

                        //intersection is a vertex of polygon2, but not polygon1
                        let s1Angle = segments1[i].point1.angleTo(segments1[i].point2);
                        let s2Angle;
                        if (intersection.equalTo(segments2[j].point1))
                            s2Angle = intersection.angleTo(segments2[j].point2);
                        else if (intersection.equalTo(segments2[j].point2))
                            s2Angle = intersection.angleTo(segments2[j].point1);
                        else throw new Error("unexpected result in 'Polygon.overlapsWith' function!");

                        if ((s1Angle - s2Angle) % 180 === 0) throw new Error("Inconsistent result in 'Polygon.overlapsWith' function, edgeInclusive false.  Equal slopes have already been ruled out!")
                        let range = new AngleRange(s1Angle, s1Angle + 180);
                        if (range.inRange(s2Angle)) return true;

                    } else if (segments2[j].inRange(intersection, false, false)) {
                        //intersection is a vertex of polygon1, but not polygon2
                        let s2Angle = segments2[j].point1.angleTo(segments2[j].point2);
                        let s1Angle;
                        if (intersection.equalTo(segments1[i].point1))
                            s1Angle = intersection.angleTo(segments1[i].point2);
                        else if (intersection.equalTo(segments1[i].point2))
                            s1Angle = intersection.angleTo(segments1[i].point1);
                        else throw new Error("unexpected result in 'Polygon.overlapsWith' function!");

                        if ((s1Angle - s2Angle) % 180 === 0) throw new Error("Inconsistent result in 'Polygon.overlapsWith' function, edgeInclusive false.  Equal slopes have already been ruled out!")
                        let range = new AngleRange(s2Angle, s2Angle + 180);
                        if (range.inRange(s1Angle)) return true;
                    }
                }
            }
        }
        return false;
    }
}

initializeLogger?.("geometry.polygons ran");
