"use strict"; document.currentScript.initTime = performance.now();

class Surface extends Segment {
    constructor(point1, point2, block) {
        super(point1, point2);
        this.block = block;
    }

    static generateSurfaces(points, block, bounceProperties = block.bounceProperties) {
        // bouncingProperties allows this.bounceAngle function to be defined at generateSurfaces.  bouncingProperties() function is the initializer, and should create this.bounceAngle(ball, collisionPoint)
        // Special blocks should define their own bounceAngle(ball) function for their surfaces
        let result = new Array(points.length);
        for (let i = 0, next = 1; i < points.length; i++, next++) {
            if (next >= points.length) next = 0;
            result[i] = new Surface(points[i], points[next], block, bounceProperties);
            if (i > 0) {
                result[i - 1].next = result[i];
                result[i].previous = result[i - 1];
            }
        }
        result[0].previous = result[result.length - 1];
        result[result.length - 1].next = result[0];

        result.forEach((surface) => { bounceProperties.apply(surface); });

        return result;
    }

    static rebuildCornerBounceRanges(engine) {
        let surfaces = engine.surfaces;
        for (let i = 0; i < surfaces.length; i++) {
            if (surfaces[i].corner1 instanceof Array) surfaces[i].corner1.length = 0;
            if (surfaces[i].corner2 instanceof Array) surfaces[i].corner2.length = 0;
        }
        for (let i = 0; i < surfaces.length; i++) {
            if (surfaces[i].corner1 instanceof Array) surfaces[i].constructCornerBounceCache(surfaces[i].corner1);
            if (surfaces[i].corner2 instanceof Array) surfaces[i].constructCornerBounceCache(surfaces[i].corner2);
        }
    }

    containsPoint(point, point1Inclusive = true, point2Inclusive = true) {
        if (this.lineCache) return this.lineCache.containsPoint(point) && this.inRange(point, point1Inclusive, point2Inclusive);
        else return super.containsPoint(point, point1Inclusive, point2Inclusive);
    }

    getSurfaceAnglesAt(point) { // does NOT check if the point is actually *on* the surface
        if (point.equalTo(this.point1)) return [this.corner1.surfaceAngle];
        if (point.equalTo(this.point2)) return [this.corner2.surfaceAngle];
        return [this.corner1.surfaceAngle, this.corner2.surfaceAngle];
    }
}


function edgeBounceProperties() {
    this.bouncePriority = 0;
    this.bounceAngle = useRawBounceAngleOnly;
    defaultBounceRange.apply(this);
    this.corner1 = { surfaceAngle: this.point1.angleTo(this.point2) };
    this.corner2 = { surfaceAngle: this.point2.angleTo(this.point1) };
}

function directionalBounceProperties() {
    this.bouncePriority = 5;
    this.rawBounceAngle = rawBounceAngle_directionalBlock;
    this.bounceAngle = useRawBounceAngleOnly;
    this.bounceDirection = this.block.bounceDirection;
    this.bounceRange = this.block.bounceRange;
    this.bounceRangeUpperspan = (this.bounceRange.max.degrees - this.bounceDirection.degrees) //pre-calculated for rawBounceAngle_directionalBlock function
    this.bounceRangeLowerspan = (this.bounceDirection.degrees - this.bounceRange.min.degrees) //pre-calculated for rawBounceAngle_directionalBlock function
    this.corner1 = { point: this.point1, surfaceAngle: this.point1.angleTo(this.point2), bounceRange: this.bounceRange, isCorner: true, block: this.block, bouncePriority: this.bouncePriority, thisSurface: this, sameBlockOtherSurface: this.previous };
    this.corner2 = { point: this.point2, surfaceAngle: this.point2.angleTo(this.point1), bounceRange: this.bounceRange, isCorner: true, block: this.block, bouncePriority: this.bouncePriority, thisSurface: this, sameBlockOtherSurface: this.next, sameBlockOtherCorner: this.corner1 };
    this.corner1.sameBlockOtherCorner = this.corner2;
}

