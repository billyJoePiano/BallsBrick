"use strict"; document.currentScript.initTime = performance.now();


class Angle {
    constructorArgs() { return ["degrees", "range", "immutable"]; }
    skipEnumerationIfConstructed() { return ["rng", "dg"];}

    constructor(degrees = 0, range = undefined, immutable = false) { //undefined range means use default.  range = false means unbounded
        if (degrees instanceof Angle) degrees = degrees.degrees;
        this.dg = degrees;
        if (range !== undefined) {
            if (immutable === true && range !== false && range.immutable === false) range = new AngleRange(range.min, range.max, true);
            //must confirm that the AngleRange is also immutable, otherwise create a copy range that is immutable
            else this.range = range;
        }
        if (immutable === true) {
            this.immutable = true;
            Object.freeze(this);
        }
    }


    set radians(value) { this.degrees = value * 180 / PI; }
    get radians() { return this.degrees * PI / 180; }

    get degrees() { return this.dg; }
    set degrees(value) {
        if (value instanceof Angle) value = value.degrees;
        if (!Number.isFinite(value)) throw new Error();
        this.dg = this.range.transform?.(value) ?? value;
    }

    set range(value) {
        if (value === false) this.rng = false;
        else if (value === undefined || value === ANGLE_RANGE_360.default)
            delete this.rng;
        else if (!(value instanceof AngleRange)) throw new Error("invalid value submitted to angle.range setter");
        else this.rng = value;
        this.degrees = this.degrees; //if a new range was set, this updates the current degrees value to make it within range, otherwise it has no effect
    }
    get range() {
        if (this.rng === undefined) return ANGLE_RANGE_360.default;
        else return this.rng;
    }


    toNumber() { return this.degrees; }
    toString() { return Angle.stringFromDeg(this.degrees); }
    static stringFromDeg(degrees) { return "degrees: " + Math.round(degrees * 100) / 100 + "   radians: " + Math.round(Angle.degreesToRadians(degrees) * 1000) / 1000; }

    equalTo(angle, strict = false) {
        if (angle instanceof Angle) angle = angle.degrees;
        if (strict) return angle === this.degrees;
        else return (this.degrees - angle) % 360 === 0;
    }

    static radiansToDegrees(radians) { return radians / PI * 180; }
    static degreesToRadians(degrees) { return degrees / 180 * PI; }

    static pointFrom(originPoint, angle, distance, newPositionToUse = new Position()) {
        if (angle instanceof Angle) {
            return newPositionToUse.updateFromCoordinates(
                originPoint.x + distance * angle.cos(),
                originPoint.y - distance * angle.sin()
            )
        } else if (Number.isFinite(angle)) {
            return newPositionToUse.updateFromCoordinates(
                originPoint.x + distance * Math.cos(Angle.degreesToRadians(angle)),
                originPoint.y - distance * Math.sin(Angle.degreesToRadians(angle))
            )
        } else throw new Error();
    }

    static pointFromRadians(originPoint, radians, distance, newPositionToUse = new Position()) {
        if (Number.isFinite(radians)) {
            return newPositionToUse.updateFromCoordinates(
                originPoint.x + distance * Math.cos(radians),
                originPoint.y - distance * Math.sin(radians)
            )
        } else throw new Error();
    }

    inv(range = this.range) { return range.transform(this.degrees + 180); } //opposite angle, turns 180 degrees
    perpCCW(range = this.range) { return range.tranform(this.degrees + 90); } //perpendicular counter-clockwise, adding 90 degrees
    perpCW(range = this.range) { return range.transform(this.degrees - 90); } //perpendicular, clockwise, subtracting 90 degrees
    clockwiseFrom(angle, inclusiveThis = true, inclusive180 = false) { return Angle.clockwiseFrom(this.degrees, angle, inclusiveThis, inclusive180); }
    counterclockwiseFrom(angle, inclusiveThis = true, inclusive180 = false) { return Angle.counterclockwiseFrom(this.degrees, angle, inclusiveThis, inclusive180); }


