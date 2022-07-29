"use strict"; document.currentScript.initTime = performance.now();

const SQRT_2 = Math.sqrt(2);
const PI = Math.PI; // 180 degrees, in radians
const TWO_PI = PI * 2; //360 degrees, in radians

const HALF_PI = PI / 2; // 90 degrees
const THREE_HALFS_PI = PI * 3 / 2; //270 degrees
const QTR_PI = PI / 4; //45 degrees
const THREE_QTRS_PI = PI * 3 / 4; // 135 degrees
const FIVE_QTRS_PI = PI * 5 / 4; //225 degrees
const SEVEN_QTRS_PI = PI * 7 / 4; //315 degrees

const DEGREES_MAX = 360 * 4
const DEGREES_MIN = 360 * -4

const UNDEFINED_POSITION = new Position();
const UNDEFINED_POINT = UNDEFINED_POSITION;
UNDEFINED_POSITION.x = undefined;
UNDEFINED_POSITION.y = undefined;

const X_AXIS = new Line(0, 0, false);
const Y_AXIS = new Line(0, 0, true);

Object.freeze(UNDEFINED_POSITION);
Object.freeze(X_AXIS);
Object.freeze(Y_AXIS);



//Angle constants are created without ranges, and are set to be immutable in the constructor
const ANGLE = {
    right: new Angle(0, false, true),
    rightPos: new Angle(360, false, true),
    rightNeg: new Angle(-360, false, true),

    up: new Angle(90, false, true),
    upNeg: new Angle(-270, false, true),

    left: new Angle(180, false, true),
    leftNeg: new Angle(-180, false, true),

    down: new Angle(-90, false, true),
    downPos: new Angle(270, false, true),

    upRight45: new Angle(45, false, true),
    upRight45Neg: new Angle(-315, false, true),

    upLeft45: new Angle(135, false, true),
    upLeft45Neg: new Angle(-225, false, true),

    downLeft45: new Angle(-135, false, true),
    downLeft45Pos: new Angle(225, false, true),

    downRight45: new Angle(-45, false, true),
    downRight45Pos: new Angle(315, false, true),

    upRight30: new Angle(30, false, true),
    upRight30Neg: new Angle(-330, false, true),
    upRight60: new Angle(60, false, true),
    upRight60Neg: new Angle(-300, false, true),

    upLeft60: new Angle(120, false, true),
    upLeft60Neg: new Angle(-240, false, true),
    upLeft30: new Angle(150, false, true),
    upLeft30Neg: new Angle(-210, false, true),

    downRight30: new Angle(-30, false, true),
    downRight30Pos: new Angle(330, false, true),
    downRight60: new Angle(-60, false, true),
    downRight60Pos: new Angle(300, false, true),

    downLeft60: new Angle(-120, false, true),
    downLeft60Pos: new Angle(240, false, true),
    downLeft30: new Angle(-150, false, true),
    downLeft30Pos: new Angle(210, false, true),

    upRight15: new Angle(15, false, true),
    upRight15Neg: new Angle(-345, false, true),
    upRight75: new Angle(75, false, true),
    upRight75Neg: new Angle(-285, false, true),

    upLeft75: new Angle(105, false, true),
    upLeft75Neg: new Angle(-255, false, true),
    upLeft15: new Angle(165, false, true),
    upLeft15Neg: new Angle(-195, false, true),

    downRight15: new Angle(-15, false, true),
    downRight15Pos: new Angle(345, false, true),
    downRight75: new Angle(-75, false, true),
    downRight75Pos: new Angle(285, false, true),

    downLeft75: new Angle(-105, false, true),
    downLeft75Pos: new Angle(255, false, true),
    downLeft15: new Angle(-165, false, true),
    downLeft15Pos: new Angle(195, false, true),
}

//synonyms for the same object:
ANGLE.leftPos = ANGLE.left;
ANGLE.upLeft45Pos = ANGLE.upLeft45;
ANGLE.downLeft45Neg = ANGLE.downLeft45;
ANGLE.upLeft30Pos = ANGLE.upLeft30;
ANGLE.downLeft30Neg = ANGLE.downLeft30;
ANGLE.upLeft60Pos = ANGLE.upLeft60;
ANGLE.downLeft60Neg = ANGLE.downLeft60;
ANGLE.upLeft15Pos = ANGLE.upLeft15;
ANGLE.downLeft15Neg = ANGLE.downLeft15;
ANGLE.upLeft75Pos = ANGLE.upLeft75;
ANGLE.downLeft75Neg = ANGLE.downLeft75;


