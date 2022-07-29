"use strict"; document.currentScript.initTime = performance.now();

function defineProperties(object, properties) {
    let className = Object.getPrototypeOf(object);
    if (className && "constructor" in className) {
        className = className.constructor;
        if (className && typeof className.name === "string") {
            className = className.name;
        }
    }

    for (let prop in properties) {
        properties[prop].enumerable = properties[prop].enumerable ?? true;
        properties[prop].configurable = properties[prop].configurable ?? false;
        if ("value" in properties[prop]) properties[prop].writable = properties[prop].writable ?? false;
        if ("get" in properties[prop]) properties[prop].set = properties[prop].set ?? readOnly(prop);
    }

    Object.defineProperties(object, properties);

    function readOnly(prop) {
        return function readOnlySetter(value) {
            throw new Error("Read-only property: " + prop + " (in class " + className + ")");
        }
    }
}


class ObjectWithPosition { //generic wrapper class for Position
    constructor(xOrPosition, y) {
        if (xOrPosition instanceof Position) this.psn = xOrPosition;
        else if (Number.isFinite(xOrPosition) && Number.isFinite(y)) this.psn = new Position(xOrPosition, y);
        else this.psn = new Position();
    }
    get position() { return this.psn; }
    set position(value) {
        if (value instanceof Position) {
            this.psn.updateFromPosition(value);
        }
        else throw new Error("invalid assignment to position property of ObjectWithPosition class!");
    }
    set x(value) { this.psn.x = value; }
    get x() { return this.psn.x; }
    set y(value) { this.psn.y = value; }
    get y() { return this.psn.y; }
}

class ObjectWithRectangle { //generic wrapper class for Rectangle (Rectangle class itself extends ObjectWithPosition, and wraps both Dimension and Position)
    constructor(xOrPosOrRect = 0, yOrDim = 0, widthOrDim = 0, height = 0) {
        if (xOrPosOrRect instanceof Rectangle) this.rct = xOrPosOrRect;
        else if (xOrPosOrRect instanceof Position) {
            if (yOrDim instanceof Dimension)
                this.rct = new Rectangle(xOrPosOrRect, undefined, yOrDim);
            else this.rct = new Rectangle(xOrPosOrRect, yOrDim, widthOrDim, height);
        } else if (yOrDim instanceof Dimension)
            this.rct = new Rectangle(xOrPosOrRect, undefined, yOrDim);
        else this.rct = new Rectangle(xOrPosOrRect, yOrDim, widthOrDim, height);

        /*else {
            this.rct = new Rectangle();
            if (xOrPosOrRect instanceof Position) {
                this.position = xOrPosOrRect;
                if (yOrDim instanceof Dimension) {
                    this.dimension = yOrDim;
                    return;
                }
            } else {
                this.x = xOrPosOrRect;
                this.y = yOrDim;
            }

            if (widthOrDim instanceof Dimension) this.dimension = widthOrDim;
            else {
                this.width = widthOrDim;
                this.height = height;
            }
        }*/
    }
    get rectangle() { return this.rct; }
    set rectangle(value) {
        if (value instanceof Rectangle) {
            this.rct.updateFromRectangle(value);
        } else throw new Error("invalid assignment to ObjectWithRectangle.rectangle");
    }

    get position() { return this.rct.position; }
    set position(value) { this.rct.position = value; }
    set x(value) { this.rct.x = value; }
    get x() { return this.rct.x; }
    set y(value) { this.rct.y = value; }
    get y() { return this.rct.y; }

    get dimension() { return this.rct.dimension; }
    set dimension(value) {
        if (value instanceof Dimension) {
            this.rct.dimension = value;
        } else throw new Error("invalid assignment to ObjectWithRectangle.dimension");
    }
    get width() { return this.rct.width; }
    set width(value) { this.rct.width = value; }
    get height() { return this.rct.height; }
    set height(value) { this.rct.height = value; }

    //get area() { return this.rct.area; } //these get overriden by Polygon class, anyways.  Probably not worth keeping here?
    inside(position) { return this.rct.inside(position.x, position.y); } //takes a position object rather than two coordinate primitives
}

class ObjectWithPositionVelocityAndVector extends ObjectWithPosition {
    constructor(x, y, boundingRectangle) {
        super(x, y);
        this.velocity = new Velocity();
        this.vector = new Vector(this.psn);

        /*Object.defineProperties(this, {
            velocity: { writable: false },
            vector: { writable: false }
        });*/
        if (boundingRectangle) this.bounds = boundingRectangle;
        else {
            Object.defineProperties(this, {
                x: { set(value) { this.psn.x = value; } }, //???is it neccessary to also include the getter method, or will it use the default method already specified below?
                y: { set(value) { this.psn.y = value; } }
            });
        }
    }

    get position() { return this.psn; }
    set position(value) { this.setPosition(value.x, value.y); }
    get x() { return this.psn.x; }
    get y() { return this.psn.y; }
    set x(value) {
        if (this.bounds && !(value >= this.bounds.x && value <= this.bounds.width + this.bounds.x)) {
            console.log(this);
            throw new Error("POSITION OUT OF BOUNDS! (" + value + " , " + this.y + ")");
        }
        this.psn.x = value;
    }
    set y(value) {
        if (this.bounds && !(value >= this.bounds.y && value <= this.bounds.height + this.bounds.y)) {
            console.log(this);
            throw new Error("POSITION OUT OF BOUNDS! (" + this.x + " , " + value + ")");
        }
        this.psn.y = value;
    }
    setPosition(x, y) {
        if (!this.bounds || !(x >= this.bounds.x && x <= this.bounds.width + this.bounds.x && y >= this.bounds.y && y <= this.bounds.height + this.bounds.y)) {
            console.log(this);
            throw new Error("POSITION OUT OF BOUNDS! (" + x + " , " + y + ")");
        }
        this.psn.x = x; this.psn.y = y;
    }

    get point1() { return this.vector.point1; }
    set point1(value) { this.vector.point1.updateFromPosition(value); }
    get point2() { return this.vector.point2; }
    set point2(value) { this.vector.point2.updateFromPosition(value); }
    get oldPosition() { return this.vector.oldPosition; }
    set oldPosition(value) { this.vector.oldPosition.updateFromPosition(value); }
    get newPosition() { return this.vector.newPosition; }
    set newPosition(value) { this.vector.newPosition.updateFromPosition(value); }
    get currentPosition() { return this.vector.currentPosition; }
    set currentPosition(value) { this.vector.currentPosition.updateFromPosition(value); }
    get delta() { return this.vector.delta; }
    set delta(value) { this.vector.delta.x = value.x; this.vector.delta.y = value.y; }
    get slope() { return this.vector.slope; }
    set slope(value) { this.vector.slope = value; }
    get invSlope() { return this.vector.invSlope; }
    set invSlope(value) { this.vector.invSlope = value; }
    get yIntercept() { return this.vector.yIntercept; }
    set yIntercept(value) { this.vector.yIntercept = value; }
    get xIntercept() { return this.vector.xIntercept; }
    set xIntercept(value) { this.vector.xIntercept = value; }


    get direction() { return this.velocity.direction; }
    set direction(value) { this.velocity.direction.degrees = (value instanceof Angle ? value.degrees : value); }
    get speed() { return this.velocity.speed; }
    set speed(value) { this.velocity.speed = value; }
}

initializeLogger?.("objectTemplates ran");