    static clockwiseFrom(thisDegrees, otherAngle, inclusiveThis = true, inclusive180 = false) {
        if (!Number.isFinite(thisDegrees)) throw new Error();
        if (otherAngle instanceof Angle) otherAngle = otherAngle.degrees;
        if (!Number.isFinite(otherAngle)) throw new Error();
        //RE-WRITE TO ELMINATE LOOPING
        while (otherAngle - thisDegrees > 180) { otherAngle -= 360; }
        while (thisDegrees - otherAngle > 180) { otherAngle += 360; }
        if (thisDegrees > otherAngle) {
            if (inclusive180)
                return otherAngle + 180 ===thisDegrees
            else return false;
        } else if (thisDegrees < otherAngle) {
            if (inclusive180)
                return true;
            else return otherAngle - 180 !== thisDegrees;
        } else if (otherAngle === thisDegrees) return inclusiveThis;
    }
    static counterclockwiseFrom(thisDegrees, otherAngle, inclusiveThis = true, inclusive180 = false) {
        if (!Number.isFinite(thisDegrees)) throw new Error();
        if (otherAngle instanceof Angle) otherAngle = otherAngle.degrees;
        if (!Number.isFinite(otherAngle)) throw new Error();
        //RE-WRITE TO ELMINATE LOOPING
        while (otherAngle - thisDegrees > 180) { otherAngle -= 360; }
        while (thisDegrees - otherAngle > 180) { otherAngle += 360; }
        if (thisDegrees > otherAngle) {
            if (inclusive180)
                return true;
            else return otherAngle + 180 !== thisDegrees;
        } else if (thisDegrees < otherAngle) {
            if (inclusive180)
                return otherAngle - 180 === thisDegrees;
            else return false;
        } else if (otherAngle === thisDegrees) return inclusiveThis;
    }


    static angleFromSlope(slope, range) { return new Angle(Angle.degreesFromSlope(slope), range); }
    static angleFromInvSlope(invSlope, range) { return new Angle(degreesFromInvSlope(invSlope), range); }
    static degreesFromSlope(slope, range) {
        if (range) return range.transform(Angle.radiansToDegrees(Math.atan(-slope)));
        else return Angle.radiansToDegrees(Math.atan(-slope));
    }
    static degreesFromInvSlope(invSlope, range) {
        if (range) return range.transform(Angle.radiansToDegrees(Math.atan(-1 / invSlope)));
        else return Angle.radiansToDegrees(Math.atan(-1 / invSlope));
    }
    static radiansFromSlope(slope) { return Math.atan(-slope); }
    static radiansFromInvSlope(invSlope) { return Math.atan(-1 / invSlope); }

    static slopeFromDegrees(degrees) { //rounding errors due to radian conversion with PI require some special-case specifics
        if (degrees instanceof Angle) degrees = degrees.degrees;
        else if (!Number.isFinite(degrees)) throw new Error();

        degrees -= Math.floor((degrees + 180) / 360) * 360; //transform into -180 to 180 degrees (min inclusive, max exclusive) range
        if (degrees < -90) degrees += 180;                  //...then transform into -90 to 90 degrees range (inclusive both min and max)
        else if (degrees > 90) degrees -= 180;

        if (degrees === -90) return Number.POSITIVE_INFINITY;
        if (degrees === -45) return 1;
        if (degrees === 45) return -1;
        if (degrees === 90) return Number.NEGATIVE_INFINITY;
        return -Math.tan(Angle.degreesToRadians(degrees));
    }
    static invSlopeFromDegrees(degrees) { //rounding errors due to radian conversion with PI require some special-case specifics
        if (degrees instanceof Angle) degrees = degrees.degrees;
        else if (!Number.isFinite(degrees)) throw new Error();

        degrees -= Math.floor((degrees + 180) / 360) * 360; //transform into -180 to 180 degrees (min inclusive, max exclusive) range
        if (degrees === 0) return Number.POSITIVE_INFINITY;
        if (degrees === -180 || degrees === 180) return Number.NEGATIVE_INFINITY; //shouldn't need +180 but including just in case

        if (degrees < -90) degrees += 180; //...then transform into -90 to 90 degrees range (inclusive both min and max)
        else if (degrees > 90) degrees -= 180;

        if (degrees === -45) return 1;
        if (degrees === 45) return -1;

        //transform for invSlope, by reflecting over 45 or -45
        if (degrees > 0) degrees = 90 - degrees;
        else if (degrees < 0) degrees = -90 - degrees;
        return -Math.tan(Angle.degreesToRadians(degrees));
    }

