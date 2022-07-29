"use strict"; document.currentScript.initTime = performance.now();

class Block extends Polygon {
    enumerate() { return ["surfaces", "board", "id", "rct"]; }
    skipEnumerationIfConstructed() { return ["displayText"]; }

    constructor(hits, x, y, width = Block.standardSize, height = width, color = BLOCK_COLOR_SCHEME.standard, displayText = new DisplayText()) {
        super(x, y, width, height);
        this.id = Block.blockID++;
        this.hits = hits;

        if (displayText) {
            if (displayText instanceof DisplayText) this.tx = displayText;
            else this.tx = new DisplayText(displayText);
            this.text = hits.toString();
        }

        if (color instanceof Color) {
            this.color = color.toString();
        } else if (color instanceof Array) { //scheme
            this.colorScheme = color;
            let i = 0;
            while (hits < color[i].hits) { i++; }
            this.color = color[i].color;
            this.text.color = color[i].textColor;
            this.schemeIndex = i;
        } else if (color) this.color = color;
    }

    get segments() { return this.surfaces ?? this.generateSurfaces(); }
    get bouncePriority() { return 2; }

    get text() { return this.tx; }
    set text(value) {
        if (value instanceof DisplayText) this.tx = value;
        else this.tx.string = value;
    }

    get color() { return this.clr; }
    set color(value) {
        if (value instanceof Color) {
            this.clr = value.toString();
        } else if (value === undefined) this.clr = BLACK;
        else this.clr = value;
    }

    bounce(ball, surfaces) {
        this.hits--;
        this.tx.string = this.hits.toString();
        this.board.logHit();
        if (this.hits === 0) {
            this.board.destroy(this);
            return true;
        } else {
            this.board.markForRedraw(this);
            if (this.hits < this.colorScheme?.[this.schemeIndex].hits) {
                this.color = this.colorScheme[++this.schemeIndex].color;
                this.tx.color = this.colorScheme[this.schemeIndex].textColor;
            }
        }
        //this.draw();
    }

    setNextRoundPositions(pixelsToAdvance = Block.standardSize) { //sets the final position targets for after animation
        if (this.targetY) throw new Error("this block already has a targetY object!");
        this.targetY = {
            blockY: this.y + pixelsToAdvance,
            //textY: this.text.alignCoordinate.y + pixelsToAdvance
        };
        for (let i = 1; i < this.surfaces.length; i++) {
            //this.surfaces[0].point1 is also the position object for the standard block, so we don't adjust that yet.
            //Other surface points have no impact on standard block drawing, so they are set to their new position immediately
            this.surfaces[i].point1.y += pixelsToAdvance;
        }
        if (this.targetY.blockY + this.height >= this.board.y + this.board.height) this.board.lost();
        return true;
    }

    move(pixels) { //for animinating the block movement betweenRounds
        this.y += pixels;
        if (this.y < this.targetY.blockY) { //increment everything and return the amount left to go
            this.recenter();
            //this.text.alignCoordinate.y += pixels;
            //this.text.realign(this.board.context);
            return this.targetY.blockY - this.y;
        } else { //finished. set the final target positions, delete the targetY property, and return 0.  (Remember that surface points were already advanced in setNextRoundPositions)
            this.y = this.targetY.blockY;
            //this.text.alignCoordinate.y = this.targetY.textY;
            delete this.targetY;
            //this.text.realign(this.board.context);
            this.recenter();
            return 0;
        }
    }
}

Block.standardSize = 25;
Block.textLineWidth = 1;
Block.blockID = 0;


class SimpleRectangleBlock extends Block {
    constructorArgs() { return ["hits", "x", "y", "width", "height", this.colorScheme ? "colorScheme" : "color"]; }


    constructor(hits, x, y, width = Block.standardSize, height = width, colorScheme = BLOCK_COLOR_SCHEME.standard, displayText) {
        super(hits, x, y, width, height, colorScheme, displayText);
        if (this.text) this.text.alignCoordinate.updateFromCoordinates(this.x + this.width / 2, this.y + this.height / 2);
        this.bounceProperties = blockBounceProperties;
    }