function solidDirectionalBounceProperties() {
    blockBounceProperties.apply(this);
    this.bounceAngle = useRawBounceAngleOnly;

    if (this.bounceRange.inRange(this.block.bounceDirection.degrees + 45)) {
        if (this.bounceRange.inRange(this.block.bounceDirection.degrees - 45)) {
            this.bounceDirection = ANGLE.find(this.block.bounceDirection.degrees, true); //make strict
        } else {
            this.bounceDirection = ANGLE.find(this.bounceRange.min.degrees + 45, true); //make strict
        }
    } else if (this.bounceRange.inRange(this.block.bounceDirection.degrees - 45)) {
        this.bounceDirection = ANGLE.find(this.bounceRange.max.degrees - 45, true); //make strict

    } else { // need split bounce direction, with middle 'switch' incoming range
        let bounceDirectionInv = this.block.bounceDirection.inv(this.bounceRange);
        this.rawBounceAngle = rawBounceAngle_splitBounceDirection;
        let upperMargin = this.bounceRange.max.degrees - (bounceDirectionInv + 45);
        let lowerMargin = (bounceDirectionInv - 45) - this.bounceRange.min.degrees;

        if (lowerMargin > upperMargin) {
            this.lowerSwitchXOver = this.bounceRange.min.degrees + upperMargin * 1.5; // a little counter-intuitive... the XOvers are for incoming angles.  the direction are the direction they bounce towards
            this.upperSwitchXOver = this.lowerSwitchXOver + upperMargin;

            this.lowerBounceDirection = ANGLE.find(this.bounceRange.max.degrees - 45, true);  //a little counter-intuitive.... the lowerBounceDirection is actually higher, but applies to incoming angles from lower degrees (clockwise)
            this.upperBounceDirection = ANGLE.find(this.bounceRange.min.degrees + upperMargin, true);

            this.primaryBounceDirection = this.upperBounceDirection;
            this.secondaryBounceDirection = this.lowerBounceDirection;

            this.switchRatio = lowerMargin / upperMargin;

        } else if (lowerMargin <= upperMargin) {
            this.upperSwitchXOver = this.bounceRange.max.degrees - lowerMargin * 1.5;
            this.lowerSwitchXOver = this.upperSwitchXOver - lowerMargin;

            this.upperBounceDirection = ANGLE.find(this.bounceRange.min.degrees + 45, true); //a little counter-intuitive.... the upperBounceDirection is actually lower, but applies to incoming angles from higher degrees (counter-clockwise)
            this.lowerBounceDirection = ANGLE.find(this.bounceRange.max.degrees - lowerMargin, true);

            this.primaryBounceDirection = this.lowerBounceDirection;
            this.secondaryBounceDirection = this.upperBounceDirection;

            this.switchRatio = upperMargin / lowerMargin;

        } else throw new Error();

        this.switch = incrementSwitchBounceDirection;
        this.switchCounter = this.block.x / this.block.width + this.block.y / this.block.height * ((this.block.board.width - this.block.board.x) / this.block.width);
            //'starting state' is dependent upon block's position on the board
        this.switchCounter %= (this.switchRatio + 1);
        if (this.switchCounter >= this.switchRatio)
            this.switchBounceDirection = this.secondaryBounceDirection;
        else this.switchBounceDirection = this.primaryBounceDirection;
    }
}