    static tanDeg(degrees) { return Math.tan(Angle.degreesToRadians(degrees)); }
    static sinDeg(degrees) { return Math.sin(Angle.degreesToRadians(degrees)); }
    static cosDeg(degrees) { return Math.cos(Angle.degreesToRadians(degrees)); }
    /*static atanRad(tan, range) { return new Angle(Angle.radiansToDegrees(Math.atan(tan)), range); } these functions are wrong!!!!
    static asinRad(sin, range) { return new Angle(Angle.radiansToDegrees(Math.asin(sin)), range); }
    static acosRad(cos, range) { return new Angle(Angle.radiansToDegrees(Math.acos(cos)), range); }
    static atanDeg(tan, range) { return atanRad(Angle.degreesToRadians(tan), range); }
    static asinDeg(sin, range) { return asinRad(Angle.degreesToRadians(sin), range); }
    static acosDeg(cos, range) { return acosRad(Angle.degreesToRadians(cos), range); }*/
    sin() { return Math.sin(this.radians); }
    cos() { return Math.cos(this.radians); }
    tan() { return Math.tan(this.radians); }
    slope() { return Angle.slopeFromDegrees(this.degrees); }
    invSlope() { return Angle.invSlopeFromDegrees(this.degrees); }

    variableRangeThisCenter(halfSpan = 180) { return new AngleRange(this.degrees - halfSpan, this.degrees + halfSpan); } //creates a new range, in which this angle is the center
    variableRangeThisXOver(thisAsMin = this.degrees < 0) {
        if (thisAsMin) return new AngleRange(this.degrees, this.degrees + 360);
        else return new AngleRange(this.degrees - 360, this.degrees);
    }

    static acuteDistance(angle1, angle2) {
        if (angle1 instanceof Angle) angle1 = angle1.degrees;
        if (angle2 instanceof Angle) angle2 = angle2.degrees;
        if (angle1 - angle2 > 180) {
            //RE-WRITE TO ELMINATE LOOPING
            do {
                angle2 += 360;
                if (!(angle1 <= DEGREES_MAX && angle2 <= DEGREES_MAX)) throw new Error("Error in Angle.acuteMidpoint function.  Stuck in a loop, and cannot transform the two angles to greater than 180 degrees of each other");
            } while (angle1 - angle2 > 180)
        } else if (angle2 - angle1 > 180) {
            //RE-WRITE TO ELMINATE LOOPING
            do {
                angle1 += 360;
                if (!(angle1 <= DEGREES_MAX && angle2 <= DEGREES_MAX)) throw new Error("Error in Angle.acuteMidpoint function.  Stuck in a loop, and cannot transform the two angles to greater than 180 degrees of each other");
            } while (angle2 - angle1 > 180)
        }
        return Math.abs(angle1 - angle2);
    }

    static acuteMidpoint(angle1, angle2, angleRange = ANGLE_RANGE_360.default) {
        //RE-WRITE TO ELMINATE LOOPING
        //when 180 degrees apart, midpoints are counterclockwise of the smaller angle, clockwise of the larger one
        if (angle1 instanceof Angle) angle1 = angle1.degrees;
        if (angle2 instanceof Angle) angle2 = angle2.degrees;
        if (angle1 - angle2 > 180) {
            do {
                angle2 += 360;
                if (!(angle1 <= DEGREES_MAX && angle2 <= DEGREES_MAX)) throw new Error("Error in Angle.acuteMidpoint function.  Stuck in a loop, and cannot transform the two angles to greater than 180 degrees of each other");
            } while (angle1 - angle2 > 180)
        } else if (angle2 - angle1 > 180) {
            do {
                angle1 += 360;
                if (!(angle1 <= DEGREES_MAX && angle2 <= DEGREES_MAX)) throw new Error("Error in Angle.acuteMidpoint function.  Stuck in a loop, and cannot transform the two angles to greater than 180 degrees of each other");
            } while (angle2 - angle1 > 180)
        }
        if (Math.abs(angle1 - angle2) > 180) throw new Error("Error in Angle.acuteMidpoint function.  Cannot transform the two angles to within 180 degrees of each other");
        if (angleRange) return angleRange.transform((angle1 + angle2) / 2); else return (angle1 + angle2) / 2;
    }