    generateSurfaces() {
        this.surfaces = Surface.generateSurfaces(this.rectangle.points(), this);
        return this.surfaces;
    }

    area() { return this.rectangle.area(); }

    overlapsWith(otherPolygon, edgeInclusive = false, testLine1 = undefined, testLine2 = undefined) {
        if ((otherPolygon instanceof SimpleRectangleBlock) || (otherPolygon instanceof Rectangle)) {
            return this.rectangle.overlapsWith(otherPolygon, edgeInclusive);
        } else {
            return super.overlapsWith(otherPolygon, edgeInclusive, testLine1, testLine2);
        }
    }

    draw(context = this.board.context) {
        context.fillStyle = this.color;
        context.lineWidth = Block.textLineWidth;
        context.fillRect(this.x, this.y, this.width, this.height);
        this.text.draw(context);
    }

    drawAt(x, y, context = this.board.context, rotateAngle = ANGLE.right) {
        rotateAngle = ANGLE_RANGE_360.default.transform(rotateAngle)
        if (rotateAngle === 0 || rotateAngle === 90 || rotateAngle === 180 || rotateAngle === -90 || rotateAngle === -180) {
            let tempX = this.x;
            let tempY = this.y;
            this.x = x;
            this.y = y;
            this.text.alignOverCoordinate(this.x + this.width / 2, this.y + this.height / 2, context);
            this.draw(context);
            this.x = tempX;
            this.y = tempY;
            this.text.alignOverCoordinate(this.x + this.width / 2, this.y + this.height / 2);
        } else {
            this.shapedPeer.drawAt(x, y, context, rotateAngle);
        }
    }

    get shapedPeer() {
        if (!this.shpdPr) {
            this.shpdPr = new ShapedBlock(this.hits, this.rectangle.points(), this.text.alignCoordinate, this.colorScheme ?? this.color, this.displayText);
            this.shpdPr.text = this.text; // the two blocks will share a 'text' DisplayText object
        } else {
            this.shpdPr.hits = this.hits;
            this.shpdPr.color = this.color;
        }

        return this.shpdPr;
    }

    copy(x = this.x, y = this.y, rotateAngle = ANGLE.right) {
        rotateAngle = ANGLE_RANGE_360.default.transform(rotateAngle)
        if (rotateAngle === 0 || rotateAngle === 180 || rotateAngle === -180) {
            return new SimpleRectangleBlock(this.hits, x, y, this.width, this.height, this.colorScheme ?? this.color, this.text.copy())
        } else if (rotateAngle === 90 || rotateAngle === -90) {
            //flip width/height, but maintain the same center point (*not* neccessarily the same origin point, unless it is a square)
            return new SimpleRectangleBlock(this.hits, x + (this.width - this.height) / 2, y + (this.height - this.width) / 2, this.height, this.width, this.colorScheme ?? this.color, this.text.copy())
        } else {
            this.shapedPeer.hits = this.hits;
            this.shapedPeer.color = this.color;
            if (this.colorScheme) this.shapedPeer.colorScheme = this.colorScheme;
            return shapedPeer.copy(x, y, rotateAngle)
        }
    }

    moveTo(x, y) {
        this.x = x;
        this.y = y;
        if (this.surfaces) {
            this.surfaces[1].point1.updateFromCoordinates(x, y + this.height);
            this.surfaces[2].point1.updateFromCoordinates(x + this.width, y + this.height);
            this.surfaces[3].point1.updateFromCoordinates(x + this.width, y);
            this.surfaces.forEach((surface) => { surface.recalc(); });
        }
        this.recenter();
    }

    recenter() {
        this.text.alignCoordinate.updateFromCoordinates(this.x + this.width / 2, this.y + this.height / 2);
    }
}

SimpleRectangleBlock.prototype.inside = ObjectWithRectangle.prototype.inside; //takes a position object rather than two coordinate primitives.  Can use the original rectangle method (rather than the inherited polygon method) for rectangle blocks


class ShapedBlock extends Block {
    constructorArgs() { return ["hits", "points", this.colorScheme ? "colorScheme" : "color"]; }
    enumerate() { return super.enumerate().concat("points"); }