function blockBounceProperties() {
    this.bouncePriority = 2;
    defaultBounceRange.apply(this);
    //this.bounceAngle = modifiedNearCornerBlockBounce; //not neccessary since it is the default

    let thisCorner;
    let otherCorner;

    for (let i = 0; i < 2; i++) {
        if (i === 0 && this.previous.bounceRange) {
            thisCorner = this.corner1 = new Array();
            thisCorner.point = this.point1;
            thisCorner.surfaceAngle = this.point1.angleTo(this.point2);

            otherCorner = this.previous.corner2 = new Array();
            otherCorner.surfaceAngle = this.previous.point2.angleTo(this.previous.point1);
            otherCorner.thisSurface = this.previous;

            if (this.previous.corner1) {
                otherCorner.sameSurfaceOtherCorner = this.previous.corner1;
                this.previous.corner1.sameSurfaceOtherCorner = otherCorner;
            }

        } else if (this.next.bounceRange) {
            thisCorner = this.corner2 = new Array();
            thisCorner.point = this.point2;
            thisCorner.surfaceAngle = this.point2.angleTo(this.point1);

            otherCorner = this.next.corner1 = new Array();
            otherCorner.surfaceAngle = this.next.point1.angleTo(this.next.point2);
            otherCorner.thisSurface = this.next;

            if (i === 1) {
                thisCorner.sameSurfaceOtherCorner = this.corner1;
                this.corner1.sameSurfaceOtherCorner = thisCorner;
            } else i = 1;

            if (this.next.corner2) {
                otherCorner.sameSurfaceOtherCorner = this.next.corner2;
                this.next.corner2.sameSurfaceOtherCorner = otherCorner;
            }

        } else break;

        thisCorner.sameBlockOtherCorner = otherCorner;
        otherCorner.sameBlockOtherCorner = thisCorner;

        thisCorner.thisSurface = this;
        thisCorner.sameBlockOtherSurface = otherCorner.thisSurface;

        otherCorner.sameBlockOtherSurface = this;
        otherCorner.point = thisCorner.point;

        thisCorner.isCorner = otherCorner.isCorner = true;
        thisCorner.block = otherCorner.block = this.block;

        let blockRange = constructCornerBounceRange(this, thisCorner.surfaceAngle, otherCorner.thisSurface, otherCorner.surfaceAngle, true);
        thisCorner.blockRange = blockRange;
        otherCorner.blockRange = blockRange;

        thisCorner.surfaceAngle = blockRange.transform(thisCorner.surfaceAngle);
        otherCorner.surfaceAngle = blockRange.transform(otherCorner.surfaceAngle);
    }
}

function constructCornerBounceRange(surface1, surface1Angle, surface2, surface2Angle, forSameBlock = false) {
    //forSameBlock = true adds properties required by ball.prioritizeSurfaces function, for when corner bounce ranges are substituted for surfaces by getExposedBounceSurfaces in ball.bounce
    let concave1 = surface1.bounceRange.inRange(surface2Angle);
    let concave2 = surface2.bounceRange.inRange(surface1Angle);
    let result;
    if (concave1 || concave2) //the corner bounce range must be the *overlap* between the two surface's bounce ranges
        result = AngleRange.overlappingRange(surface1.bounceRange, surface2.bounceRange);
    else                            // corner bounce range is the *sum* of the two surface's bounce ranges
        result = AngleRange.sumRange(surface1.bounceRange, surface2.bounceRange);

    if (!result) result = { undefinedBounceRange: true };
    else if (result.immutable) result = result.copy();

    result.surfaces = [surface1, surface2];
    if (forSameBlock) { //for ball.prioritizeSurfaces function (and possibly others down the road...?) to emulate a surface object structure
        if(surface1.block !== surface2.block) throw new Error("Surfaces must have the same block property if 'forSameBlock' is true!")
        result.bounceRange = result; // self-referential
        result.bouncePriority = Math.max(surface1.bouncePriority, surface2.bouncePriority);
        result.block = surface1.block;
        result.isCorner = true;
    }

    return result;
}


function defaultBounceRange() {
    //assumes the standard block is generated counter-clockwise.  For the board edges, generate them clockwise to cause inward-bouncing (rather than outward-bouncing like a block)
    this.bounceDirection = ANGLE.find(this.point1.angleTo(this.point2) - 90);
    this.bounceRange = ANGLE_RANGE_180.findByMinMax(this.bounceDirection.degrees - 90, this.bounceDirection.degrees + 90, true);
    if (!this.bounceRange.inRange(this.bounceDirection, true))
        throw new Error("Bounce direction needs to be *strictly* within range of the bounceRange!  Need a different way to construct this bounceRange");
}