    static obtuseMidpoint(angle1, angle2, angleRange = ANGLE_RANGE_360.default) {
        //RE-WRITE TO ELMINATE LOOPING
        //when 180 degrees apart, midpoints are clockwise of the smaller angle, counterclockwise of the larger one (opposite of acuteMidPoint function)
        if (angle1 instanceof Angle) angle1 = angle1.degrees;
        if (angle2 instanceof Angle) angle2 = angle2.degrees;
        while (Math.abs(angle1 - angle2) < 180) {
            if (angle1 > angle2) {
                angle2 += 360
            } else if (angle2 > angle1) {
                angle1 += 360
            }
            if (!(angle1 <= DEGREES_MAX && angle2 <= DEGREES_MAX)) throw new Error("Error in Angle.obtuseMidpoint function.  Stuck in a loop, and cannot transform the two angles to greater than 180 degrees of each other");
        }
        if (angle1 - angle2 === 180) angle2 += 360;
        else if (angle2 - angle1 === 180) angle1 += 360;
        if (angleRange) return angleRange.transform((angle1 + angle2) / 2); else return (angle1 + angle2) / 2;
    }
}



class AngleRange {
    constructorArgs() { return ["min", "max", "immutable"]; }

    constructor(min = -180, max = 180, immutable = false) {
        if (this instanceof CompoundAngleRange) {
            this.setXOvers(min, max);
            return;
        }
        let sameAngleObj = false;
        if (min instanceof Angle) {
            if (immutable === true && !min.immutable) this.mn = new Angle(min, false, true);
            else if ((sameAngleObj = (min === max)) && !immutable) this.mn = new Angle(min, false);
            else this.mn = min;
            min = min.degrees;
        } else if (Number.isFinite(min))
            this.mn = new Angle(min, false, immutable);
        else throw new Error("invalid input to Angle Range constructor");

        if (max instanceof Angle) {
            if (immutable === true && !max.immutable) this.mx = new Angle(max, false, true);
            else if (sameAngleObj && !immutable) this.mx = new Angle(max, false);
            else this.mx = max;
            max = max.degrees;
        } else if (Number.isFinite(max))
            this.mx = new Angle(max, false, immutable);
        else throw new Error("invalid input to Angle Range constructor");

        if (max - min < 360) this.setXOvers();

        if (immutable === true) {
            this.immutable = true;
            Object.freeze(this);
        }
    }

    setXOvers(min = (this.max.degrees + this.min.degrees) / 2 - 180, max = (this.max.degrees + this.min.degrees) / 2 + 180, transformCurrentMinMax = false) {
        //replaces the getter functions with values IF the angle span is less than 360 degrees
        if (max - min < 360) throw new Error("Angle range crossovers must be at least 360 degrees apart, and max must be greater than min");
        //if (max < this.max.degrees || min > this.min.degrees) throw new Error("Angle range crossovers must be equal to or outside of the angle range min/max");
        Object.defineProperties(this, {
            minXOver: { writable: true, value: min },
            maxXOver: { writable: true, value: max }
        });

        if (transformCurrentMinMax) {
            this.min.degrees = this.transform(this.min.degrees);
            this.max.degrees = this.transform(this.max.degrees);
            if (this.min.degrees > this.max.degrees) throw new Error("Changing xOvers created an invalid min/max pair (min is greater than max!)");
        }

        //??write code to replace values with getter/setter functions if span is changed back to greater than 360 degrees??
    }


    set min(value) { //can be set using a number or angle object, but always returns its own angle object
        this.mn.degrees = this.transform(value, false);
    }
    get min() { return this.mn; }

    set max(value) { //can be set using a number or angle object, but always returns its own angle object
        this.mx.degrees = this.transform(value, false);
    }
    get max() { return this.mx; }