const CARDINAL_DIRECTIONS = [ANGLE.right, ANGLE.up, ANGLE.left, ANGLE.down];
const CARDINAL_DIRECTIONS_FULL = [...CARDINAL_DIRECTIONS, ANGLE.rightPos, ANGLE.rightNeg, ANGLE.upNeg, ANGLE.leftNeg, ANGLE.downPos]
const ANGLES_45 = [ANGLE.upRight45, ANGLE.upLeft45, ANGLE.downLeft45, ANGLE.downRight45];
const ANGLES_45_FULL = [...ANGLES_45, ANGLE.upRight45Neg, ANGLE.upLeft45Neg, ANGLE.downLeft45Pos, ANGLE.downRight45Pos];
const ANGLES_30_60 = [ANGLE.upRight30, ANGLE.upRight60, ANGLE.upLeft60, ANGLE.upLeft30, ANGLE.downRight30, ANGLE.downRight60, ANGLE.downLeft60, ANGLE.downLeft30];
const ANGLES_30_60_FULL = [...ANGLES_30_60, ANGLE.upRight30Neg, ANGLE.upRight60Neg, ANGLE.upLeft60Neg, ANGLE.upLeft30Neg, ANGLE.downRight30Pos, ANGLE.downRight60Pos, ANGLE.downLeft60Pos, ANGLE.downLeft30Pos]
const ANGLES_15_75 = [ANGLE.upRight15, ANGLE.upRight75, ANGLE.upLeft75, ANGLE.upLeft15, ANGLE.downRight15, ANGLE.downRight75, ANGLE.downLeft75, ANGLE.downLeft15];
const ANGLES_15_75_FULL = [...ANGLES_15_75, ANGLE.upRight15Neg, ANGLE.upRight75Neg, ANGLE.upLeft75Neg, ANGLE.upLeft15Neg, ANGLE.downRight15Pos, ANGLE.downRight75Pos, ANGLE.downLeft75Pos, ANGLE.downLeft15Pos];

const ANGLE_CONSTANTS = [...CARDINAL_DIRECTIONS, ...ANGLES_45, ...ANGLES_30_60, ...ANGLES_15_75];
const ANGLE_CONSTANTS_FULL = [...CARDINAL_DIRECTIONS_FULL, ...ANGLES_45_FULL, ...ANGLES_30_60_FULL, ...ANGLES_15_75_FULL];



//full (360 degree) ranges
const ANGLE_RANGE_360 = {
    default: new AngleRange(ANGLE.leftNeg, ANGLE.leftPos, true),
    positive: new AngleRange(ANGLE.right, ANGLE.rightPos, true),
    negative: new AngleRange(ANGLE.rightNeg, ANGLE.rightPos, true),
    mostlyPositive: new AngleRange(ANGLE.down, ANGLE.downPos, true),
    mostlyNegative: new AngleRange(ANGLE.upNeg, ANGLE.up, true),
}

//half (180 degree) ranges, these are for testing whether an angle is inRange() and for doing bounce angle transformations
const ANGLE_RANGE_180 = {
    above: new AngleRange(ANGLE.right, ANGLE.leftPos, true),
    below: new AngleRange(ANGLE.leftNeg, ANGLE.right, true),
    left: new AngleRange(ANGLE.up, ANGLE.downPos, true),
    right: new AngleRange(ANGLE.down, ANGLE.up, true), //could also use (ANGLE.up, ANGLE.downPos) but NOT (ANGLE.upNeg, ANGLE.downPos) as that would be a span of 540 degrees !!!

    aboveRight45: new AngleRange(ANGLE.downRight45, ANGLE.upLeft45Pos, true),
    aboveLeft45: new AngleRange(ANGLE.upRight45, ANGLE.downLeft45Pos, true),
    belowLeft45: new AngleRange(ANGLE.upLeft45Neg, ANGLE.downRight45, true),
    belowRight45: new AngleRange(ANGLE.downLeft45Neg, ANGLE.upRight45, true),

    aboveRight30: new AngleRange(ANGLE.downRight30, ANGLE.upLeft30Pos, true),
    aboveLeft30: new AngleRange(ANGLE.upRight30, ANGLE.downLeft30Pos, true),
    belowLeft30: new AngleRange(ANGLE.upLeft30Neg, ANGLE.downRight30, true),
    belowRight30: new AngleRange(ANGLE.downLeft30Neg, ANGLE.upRight30, true),

    aboveRight60: new AngleRange(ANGLE.downRight60, ANGLE.upLeft60Pos, true),
    aboveLeft60: new AngleRange(ANGLE.upRight60, ANGLE.downLeft60Pos, true),
    belowLeft60: new AngleRange(ANGLE.upLeft60Neg, ANGLE.downRight60, true),
    belowRight60: new AngleRange(ANGLE.downLeft60Neg, ANGLE.upRight60, true),
}