Surface.prototype.rawBounceAngle = function (incomingAngle) {
    if (this.bounceRange.inRange(incomingAngle)) return { incomingAngle: true };
    let incomingInv = this.bounceRange.transform(incomingAngle.inv());
    if (incomingInv >= this.bounceDirection.degrees)
        return this.bounceDirection.degrees - (this.bounceDirection.degrees - this.bounceRange.min.degrees) * (incomingInv - this.bounceDirection.degrees) / (this.bounceRange.max.degrees - this.bounceDirection.degrees);
    else if (incomingInv < this.bounceDirection.degrees)
        return this.bounceDirection.degrees + (this.bounceRange.max.degrees - this.bounceDirection.degrees) * (this.bounceDirection.degrees - incomingInv) / (this.bounceDirection.degrees - this.bounceRange.min.degrees);
    else throw new Error("Could not determine rawBounceAngle");
}

function rawBounceAngle_directionalBlock(incomingAngle) {
    //IMPORTANT:  This depends upon the bounceDirection being STRICTLY in range of the bounceRange.  If not, it will result in strange behaviors in modifiedNearCornerBlockCounce, due to inaccurate ratios
    if (this.bounceRange.inRange(incomingAngle)) {
        incomingAngle = this.bounceRange.transform(incomingAngle);
        if (incomingAngle > this.bounceDirection.degrees) return { incomingAngle: true, ratio: (incomingAngle - this.bounceDirection.degrees) / this.bounceRangeUpperspan };
        else return { incomingAngle: true, ratio: (this.bounceDirection.degrees - incomingAngle) / this.bounceRangeLowerspan };
    }
    let incomingInv = this.bounceRange.transform(incomingAngle.inv());
    if (incomingInv >= this.bounceDirection.degrees)
        return this.bounceDirection.degrees - (this.bounceDirection.degrees - this.bounceRange.min.degrees) * (incomingInv - this.bounceDirection.degrees) / (this.bounceRange.max.degrees - this.bounceDirection.degrees);
    else if (incomingInv < this.bounceDirection.degrees)
        return this.bounceDirection.degrees + (this.bounceRange.max.degrees - this.bounceDirection.degrees) * (this.bounceDirection.degrees - incomingInv) / (this.bounceDirection.degrees - this.bounceRange.min.degrees);
    else throw new Error("Could not determine rawBounceAngle");
}


function rawBounceAngle_splitBounceDirection(incomingAngle) { //for solid directional blocks, under certain circumstances
    if (this.bounceRange.inRange(incomingAngle)) return { incomingAngle: true };
    let incomingInv = this.bounceRange.transform(incomingAngle.inv());
    if (incomingInv <= this.lowerSwitchXOver) { //use the lowerBounceDirection
        return this.lowerBounceDirection.degrees + (this.bounceRange.max.degrees - this.lowerBounceDirection.degrees) * (this.lowerBounceDirection.degrees - incomingInv) / (this.lowerBounceDirection.degrees - this.bounceRange.min.degrees);

    } else if (incomingInv >= this.upperSwitchXOver) { //use the upperBounceDirection
        return this.upperBounceDirection.degrees - (this.upperBounceDirection.degrees - this.bounceRange.min.degrees) * (incomingInv - this.upperBounceDirection.degrees) / (this.bounceRange.max.degrees - this.upperBounceDirection.degrees);

    } else if (incomingInv > this.lowerSwitchXOver && incomingInv < this.upperSwitchXOver) { //use switchBounceRange
        if (incomingInv >= this.switchBounceDirection.degrees)
            return this.switchBounceDirection.degrees - (this.switchBounceDirection.degrees - this.bounceRange.min.degrees) * (incomingInv - this.switchBounceDirection.degrees) / (this.bounceRange.max.degrees - this.switchBounceDirection.degrees);
        else if (incomingInv < this.switchBounceDirection.degrees)
            return this.switchBounceDirection.degrees + (this.bounceRange.max.degrees - this.switchBounceDirection.degrees) * (this.switchBounceDirection.degrees - incomingInv) / (this.switchBounceDirection.degrees - this.bounceRange.min.degrees);
    }
    throw new Error("Could not determine rawBounceAngle");
}