    get minXOver() { if (this.mx.degrees - this.mn.degrees >= 360) return this.mn.degrees; else throw new Error(); }
    get maxXOver() { if (this.mx.degrees - this.mn.degrees >= 360) return this.mx.degrees; else throw new Error(); }
    set minXOver(value) { throw new Error("Must set AngleRangel XOvers using setXOvers function to ensure they are at least 360 degreees apart"); }
    set maxXOver(value) { throw new Error("Must set AngleRangel XOvers using setXOvers function to ensure they are at least 360 degreees apart"); }


    span(asAngleObject = false) {
        if (asAngleObject) return new Angle(this.max.degrees - this.min.degrees, false);
        else return this.max.degrees - this.min.degrees;
    }
    toString() { return "min: " + this.min + "  max: " + this.max; }
    xOversToString() { return "minXOver: " + Angle.stringFromDeg(this.minXOver) + "      \nmaxXOver: " + Angle.stringFromDeg(this.maxXOver); }

    copy() { //need to deal with Xovers (determine if they are set by value or use the default getter function)
        return new AngleRange(this.min, this.max);
    }

    deepCopy() {
        return new AngleRange(this.min.degrees, this.max.degrees);
    }

    transform(angle, returnNewAngle = false) { //when true, creates a new Angle object, otherwise returns a number
        if (angle instanceof Angle) angle = angle.degrees;
        else if (!Number.isFinite(angle)) throw new Error("must submit a finite number or Angle object to AngleRange.transform");

        angle += Math.min(0, Math.floor((this.maxXOver - angle) / 360)) * 360
               + Math.max(0, Math.ceil ((this.minXOver - angle) / 360)) * 360;

        if (returnNewAngle === true) return new Angle(angle, this);
        else return angle;
    }

    bind(angle, strict = false, returnNewAngle = false) {
        if (strict === false) var angle = this.transform(angle, false);
        else if (angle instanceof Angle) angle = angle.degrees;

        angle = Math.max(Math.min(angle, this.max.degrees), this.min.degrees);

        if (returnNewAngle === true) return new Angle(angle, this);
        else return angle;
    }

    inRange(angle, strict = false, minInclusive = true, maxInclusive = true) {
        //this function is normally used for ranges that span less than 360 degrees
        if (angle instanceof Angle) angle = angle.degrees;
        if (strict === false) angle = this.transform(angle);
        if (minInclusive) {
            if (maxInclusive) return angle >= this.min.degrees && angle <= this.max.degrees;
            else return angle >= this.min.degrees && angle < this.max.degrees;
        } else {
            if (maxInclusive) return angle > this.min.degrees && angle <= this.max.degrees;
            else return angle > this.min.degrees && angle < this.max.degrees;
        }
        //should always return true when strict is false AND the span of this AngleRange is >= 360 degrees
    }