/*quarter (90 degree) ranges //not sure if these are accurate
const angleRange90_aboveLeft90 = new AngleRange(ANGLE.up, ANGLE.leftPos, true);
const angleRange90_aboveRight90 = new AngleRange(ANGLE.right, ANGLE.up, true);
const angleRange90_belowRight90 = new AngleRange(ANGLE.down, ANGLE.right, true);
const angleRange90_belowLeft90 = new AngleRange(ANGLE.leftNeg, ANGLE.down, true);*/

assignFunctionsToConstantGroupsTHENfreeze([find, nameOf], [ANGLE, CARDINAL_DIRECTIONS, CARDINAL_DIRECTIONS_FULL, ANGLES_45, ANGLES_45_FULL, ANGLES_30_60, ANGLES_30_60_FULL, ANGLES_15_75, ANGLES_15_75_FULL, ANGLE_CONSTANTS, ANGLE_CONSTANTS_FULL]);
assignFunctionsToConstantGroupsTHENfreeze([findByMinMax, findByXOver, nameOf], [ANGLE_RANGE_180, ANGLE_RANGE_360]);

function assignFunctionsToConstantGroupsTHENfreeze(funcs, groups) {
    groups.forEach((group) => {
        funcs.forEach((func) => {
            group[func.name] = func.bind(group);
            Object.defineProperty(group, func.name, { enumerable: false });
        });
        Object.freeze(group);
    });
}


function nameOf(constant) {
    for (let name in this) {
        if (this[name] === constant) return name;
    }
}

function find(angle, strict = false, returnAngleObjectIfNotFound = true) {
    //returns first matching angle constant.  If none found, returns an Angle instance (either the submitted instance, or a new one if a number is submitted)
    //if returnAngleObjectIfNotFound = false, then undefined is returned in the event of no matching constant
    let degrees = angle;
    if (angle instanceof Angle) degrees = angle.degrees;
    else if (!Number.isFinite(angle)) throw new Error("must provide an angle object or finite number to 'ANGLE.find()' function");
    for (let id in ANGLE) {
        if (strict ? (ANGLE[id].degrees === degrees) : ((ANGLE[id].degrees - degrees) % 360 === 0)) return ANGLE[id];
    }
    if (returnAngleObjectIfNotFound) {
        if (angle instanceof Angle) return angle; else return new Angle(degrees, false);
    } else return undefined;
}


function findByMinMax(min, max, strict = false, returnAngleRangeObjectIfNotFound = true) {
    //returns first matching angle range constant.  If none found, returns a new AngleRange instance if returnAngleObjectIfNotFound = true, otherwise returns undefined

    if (min instanceof Angle) min = min.degrees;
    if (max instanceof Angle) max = max.degrees;
    let span = max - min;
    if (!(Number.isFinite(min) && Number.isFinite(max) && span >= 0)) throw new Error("must provide angle objects or finite numbers to ANGLE_RANGE_$$$.findByMinMax() function, and max must be greater than min");

    for (let id in this) {
        if (this[id].min.degrees === min && this[id].max.degrees === max) return this[id];
        else if (strict) continue;
        else if (   ((this[id].min.degrees - min) % 360 === 0)
                 && ((this[id].max.degrees - max) % 360 === 0)
                 && ((this[id].max.degrees - this[id].min.degrees) === span)
                )
            return this[id];
    }

    if (returnAngleRangeObjectIfNotFound) {
        return new AngleRange(min, max);
    } else return undefined;
}

function findByXOver(min, max, strict = false, returnAngleRangeObjectIfNotFound = true) {
    //returns first matching angle range constant.  If none found, returns a new AngleRange instance if returnAngleObjectIfNotFound = true, otherwise returns undefined

    if (min instanceof Angle) min = min.degrees;
    if (max instanceof Angle) max = max.degrees;
    let span = max - min;
    if (!(Number.isFinite(min) && Number.isFinite(max) && span >= 360)) throw new Error("must provide angle objects or finite numbers to ANGLE_RANGE_$$$.findByXOver() function, and max must be at least 360 greater than min");

    for (let id in this) {
        if (this[id].minXOver === min && this[id].maxXOver === max) return this[id];
        else if (strict) continue;
        else if (((this[id].minXOver - min) % 360 === 0)
            && ((this[id].maxXOver - max) % 360 === 0)
            && ((this[id].maxXOver - this[id].minXOver) === span)
        )
            return this[id];
    }

    if (returnAngleRangeObjectIfNotFound) {
        return new AngleRange(min, max);
    } else return undefined;
}

initializeLogger?.("geometry.constants ran");