function incrementSwitchBounceDirection() {
    if (this.switchCounter >= this.switchRatio) {
        this.switchCounter -= this.switchRatio;
        this.switchBounceDirection = this.primaryBounceDirection;
    } else {
        this.switchCounter++;
        if (this.switchCounter >= this.switchRatio)
            this.switchBounceDirection = this.secondaryBounceDirection;
    }
}

function useRawBounceAngleOnly(ball) { //for board edges, directional blocks, and solid directional blocks in certain cases
    return this.rawBounceAngle(ball.direction);
}


Surface.prototype.bounceAngle = modifiedNearCornerBlockBounce; //default for surfaces is modifiedNearCornerBlockBounce, since that is used the most often

function modifiedNearCornerBlockBounce(ball) {
    //for standard blocks.  Causes bounces near a corner to gradually start bouncing towards the direction the surface on the other side of the corner, as they get closer to the corner
    if (this.bounceRange.inRange(ball.direction.degrees) && !(this.point1.equalTo(ball) || this.point2.equalTo(ball))) {
        if (this.bounceRange.inRange(ball.direction.degrees, false, false, false)) { // min/maxInclusive = false rules out that the ball isn't coming in at exactly the edge of the range (aka same angle as the surface itself)
            console.log("ERROR!  Ball got inside of a block!  BALL ID: " + ball.id);
            console.log(this);
            console.log(ball);
            ball.insideBlock = 5;
            ball.warning += 50;
            //board.engine.slowDown();
            ball.draw(ball.board.context, RED);
            Engine.terminate(this.block.board.engine.nextFrame, true, false);
        } else {
            console.log("Ball came in at exactly the edge of the bounce range!  BALL ID: " + ball.id);
            ball.warning += 10;
            board.engine.slowDown();
        }
        return ball.direction;
    }

    let rawBounceAngle = this.rawBounceAngle(ball.direction);
    if (rawBounceAngle.incomingAngle) rawBounceAngle = ball.direction.degrees;
    let distance = undefined;

    if ((distance = Math.min(this.point1.distanceTo(ball), this.point1.distanceTo(ball.newPosition)) / ball.radius) <= 1) {
        if (Math.min(this.point2.distanceTo(ball), this.point2.distanceTo(ball.newPosition)) < ball.radius) throw new Error("Ball radius too big for the block surface!");
        var corner = this.corner1;
    } else if ((distance = Math.min(this.point2.distanceTo(ball), this.point2.distanceTo(ball.newPosition)) / ball.radius) <= 1) {
        corner = this.corner2;
    } else return rawBounceAngle

    if (corner.otherSurface.destroyed) this.constructCornerBounceCache(corner);

    if (corner.bounceRange.undefinedBounceRange) {
        if (corner.otherSurface.bouncePriority <= this.bouncePriority) return rawBounceAngle;
        //otherSurface is an edge or another normal block that is butt-up against this surface.  There is no bounce range because no balls can reach this corner (yet)!
        else throw new Error("Invalid corner bounce range!");
    }

    let bounceAngles = new Array();
    bounceAngles.ratioSum = 0;

    for (let i = 0; i < corner.length; i++) {
        //test the cache for lower-priority bounce angles.  array is sorted from closest to further surface, so start with closest surfaces
        let surface = corner[i].surface;
        if (surface.destroyed) {
            corner.splice(i, 1);
            i--;
            continue;
        }

        let involvedInLastBounce = false;
        ball.bounceLog?.details[0]?.collisionSurfaces.forEach((prevSurface) => {
            if (surface === prevSurface || prevSurface.block === surface.block) involvedInLastBounce = true;
        });
        if (involvedInLastBounce) continue; //only applies to lower-priority surfaces, obviously, since the corner array is strictly lower-priority

        let temp = surface.rawBounceAngle(ball.direction);
        let j = 0
        for (; j < bounceAngles.length; j++) {  //only one surface per block
            if (surface.block === bounceAngles[j].block) {
                if (bounceAngles[j].ratio < temp.ratio || !temp.incomingAngle) { //swap out for the highest ratio from this block, and recalc ratio sum
                    bounceAngles.ratioSum -= bounceAngles.splice(j, 1)[0].ratio;
                } else j = -1;
                break;
            }
        }
        if (j === -1) continue;

        if (temp.incomingAngle) {
            temp.bounceAngle = ball.direction.degrees
            temp.block = surface.block;
            bounceAngles.ratioSum += temp.ratio;
            if (bounceAngles.ratioSum >= 1) temp.ratio -= bounceAngles.ratioSum - 1
        } else {
            temp = {
                bounceAngle: temp,
                ratio: 1 - bounceAngles.ratioSum
            }
            bounceAngles.ratioSum = 1;
        }

        temp.bounceRange = corner[i].bounceRange.undefinedBounceRange ? this.bounceRange : corner[i].bounceRange;
        bounceAngles.push(temp);
        if (bounceAngles.ratioSum >= 1) break;
    }

    if (bounceAngles.ratioSum < 1) {
        let temp = {
            bounceAngle: corner.otherSurface.rawBounceAngle(ball.direction),
            bounceRange: corner.bounceRange,
            ratio: 1 - bounceAngles.ratioSum
        }
        if (temp.bounceAngle.incomingAngle) temp.bounceAngle = ball.direction.degrees;
        bounceAngles.push(temp);
    }



    let compositeAngle = rawBounceAngle;
    bounceAngles.ratioSum = 1;
    let i = 0;
    if (bounceAngles.length > 0) {
        for (; i < bounceAngles.length; i++) { //cumulative weighted average
            compositeAngle = (bounceAngles[i].bounceRange.transform(bounceAngles[i].bounceAngle) * bounceAngles[i].ratio + bounceAngles[i].bounceRange.transform(compositeAngle) * bounceAngles.ratioSum) / (bounceAngles.ratioSum += bounceAngles[i].ratio);
            bounceAngles[i].result = compositeAngle;
        }
    } else {
        otherRawBounceAngle = bounceAngles.primaryBounceAngle;
    }
    i--;

    rawBounceAngle = corner.bounceRange.transform(rawBounceAngle);
    compositeAngle = corner.bounceRange.transform(this.bounceRange.bind(compositeAngle)); //bind the composite angle to the surface's bounceRange, then transform it back into the corner actual bounce range

    let result = rawBounceAngle * distance + compositeAngle * (1 - distance);
    if (!Number.isFinite(result)) throw new Error("modifiedNearCornerBlockBounce was not able to find a valid result.");

    bounceAngles.result = result;
    bounceAngles.thisSurface = this;
    bounceAngles.thisCorner = corner;
    ball.bounceLog.current.cornerAdjustments.push(bounceAngles);

    return result;

}