    static overlappingRange(range1, range2) {
        if (range1 === range2) return range1;
        if (range1 === undefined || range2 === undefined) return undefined;
        if (range1 instanceof CompoundAngleRange) {
            if (range2 instanceof CompoundAngleRange) return CompoundAngleRange.overlappinRange_bothCompound(range1.copy(), range2.copy());
            else return CompoundAngleRange.overlappingRange_oneCompound(range1, range2.copy());
        } else if (range2 instanceof CompoundAngleRange) return CompoundAngleRange.overlappingRange_oneCompound(range2, range1.copy()); //should the continous range be a deep copy???

        if (range1.max.degrees === range2.max.degrees && range1.min.degrees === range2.min.degrees && range1.minXOver === range2.minXOver && range1.maxXOver === range2.maxXOver) return range1;
        let min = undefined;
        let max = undefined;
        if (range1.span() < 360 && range2.span() < 360) {
            let min1 = range2.inRange(range1.min, false, true, false);
            let min2 = range1.inRange(range2.min, false, true, false);
            let max1 = range2.inRange(range1.max, false, false, true);
            let max2 = range1.inRange(range2.max, false, false, true);

            if (min1) {
                if (min2) {
                    if (max1) {
                        if (max2) {
                            if (range1.transform(range2.min.degrees) === range1.min.degrees || range2.transform(range1.min.degrees) === range2.min.degrees || range1.transform(range2.max.degrees) === range1.max.degrees || range2.transform(range1.max.degrees) == range2.max.degrees) {
                                //make sure the angles are not simply transformations of one another
                                if (range1.transform(range2.min.degrees) === range1.min.degrees && range2.transform(range1.min.degrees) === range2.min.degrees && range1.transform(range2.max.degrees) === range1.max.degrees && range2.transform(range1.max.degrees) == range2.max.degrees) {
                                    //safety check.  if one of the conditions is true, all of them should be at this point
                                    //min = range1.min.degrees; // not neccessary, done below
                                    max = range1.max.degrees;
                                } else throw new Error("unexpected result in AngleRange.overlappingRange function");
                            } else return CompoundAngleRange.overlappingRange_bothContinous(range1, range2);
                        }
                    }
                }
                min = range1.min.degrees;
            } else if (min2) {
                min = range2.min.degrees;
            }

            if (max1) {
                if (min === undefined) throw new Error("unexpected result in AngleRange.overlappingRange function");
                max = range1.max.degrees;
            } else if (max2) {
                if (min === undefined) throw new Error("unexpected result in AngleRange.overlappingRange function");
                max = range2.max.degrees;
            }

            if (!(Number.isFinite(min) && Number.isFinite(max))) return undefined;


        } else if (range1.span() < 360 && range2.span() >= 360) {
            return range1;
        } else if (range2.span() < 360 && range1.span() >= 360) {
            return range2;
        } else if (range1.span() >= 360 && range2.span() >= 360) {
            min = (range1.min.degrees + range2.min.degrees) / 2;
            max = (range1.max.degrees + range2.max.degrees) / 2;
        }

        //RE-WRITE TO ELMINATE LOOPING
        while (max < min) {
            if (min > 180) min -= 360;
            else max += 360;
        }
        while (max - min > 360) {
            if (min < -180) min += 360;
            else max -= 360;
        }

        return new AngleRange(min, max); //xOvers are set by default
    }

    static sumRange(range1, range2) { //NOTE: should write code to make compound angle ranges when nececssary
        if (range1 === range2) return range1;
        //if (range1 === undefined || range2 === undefined) return undefined; //should this actually just return the defined range, since it is a sum?
        if (range1.max.degrees === range2.max.degrees && range1.min.degrees === range2.min.degrees && range1.minXOver === range2.minXOver && range1.maxXOver === range2.maxXOver) return range1;
        let min1 = range2.inRange(range1.min);
        let min2 = range1.inRange(range2.min);
        let max1 = range2.inRange(range1.max);
        let max2 = range1.inRange(range2.max);
        let min = undefined;
        let max = undefined;
        if (min1 && max2) {
            if (min2 && max1) { //the ranges together are a full 360!
                min = Angle.acuteMidpoint(range1.minXOver, range2.minXOver);
                max = Angle.acuteMidpoint(range1.maxXOver, range2.maxXOver);
                //RE-WRITE TO ELMINATE LOOPING
                while (!(max - min >= 360)) {
                    if (max < 0) max += 360
                    else if (min > 0 || -max > min) min -= 360
                    else max += 360;
                }
                return new AngleRange(min, max);
            }
            //else range1 is 'above' (counterclockwise of) range 2
            min = range2.min.degrees;
            max = range1.max.degrees;
        } else if (min2 && max1) {
            //range2 is 'above' (counterclockwise of) range1
            min = range1.min.degrees;
            max = range2.max.degrees;
        } else if (min2 && max2) { //range1 fully encompasses range2
            min = range1.min;
            max = range1.max;
        } else if (min1 && max1) { //range2 fully encompasses range1
            min = range2.min;
            max = range2.max;
        } else return new CompoundAngleRange([range1.copy(), range2.copy()]);

        //RE-WRITE TO ELMINATE LOOPING

        while (!(max - min < 720)) {
            if (min < -360) min += 360;
            else if (max > 360) max -= 360;
            else throw new Error("")
        }

        while (!(min < max)) {
            if (min > 0) min -= 360
            else max += 360;
        }

        return new AngleRange(min, max); //xOvers set by default
    }
}


class CompoundAngleRange extends AngleRange {
    constructorArgs() { return ["ranges"]; }