    constructor(hits, points, rotateCenter, color = BLOCK_COLOR_SCHEME.standard, displayText) {
        Polygon.findRectangleBounds(points);
        super(hits, points.x, points.y, points.width, points.height, color, displayText);
        this.bounceProperties = blockBounceProperties;
        this.rotateCenter = rotateCenter;
        this.points = points;
    }

    generateSurfaces() {
        this.surfaces = Surface.generateSurfaces(this.points, this);
        return this.surfaces;
    }

    draw(context = this.board.context) {
        context.fillStyle = this.color;
        context.lineWidth = Block.textLineWidth;
        context.beginPath();
        context.moveTo(this.points[0].x, this.points[0].y);
        for (let i = 1; i < this.points.length; i++) {
            context.lineTo(this.points[i].x, this.points[i].y);
        }
        context.lineTo(this.points[0].x, this.points[0].y);
        context.fill();

        this.text.draw(context);
    }

    drawAt(x, y, context, rotateAngle = ANGLE.right) {
        let tempPoints = this.points;
        tempPoints.textCenter.updateFromPosition(this.text.alignCoordinate);
        this.points = this.transformPoints(x, y, rotateAngle);
        this.text.alignOverCoordinate(this.points.textCenter.x, this.points.textCenter.y, context);
        this.draw(context);
        this.points = tempPoints;
        this.text.alignOverCoordinate(this.points.textCenter.x, this.points.textCenter.y);
    }

    copy(x = this.x, y = this.x, rotateAngle = ANGLE.right) {
        let points = this.transformPoints(x, y, rotateAngle, true);
        return new ShapedBlock(this.hits, points, points.rotateCenter, this.colorScheme ?? this.color, this.text.copy(points.textCenter.x, points.textCenter.y));
    }

    transformPoints(x, y, rotateAngle, returnDeepCopyUnconditionally = false) {
        rotateAngle = ANGLE_RANGE_360.default.transform(rotateAngle);
        if (rotateAngle = 0 && x === this.x && y === this.y && !returnDeepCopyUnconditionally) {
            return this.points;
        }
        x -= this.x;
        y -= this.y;
        let transformedPoints = new Array(this.points.length);
        let transformedRotateCenter = new Position(this.rotateCenter.x + x, this.rotateCenter.y + y)
        transformedPoints.rotateCenter = transformedRotateCenter;
        if (rotateAngle !== 0) {
            this.points.forEach((point, index) => {
                transformedPoints[index] = Angle.pointFrom(transformedRotateCenter, this.rotateCenter.angleTo(point) + rotateAngle, this.rotateCenter.distanceTo(point));
            });
            transformedPoints.textCenter = Angle.pointFrom(transformedRotateCenter, this.rotateCenter.angleTo(this.text.alignCoordinate) + rotateAngle, this.rotateCenter.distanceTo(this.text.alignCoordinate));
        } else {
            this.points.forEach((point, index) => {
                transformedPoints[index] = new Position(point.x + x, point.y + y);
            });
            transformedPoints.textCenter = new Position(this.text.alignCoordinate.x + x, this.text.alignCoordinate.y + y);
        }
        return transformedPoints;
    }


    setNextRoundPositions(pixelsToAdvance = Block.standardSize) { //NEED TO CHANGE THIS TO USE "this.recenter()" INSTEAD
        if (this.targetY) throw new Error("this block already has a targetY object!");
        this.targetY = new Array(this.points.length)
        this.targetY.blockY = this.y + pixelsToAdvance;
        this.targetY.textY = this.text.alignCoordinate.y + pixelsToAdvance;
        this.targetY.rotateY = this.rotateCenter.y + pixelsToAdvance;
        for (let i = 0; i < this.surfaces.length; i++) {
        //in shaped blocks, the 'points' used for drawing are shared objects with the surfaces, so we do not immediately advance the surfaces to the target as we do in SimpleSquareBlock
            this.targetY[i] = this.surfaces[i].point1.y + pixelsToAdvance;
        }
        if (this.targetY.blockY + this.height >= this.board.y + this.board.height) this.board.lost();
        return true;
    }