Surface.prototype.constructCornerBounceCache = function (thisCorner) {
    let clockwise;
    if (thisCorner === this.corner1) {
        clockwise = true; //clockwise
    } else if (thisCorner === this.corner2) {
        clockwise = false; //counterclockwise
    } else {
        console.log(thisCorner);
        throw new Error("Invalid corner submitted to constructCornerBounceCache ");
    }

    let adjacentSurfaces = LineCache.getAllSurfacesAt(thisCorner.point);

    let otherSurface = undefined;
    let otherCorner = undefined;
    let closestSurfaceAngle; //for the priority surface, with angle transformed into this corner's angleRange
    let tempCorner = undefined;
    let tempSurfaceAngle = undefined;

    let repeatWithOtherPoint = false;
    let unexpectedRedundantSurface = false;
    let lowerPrioritySurfaces = new Array();

    for (let i = 0; i < adjacentSurfaces.length || repeatWithOtherPoint; i++) { //find nearest surface in the direction indicated by otherSurfaceDirection
        //let tempSurfaceAngle = undefined;

        if (repeatWithOtherPoint) {
            i--;
            tempCorner = adjacentSurfaces[i].corner2;
            repeatWithOtherPoint = false;
        } else if (adjacentSurfaces[i] === this) { continue;          //ignore if it is this surface
        } else if (adjacentSurfaces[i].point1.equalTo(thisCorner.point)) {
            tempCorner = adjacentSurfaces[i].corner1;
        } else if (adjacentSurfaces[i].point2.equalTo(thisCorner.point)) {
            tempCorner = adjacentSurfaces[i].corner2;
        } else { //surfaces that don't have a corner here (e.g. edges.  larger blocks)
            tempCorner = adjacentSurfaces[i].corner1;
            repeatWithOtherPoint = true;
        }

        tempSurfaceAngle = thisCorner.blockRange.transform(tempCorner.surfaceAngle);

        if (tempSurfaceAngle === thisCorner.surfaceAngle) {
            if (adjacentSurfaces[i].bouncePriority > this.bouncePriority) continue; //ignore surfaces of lower priority at the same angle as this surface
            // this will most likely result in an undefined range.  May just want to cut to the chase here?
        } else if (adjacentSurfaces[i].bouncePriority > this.bouncePriority) {
            lowerPrioritySurfaces.push({
                corner: tempCorner,
                surface: adjacentSurfaces[i],
                surfaceAngle: tempSurfaceAngle
            });
            continue;
        }



        if (clockwise) { //looking for nearest clockwise surface
            while (tempSurfaceAngle > thisCorner.surfaceAngle) { tempSurfaceAngle -= 360; console.log("unexpected result in modifiedNearCornerBlockBounce... cornerAngleRange did not correctly transform surface angle"); }
            if (tempSurfaceAngle < closestSurfaceAngle) continue;
            else if (!Number.isFinite(tempSurfaceAngle)) throw new Error("invalid surface angle in one of the adjacent surfaces!");
        } else { //looking for nearest counterclockwise surface
            while (tempSurfaceAngle < thisCorner.surfaceAngle) { tempSurfaceAngle += 360; console.log("unexpected result in modifiedNearCornerBlockBounce... cornerAngleRange did not correctly transform surface angle"); }
            if (tempSurfaceAngle > closestSurfaceAngle) continue;
            else if (!Number.isFinite(tempSurfaceAngle)) throw new Error("invalid surface angle in one of the adjacent surfaces!");
        }

        if (tempSurfaceAngle === closestSurfaceAngle) {
            if (adjacentSurfaces[i].bouncePriority > otherSurface.bouncePriority) continue;
            else if (adjacentSurfaces[i].bouncePriority === otherSurface.bouncePriority) {
                unexpectedRedundantSurface = true;
                continue;
            }
        } else unexpectedRedundantSurface = false;
        otherCorner = tempCorner;
        otherSurface = adjacentSurfaces[i];
        closestSurfaceAngle = tempSurfaceAngle;
    }

    if (unexpectedRedundantSurface) console.log("unexpected result in modifiedNearCornerBlockBounce... two surfaces of same priority");
    if (otherSurface === undefined || otherCorner === undefined) throw new Error("could not find the nearest surface!!");

    if (clockwise) { //sort the lower priority surfaces from closest to furthest from this surface
        lowerPrioritySurfaces.sort((surface1, surface2) => {
            while (surface1.surfaceAngle > thisCorner.surfaceAngle) { surface1.surfaceAngle -= 360; console.log("unexpected result in modifiedNearCornerBlockBounce... cornerAngleRange did not correctly transform surface angle or there is a stray surface in the middle of the block!"); }
            while (surface2.surfaceAngle > thisCorner.surfaceAngle) { surface2.surfaceAngle -= 360; console.log("unexpected result in modifiedNearCornerBlockBounce... cornerAngleRange did not correctly transform surface angle or there is a stray surface in the middle of the block!"); }
            return surface1.surfaceAngle > surface2.surfaceAngle ? -1 : surface1.surfaceAngle < surface2.surfaceAngle ? 1 : surface1.surfaceAngle === surface2.surfaceAngle ?
                0 : undefined;
            //how to deal with equal surfaces?  the one whose block is closer should go first... need to figure out how to determine that
        });
    } else {
        lowerPrioritySurfaces.sort((surface1, surface2) => {
            while (surface1.surfaceAngle < thisCorner.surfaceAngle) { surface1.surfaceAngle += 360; console.log("unexpected result in modifiedNearCornerBlockBounce... cornerAngleRange did not correctly transform surface angle or there is a stray surface in the middle of the block!"); }
            while (surface2.surfaceAngle < thisCorner.surfaceAngle) { surface2.surfaceAngle += 360; console.log("unexpected result in modifiedNearCornerBlockBounce... cornerAngleRange did not correctly transform surface angle or there is a stray surface in the middle of the block!"); }
            return surface1.surfaceAngle < surface2.surfaceAngle ? -1 : surface1.surfaceAngle > surface2.surfaceAngle ? 1 : surface1.surfaceAngle === surface2.surfaceAngle ?
                0 : undefined;
            //how to deal with equal surfaces?  the one whose block is closer should go first...
        });
    }

    if (otherSurface === thisCorner.sameBlockOtherSurface) { //the actual corner bounce range is also the block's corner bounce range (meaning there are no other priority surfaces between the two same-block adjacent surfaces)
        thisCorner.bounceRange = thisCorner.blockRange;
    } else {  //construct corner bounce range with these two surfaces
        thisCorner.bounceRange = constructCornerBounceRange(this, thisCorner.surfaceAngle, otherSurface, closestSurfaceAngle); //could also use otherSurface.surface angle instead of closestSurfaceAngle.  same angle, but may be transformed differently
    }
    thisCorner.otherCorner = otherCorner;
    thisCorner.otherSurface = otherSurface;
    thisCorner.otherSurfaceAngle = closestSurfaceAngle;
    thisCorner.length = 0;
    for (let i = 0; i < lowerPrioritySurfaces.length; i++) {
        if (  clockwise  ?  (lowerPrioritySurfaces[i].inRange = (lowerPrioritySurfaces[i].surfaceAngle > thisCorner.otherSurfaceAngle))
                         :  (lowerPrioritySurfaces[i].inRange = (lowerPrioritySurfaces[i].surfaceAngle < thisCorner.otherSurfaceAngle))
        ) {
            lowerPrioritySurfaces[i].bounceRange = constructCornerBounceRange(this, thisCorner.surfaceAngle, lowerPrioritySurfaces[i].surface, lowerPrioritySurfaces[i].surfaceAngle);
            thisCorner.push(lowerPrioritySurfaces[i]);
        }
    }

    if (otherCorner instanceof Array && otherSurface.bouncePriority === this.bouncePriority) { //directional blocks and edges don't have arrays
        otherCorner.otherCorner = thisCorner;
        otherCorner.bounceRange = thisCorner.bounceRange;
        otherCorner.otherSurface = this;
        otherCorner.otherSurfaceAngle = otherCorner.blockRange.transform(thisCorner.surfaceAngle);
        otherCorner.length = 0;
        for (let i = lowerPrioritySurfaces.length - 1; i >= 0; i--) {
            if (lowerPrioritySurfaces[i].inRange) {
                delete lowerPrioritySurfaces[i].inRange;
                otherCorner.push({ //make a shallow copy of the object, and construct bounce range for otherSurface and the current lower priority surface
                    surface: lowerPrioritySurfaces[i].surface,
                    corner: lowerPrioritySurfaces[i].surface,
                    surfaceAngle: otherCorner.blockRange.transform(lowerPrioritySurfaces[i].surfaceAngle),
                    bounceRange: constructCornerBounceRange(otherSurface, otherCorner.surfaceAngle, lowerPrioritySurfaces[i].surface, otherCorner.blockRange.transform(lowerPrioritySurfaces[i].surfaceAngle))
                });
            }
        }
    }

}

initializeLogger?.("surface ran");