    constructor(ranges) {
        //sorts the ranges by min value, and puts the 'min' with the largest gap below it as the bottom of the range

        ranges.sort((range1, range2) => { return range1.min.degrees - range2.min.degrees; });

        let largestGap = 0;
        let indexLargestGap = undefined;
        let i, j, gap, tempGap;
        for (i = 0; i < ranges.length; i++) {
            gap = Number.POSITIVE_INFINITY;
            for (j = 0; j < i; j++) { //testing the pairs *below* this pair, for the gap between their max and this min
                tempGap = ranges[i].min.degrees - ranges[j].max.degrees;
                //RE-WRITE TO ELMINATE LOOPING
                while (tempGap > 360) { tempGap -= 360; }
                if (tempGap < gap) gap = tempGap;
            }
            for (j++; j < ranges.length; j++) { //testing the pairs *above* this pair, for the gap between their max and this min
                tempGap = ranges[j].max.degrees - (Math.floor((ranges[j].min.degrees - ranges[i].min.degrees) / 360) + 1) * 360;
                if (tempGap < gap) gap = tempGap;
            }
            if (gap > largestGap) {
                largestGap = gap;
                indexLargestGap = i;
            }
        }
        if (indexLargestGap === undefined || largestGap <= 0) throw new Error("this compoundAngleRange does not have a gap!")
        //re-arrange the array to the new order
        ranges.unshift(...ranges.splice(indexLargestGap, ranges.length - indexLargestGap));

        //transform into the new xOver range
        let minXOver = ranges[0].min.degrees - largestGap / 2;
        //RE-WRITE TO ELMINATE LOOPING
        while (minXOver > 0) { minXOver -= 360; }
        let maxXOver = minXOver + 360
        for (let i = 0; i < ranges.length; i++) {
            ranges[i].setXOvers(minXOver, maxXOver, true);
        }


        //safety checks.  these can probably be disabled once the class is proven
        let floor = Number.POSITIVE_INFINITY;
        let ceil = Number.NEGATIVE_INFINITY;
        for (let i = 0; i < ranges.length; i++) {
            if (!(ranges[i].min.degrees <= ranges[i].max.degrees && ranges[i].max.degrees - ranges[i].min.degrees < 360)) throw new Error("invalid min/max pair in Compound AngleRange");
            if (ranges[i].min.degrees < floor) floor = ranges[i].min.degrees;
            if (ranges[i].max.degrees > ceil) ceil = ranges[i].max.degrees;
        }
        if (!(minXOver <= floor && maxXOver >= ceil)) throw new Error("XOver values in CompoundAngleRange constructor are invalid.");


        super(minXOver, maxXOver);
        this.ranges = ranges;
        //console.log("CompoundAngleRange constructed");
        //console.log(this);
    }

    get min() { throw new Error("Compound ranges do not have a 'min' property"); }
    get max() { throw new Error("Compound ranges do not have a 'max' property"); }
    get mn() { throw new Error("Compound ranges do not have a 'mn' property"); }
    get mx() { throw new Error("Compound ranges do not have a 'mx' property"); }

    copy() { //shallow copy (doesn't copy the continous AngleRanges, only the array of them)
        return new CompoundAngleRange([...this.ranges]);
    }

    deepCopy(deepCopyAngleRanges = true) {
        let ranges = new Array(this.ranges.length);
        for (let i = 0; i < ranges.length; i++) {
            ranges[i] = deepCopyAngleRanges ? this.ranges[i].deepCopy() : this.ranges[i].copy();
        }
        return new CompoundAngleRange(ranges);
    }


    inRange(angle, strict = false, minsInclusive = true, maxsInclusive) {
        if (strict === false) angle = this.transform(angle);
        else if (angle instanceof Angle) angle = angle.degrees;
        if (minsInclusive) {
            if (maxsInclusive) {
                for (let i = 0; i < this.ranges.length; i++) {
                    if (angle >= this.ranges[i].min.degrees && angle <= this.ranges[i].max.degrees) return true;
                }
            } else {
                for (let i = 0; i < this.ranges.length; i++) {
                    if (angle >= this.ranges[i].min.degrees && angle < this.ranges[i].max.degrees) return true;
                }
            }
        } else {
            if (maxsInclusive) {
                for (let i = 0; i < this.ranges.length; i++) {
                    if (angle > this.ranges[i].min.degrees && angle <= this.ranges[i].max.degrees) return true;
                }
            } else {
                for (let i = 0; i < this.ranges.length; i++) {
                    if (angle > this.ranges[i].min.degrees && angle < this.ranges[i].max.degrees) return true;
                }
            }
        }
        return false;
    }