    move(pixels) { //NEED TO CHANGE THIS TO USE "this.recenter()" INSTEAD
        this.y += pixels;
        if (this.y < this.targetY.blockY) { //increment everything and return the amount left to go
            this.text.alignCoordinate.y += pixels;
            this.text.realign(this.board.context);
            this.rotateCenter.y += pixels; //probably not neccessary here, but might as well
            for (let i = 0; i < this.surfaces.length; i++) {
                this.points[i].y += pixels;
            }
            return this.targetY.blockY - this.y;
        } else { //finished. set the final target positions, delete the targetY property, and return 0
            this.y = this.targetY.blockY;
            this.text.alignCoordinate.y = this.targetY.textY;
            this.rotateCenter.y = this.targetY.rotateY; //definitely neccessary here!
            for (let i = 0; i < this.surfaces.length; i++) {
                this.surfaces[i].point1.y = this.targetY[i];
            }
            delete this.targetY;
            this.text.realign(this.board.context);
            return 0;
        }
    }

    moveTo(x, y) {
        let deltaX = x - this.x;
        let deltaY = y - this.y;
        this.x = x;
        this.y = y;

        this.points.forEach((point) => {
            if (point === this.position) return;
            point.x += deltaX;
            point.y += deltaY;
        });

        this.rotateCenter.x += deltaX;
        this.rotateCenter.y += deltaY;
        this.text.alignCoordinate.x += deltaX;
        this.text.alignCoordinate.y += deltaY;
    }
}


class RightTriangleBlock extends ShapedBlock {
    constructorArgs() { return [
        "hits", "x", "y",
        (() => this.points.squareCornerOrientation),
        (() => this.points.legLength[0] !== this.points.legLength[1] ? [...this.points.legLength] : this.points.legLength[0]) ,
        this.colorScheme ? "colorScheme" : "color"
    ]; }

    //Orientation is the angle which bisects the right-angle corner
    constructor(hits, x, y, squareCornerOrientation = ANGLE.downRight45, legLength = Block.standardSize, color = BLOCK_COLOR_SCHEME.standard, displayText = new DisplayText()) {
        let points = RightTriangleBlock.generatePoints(x, y, squareCornerOrientation, legLength); 
        displayText.alignCoordinate = points.textCenter;
        super(hits, points, points.centerHypotenuse, color, displayText);
    }