    bind(angle, strict = false, returnNewAngle = false) {
        //assumes that the angleRanges were organized correctly by the organizeCompoundAngleRange function before construction
        // AKA they are in ascending order
        if (strict === false) angle = this.transform(angle);
        else if (angle instanceof Angle) angle = angle.degrees;

        for (let i = 0; i < this.range.length; i++) {
            if (angle <= this.ranges[i].max.degrees) {
                if (angle >= this.ranges[i].min.degrees) break;
                if (i === 0) {
                    angle = this.ranges[i].min.degrees;
                    break;
                } else if (i === this.ranges.length - 1) {
                    angle = this.ranges[i].max.degrees;
                    break;
                }
                let distBelow = angle - this.ranges[i - 1].max.degrees;
                let distAbove = this.ranges[i].min.degrees - angle;
                if (distBelow < distAbove) { i--; angle = this.ranges[i].max.degrees; }
                else if (distBelow > distAbove) { angle = this.ranges[i].min.degrees; }
                else if (angle - this.minXOver < this.maxXOver - angle) { i--; angle = this.ranges[i].max.degrees; }
                else { angle = this.ranges[i].min.degrees; }
                break;
            }
        }
        if (returnNewAngle) return new Angle(angle, this.ranges[i]);
        else return angle;
    }

    static overlappingRange_bothContinous(range1, range2) { //assumes that AngleRange.overlappingRange has already determined this needs to be a compound range
        let min1 = range1.min.degrees;
        let max1 = range2.max.degrees;
        //RE-WRITE TO ELMINATE LOOPING
        while (max1 < min1) {
            if (min1 > 360) min1 -= 360;
            else if (max1 < 0) max1 += 360;
            else min1 -= 360;
        }
        while (max1 - min1 > 360) {
            if (Math.abs(min1) > Math.abs(max1)) min1 += 360;
            else max1 -= 360;
        }

        let min2 = range2.min.degrees;
        let max2 = range1.max.degrees;
        while (max2 < min2) {
            if (min2 > 360) min2 -= 360;
            else if (max2 < 0) max2 += 360;
            else min2 -= 360;
        }
        while (max2 - min2 > 360) {
            if (Math.abs(min2) > Math.abs(max2)) min2 += 360;
            else max2 -= 360;
        }

        let newRange1 = new AngleRange(min1, max1);
        let newRange2 = new AngleRange(min2, max2);
        return new CompoundAngleRange([newRange1, newRange2]);
    }

    static overlappingRange_oneCompound(compound, continous, returnAngleRange = true) { //returns array of angle ranges otherwise... set to false when invoked from overlappingRange_bothCompound
        let ranges = new Array();
        for (let i = 0; i < compound.ranges.length; i++) {
            let temp = AngleRange.overlappingRange(compound.ranges[i], continous);
            if (temp) {
                if (temp instanceof CompoundAngleRange) {
                    for (let j = 0; j < temp.ranges.length; j++) {
                        if (temp[j]) ranges.push(temp[j]);
                    }
                } else if (temp instanceof AngleRange) ranges.push(temp);
                else throw new Error("unexpected result from Angle.overlappingRange, when called from CompoundAngleRange.overlappingRange_oneCompound");
            }
        }
        if (returnAngleRange) {
            if (ranges.length > 1) return new CompoundAngleRange(ranges);
            if (ranges.length === 1) return ranges[0];
            else return undefined;
        } else return ranges;
    }
    static overlappinRange_bothCompound(range1, range2) {
        let ranges = new Array();
        for (let i = 0; i < range1.ranges.length; i++) {
            ranges.push(...(CompoundAngleRange.overlappingRange_oneCompound(range2, range1.ranges[i], false)));
        }
        if (ranges.length > 1) return new CompoundAngleRange(ranges);
        if (ranges.length === 1) return ranges[0];
        else return undefined;
    }
}

initializeLogger?.("geometry.angles ran");