    static generatePoints(x, y, squareCornerOrientation, legLength) {
        if (squareCornerOrientation instanceof Angle) squareCornerOrientation = ANGLE_RANGE_360.default.transform(squareCornerOrientation.degrees);

        if (Number.isFinite(legLength)) legLength = [legLength, legLength]
        else if (!(legLength instanceof Array && legLength.length === 2 && Number.isFinite(legLength[0]) && Number.isFinite(legLength[1]) && legLength[0] >= 0 && legLength[1] >= 0))
            throw new Error();

        let acuteAngle1 = -Angle.degreesFromSlope(legLength[1] / legLength[0]); //relative angle, leg1 to hypotenuse
        let acuteAngle2 = -Angle.degreesFromSlope(legLength[0] / legLength[1]); //relative angle, leg2 to hypotenuse
        let hypAngleFrom1 = ANGLE_RANGE_360.default.transform(squareCornerOrientation + 45 + acuteAngle1); //absolute angle
        let hypAngleFrom2 = ANGLE_RANGE_360.default.transform(squareCornerOrientation - 45 - acuteAngle2); //absolute angle
        if (Math.abs(hypAngleFrom1 - hypAngleFrom2) !== 180) {
            let rounded = Position.round(Math.abs(hypAngleFrom1 - hypAngleFrom2));
            // ...was getting some floating-point rounding errors in iphone Safari here
            if (rounded !== 180) {
                let err = new Error(rounded);
                err.arguments = arguments
                err.acuteAngle1 = acuteAngle1;
                err.acuteAngle2 = acuteAngle2;
                err.hypAngleFrom1 = hypAngleFrom1;
                err.hypAngleFrom2 = hypAngleFrom2;
                throw err;
            }
        }

        let squareCorner;

        if (squareCornerOrientation > 45 && squareCornerOrientation < 135)
            squareCorner = new Position(x + Math.cos(Angle.degreesToRadians(squareCornerOrientation - 45)) * legLength[1], y);

        else if (squareCornerOrientation === 135)
            squareCorner = new Position(x, y);

        else if (squareCornerOrientation > 135 || squareCornerOrientation < -135)
            squareCorner = new Position(x, y - Math.sin(Angle.degreesToRadians(squareCornerOrientation + 45)) * legLength[0]);

        else if (squareCornerOrientation === -135)
            squareCorner = new Position(x, y + legLength[0])

        else if (squareCornerOrientation > -135 && hypAngleFrom1 <= 0) {
            squareCorner = new Position(x + Math.cos(Angle.degreesToRadians(squareCornerOrientation + 45)) * legLength[0], y - Math.sin(Angle.degreesToRadians(squareCornerOrientation + 45)) * legLength[0]);
            if (squareCornerOrientation >= -45) throw new Error();

        } else if (squareCornerOrientation < -45)
            squareCorner = new Position(x + Math.cos(Angle.degreesToRadians(squareCornerOrientation + 45)) * legLength[0], y - Math.sin(Angle.degreesToRadians(squareCornerOrientation + 45)) * legLength[1]);

        else if (squareCornerOrientation === -45)
            squareCorner = new Position(x + legLength[0], y + legLength[1]);

        else if (squareCornerOrientation > -45 && hypAngleFrom1 <= 90) {
            squareCorner = new Position(x + Math.cos(Angle.degreesToRadians(squareCornerOrientation + 45)) * legLength[0], y - Math.sin(Angle.degreesToRadians(squareCornerOrientation - 45)) * legLength[1]);
            if (squareCornerOrientation >= 45) throw new Error();

        } else if (squareCornerOrientation < 45)
            squareCorner = new Position(x + Math.cos(Angle.degreesToRadians(squareCornerOrientation - 45)) * legLength[1], y - Math.sin(Angle.degreesToRadians(squareCornerOrientation - 45)) * legLength[1]);
        else if (squareCornerOrientation === 45)
            squareCorner = new Position(x + legLength[1], y);

        else throw new Error();

        
        let points = [  Angle.pointFrom(squareCorner, squareCornerOrientation - 135, legLength[0]),
                        squareCorner,
                        Angle.pointFrom(squareCorner, squareCornerOrientation + 135, legLength[1])
                     ];


        //points.forEach((point) => point.round());

        points.legLength = legLength;
        points.squareCornerOrientation = squareCornerOrientation;

        return RightTriangleBlock.findTextCenter(points);
    }

    static findTextCenter(points) {
        points.centerHypotenuse = new Position((points[0].x + points[2].x) / 2, (points[0].y + points[2].y) / 2); //center of hypotenuse
        points.nearestPointOnHyp = (new Line(points[0], points[2])).nearestPointTo(points[1]);

        points.textCenter = new Position((points.nearestPointOnHyp.x + points[1].x) / 2, (points.nearestPointOnHyp.y + points[1].y) / 2);
        /*
         * above is the mid-point between the nearest point on the Hypotenuse to the square corner, and the square corner itself.
         * This ends up being a little * too * close to the square corner, whereas the average of the three coordinates tends to run the text a little outside of the hypotenuse.
         * Therefore, do an average of the two
         */
        points.textCenter.updateFromCoordinates(
            (points.textCenter.x + (points[0].x + points[1].x + points[2].x) / 3) / 2,
            (points.textCenter.y + (points[0].y + points[1].y + points[2].y) / 3) / 2
        )
        return points;
    }

    area() { return this.points.legLength[0] * this.points.legLength[1] / 2; }

    recenter() {
        this.text.alignOverPosition(RightTriangleBlock.findTextCenter(this.points).textCenter);
    }

    copy(x = this.x, y = this.y, rotateAngle = ANGLE.right) {
        let orientation = (this.points.squareCornerOrientation.degrees ?? this.points.squareCornerOrientation) + ANGLE_RANGE_360.default.transform(rotateAngle) 
        if (!Number.isFinite(orientation)) throw new Error("invalid orientation angle");
        return new RightTriangleBlock(this.hits, x, y, orientation, this.points.legLength, this.colorScheme ?? this.color, this.text.copy());
    }

    moveTo(x, y) {
        this.x = x;
        this.y = y;
        this.points = RightTriangleBlock.generatePoints(x, y, this.points.squareCornerOrientation, this.points.legLength);
        this.rotateCenter = this.points.centerHypotenuse;
        this.text.alignCoordinate = this.points.textCenter;
        if (this.surfaces) this.generateSurfaces();
    }
}



class DirectionalBlock extends SimpleRectangleBlock {

    constructorArgs() { return [(() => this.bounceDirection.degrees), "x", "y", "width", "height"]; }
    skipEnumerationIfConstructed() { return ["bounceDirection", "displayText"]; }

    constructor(direction, x, y, width = Block.standardSize, height = Block.standardSize) {
        direction = ANGLE.find(direction);
        super(ANGLE.nameOf(direction) ?? (direction.degrees + " degrees"), x, y, width, height, null, null);
        this.bounceProperties = directionalBounceProperties;
        this.bounceDirection = direction;
        this.bounceRange = ANGLE_RANGE_180.findByMinMax(direction.degrees - 90, direction.degrees + 90);
        this.recenter();
    }

    get bouncePriority() { return 5; }

    generateArrowPoints(direction, center, length = undefined) {
        if (length === undefined) {
            let lrIntersection = Math.abs(this.width * direction.tan());
            let tbIntersection = Math.abs(this.height / direction.tan());
            if (lrIntersection <= this.height) { // intersects with the left/right edge (or a corner) first
                length = this.width * 2 / Math.abs(direction.cos()) / 3;
            } else if (tbIntersection <= this.width) { //intersects with the top/bottom edge first
                length = this.height * 2 / Math.abs(direction.sin()) / 3;
            } else throw new Error("cannot determine arrow length!");

            length = Math.min(length, Math.sqrt((this.width ** 2 + this.height ** 2) / 2) * 2 / 3); //limit arrow length to the root mean square of the width and height (times 2/3)
        }

        let arrowPoints = [
            Angle.pointFrom(center, direction.degrees + 180, length / 2),
            Angle.pointFrom(center, direction.degrees, length / 2),
            undefined,
            undefined
        ];
        arrowPoints[2] = Angle.pointFrom(arrowPoints[1], direction.degrees + 135, length / 2);
        arrowPoints[3] = Angle.pointFrom(arrowPoints[1], direction.degrees - 135, length / 2);

        //limit to the bounds of the block.  points 0 and 1 are already implicitly bound by the length calculation
        arrowPoints[2].x = Math.min(Math.max(arrowPoints[2].x, this.x), this.x + this.width);
        arrowPoints[2].y = Math.min(Math.max(arrowPoints[2].y, this.y), this.y + this.height);
        arrowPoints[3].x = Math.min(Math.max(arrowPoints[3].x, this.x), this.x + this.width);
        arrowPoints[3].y = Math.min(Math.max(arrowPoints[3].y, this.y), this.y + this.height);


        arrowPoints.arrowLength = length;
        return arrowPoints
    }

    recenter() {
        this.arrowPoints = this.generateArrowPoints(this.bounceDirection, new Position(this.x + this.width / 2, this.y + this.height / 2));
    }

    copy(x = this.x, y = this.y, rotate = ANGLE.right) {
        let direction;
        if (rotate === ANGLE.right || ANGLE.right.equalTo(rotate))
            direction = this.bounceDirection;
        else {
            direction = ANGLE.find(this.bounceDirection.degrees + rotate.degrees ?? rotate);
        }
        return new DirectionalBlock(direction, x, y, this.width, this.height);
    }

    generateSurfaces() {
        return this.surfaces = Surface.generateSurfaces(this.rectangle.points(), this);
    }

    bounce(ball, surfaces) {
        //do nothing!!
    }

    draw(context = this.board.context) {
        //fill inside of block with off-black
        context.fillStyle = this.__proto__.constructor.backgroundColor;
        context.fillRect(this.x, this.y, this.width, this.height);

        //draw arrow
        context.strokeStyle = this.constructor.foregroundColor;
        context.lineWidth = this.constructor.lineWidth;
        context.beginPath();
        context.moveTo(this.arrowPoints[0].x, this.arrowPoints[0].y);
        context.lineTo(this.arrowPoints[1].x, this.arrowPoints[1].y);
        context.lineTo(this.arrowPoints[2].x, this.arrowPoints[2].y);
        context.moveTo(this.arrowPoints[1].x, this.arrowPoints[1].y);
        context.lineTo(this.arrowPoints[3].x, this.arrowPoints[3].y);
        context.stroke();

        //draw border with dashed line
        context.setLineDash(this.constructor.lineDash);
        context.strokeRect(this.x, this.y, this.width, this.height)
        context.setLineDash([]);
    }

    drawAt(x, y, context = this.board.context, rotateAngle = ANGLE.right) {
        rotateAngle = ANGLE_RANGE_360.default.transform(rotateAngle)
        if (rotateAngle === 0 || rotateAngle === 90 || rotateAngle === 180 || rotateAngle === -90 || rotateAngle === -180) {
            let tempX = this.x;
            let tempY = this.y;
            this.x = x;
            this.y = y;

            x = x - tempX;
            y = y - tempY;
            let arrowPoints = new Array(this.arrowPoints.length)
            this.arrowPoints.forEach((point, index) => {
                arrowPoints[index] = { x: point.x + x, y: point.y + y };
            });
            let tempArrowPoints = this.arrowPoints;
            this.arrowPoints = arrowPoints;

            this.draw(context);

            //restore previous values
            this.x = tempX;
            this.y = tempY;
            this.arrowPoints = tempArrowPoints;
        } else { // NEED TO WRITE SHAPED DIRECTIONAL BLOCK CLASS!
            this.shapedPeer.drawAt(x, y, context, rotateAngle);
        }
    }

    setNextRoundPositions(pixelsToAdvance) { return false; } //do nothing!  Directional blocks don't move
    move(pixels) { throw new Error("Directional Blocks do not advance!"); }
    moveTo(x, y) {
        super.moveTo(x, y);
        this.arrowPoints = this.generateArrowPoints(this.bounceDirection, new Position(this.x + this.width / 2, this.y + this.height / 2), this.arrowPoints.arrowLength);
    }
}

DirectionalBlock.lineDash = [3, 2];
DirectionalBlock.lineWidth = 1;
DirectionalBlock.backgroundColor = DARK_GREY.toString();
DirectionalBlock.foregroundColor = LIGHT_GREY.toString(); //"rgb(190, 190, 190)"; //for arrow and border

class SolidDirectionalBlock extends DirectionalBlock {

    //inherits 'constructorArgs' from DirectionalBlock.  No need to change it in this case
    constructor(direction, x, y, width, height) {
        super(direction, x, y, width, height);
        this.bounceProperties = solidDirectionalBounceProperties;
        delete this.bounceRange;
    }

    get bouncePriority() { return 2; }

    generateSurfaces() {
        return this.surfaces = Surface.generateSurfaces(this.rectangle.points(), this);
    }

    bounce(ball, surfaces) {
        surfaces.forEach((surface) => {
            if (surface instanceof Surface) {
                if (this.surfaces.indexOf(surface) > -1) surface.switch?.();
            } else if (surface.isCorner) {
                if (this.surfaces.indexOf(surface.thisSurface) > -1) surface.switch?.();
            }
        });
    }

    copy(x = this.x, y = this.y, rotate = ANGLE.right) {
        let direction;
        if (rotate === ANGLE.right || ANGLE.right.equalTo(rotate))
            direction = this.bounceDirection;
        else {
            direction = ANGLE.find(this.bounceDirection.degrees + rotate.degrees ?? rotate);
        }
        return new SolidDirectionalBlock(direction, x, y, this.width, this.height);
    }
}

SolidDirectionalBlock.backgroundColor = LIGHT_GREY.toString();
SolidDirectionalBlock.foregroundColor = DARK_GREY.toString();
SolidDirectionalBlock.lineDash = [];
SolidDirectionalBlock.lineWidth = 1;

initializeLogger?.("board.block ran");