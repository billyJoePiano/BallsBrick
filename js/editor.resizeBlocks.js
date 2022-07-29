"use strict"; document.currentScript.initTime = performance.now();

BoardEditor.select.resize = {
    getAlphas: function (event) { return { "blocks": 0.4, "selectedBlocks": 0.5, "oldDisplacedBlocks": 0.6, "resizingBlock": 0.8, "displacedBlocks": 1 } }
    ,
    initializeSubMode: function (event, surfaceOrCorner) {
        this.resizingObject = surfaceOrCorner;
        this.oldDisplacedBlocks = this.displacedBlocks;
        this.displacedBlocks = [];

        this.resizingBlock = [surfaceOrCorner.block];

        let nearestPoint;
        if (surfaceOrCorner instanceof Surface)
            nearestPoint = surfaceOrCorner.nearestPointTo(this.pointerFlags.position);
        else if (surfaceOrCorner.isCorner)
            nearestPoint = surfaceOrCorner.point;
        else throw new Error();

        this.pointerFlags.position.updateFromPosition(nearestPoint);
        this.pointerFlags.grabPoint.updateFromCoordinates(0, 0);
        this.adjustBlockPointerPosition();
        this.pointerFlags.grabPoint.x = nearestPoint.x - this.pointerFlags.blockPosition.x;
        this.pointerFlags.grabPoint.y = nearestPoint.y - this.pointerFlags.blockPosition.y;

        surfaceOrCorner.block.initiateResize(event, surfaceOrCorner, this);

        if (surfaceOrCorner.block.lineOfMotion) {
            this.drawMain = this.draw;
            this.draw = (context = this.context) => {
                this.drawMain(context);
                this?.drawLineOfMotion(context);
            }
        }
    }
    ,
    leaveSubMode: function (event, arg) {
        this.displacedBlocks = this.oldDisplacedBlocks;

        delete this.resizingBlock;
        delete this.resizingObject;
        delete this.oldDisplacedBlocks;
        delete this.resizeCurrentBlock;
        if (this.drawMain) {
            this.draw = this.drawMain;
            delete this.drawMain;
        }
    }
    ,
    pointerMoved: function (event) {
        if (this.pointerFlags.position.notDefined && Number.isFinite(event.offsetX) && Number.isFinite(event.offsetY)) {
            this.pointerFlags.position.x = Math.min(Math.max(event.offsetX, this.boardTemplate.x), this.boardTemplate.x + this.boardTemplate.width);
            this.pointerFlags.position.y = Math.min(Math.max(event.offsetY, this.boardTemplate.y), this.boardTemplate.y + this.boardTemplate.height);
        }
        if (this.adjustBlockPointerPosition()) {
            this.resizingBlock[0].resize(event, this.resizingObject, this);
            this.findDisplaced(this.resizingBlock);
            //need to filter the displaced array here
            this.draw();
        }

        //this.aspect();
    }
    ,
    pointerEvent: function (event) {
        if (this.pointerFlags.depressedAndOver) {
            if (this.pointerFlags.position.defined) this.pointerMoved(event);
        } else if (this.pointerFlags.depressed) {
            if (!this.pointerFlags.cancelPossible || this.pointerFlags.position.defined) throw new Error("contradiction in pointerFlags!?");
            if (this.pointerFlags.position.defined) this.pointerMoved(event);
        } else { //pointer was released off-board
            this.click(event);
        }
        this.draw();
    }
    ,
    esc: function (event) {
        /*if (event.type === "keydown")*/ this.escapeFromClick();
        this.pointerFlags.grabPoint.updateFromCoordinates(undefined, undefined);
        this.resizingBlock[0].cancelResize(event, this.resizingObject, this);

        this.setSubMode(BoardEditor.select.resting, event);
    }
    ,
    click: function (event) {
        this.hasUpdates = true;

        this.pointerMoved(event);
        if (this.pointerFlags.position.defined)
            this.resizingBlock[0].finalizeResize(event, this.resizingObject, this);
        else throw new Error();

        if (event.shiftKey && this.displacedBlocks.length > 0) {
            this.setSubMode(BoardEditor.addBlocks, event, this.recycleBlocks());

        } else {
            this.pointerFlags.grabPoint.updateFromCoordinates(undefined, undefined);
            this.setSubMode(BoardEditor.select.resting, event);
        }
        this.draw();
    }
,
    drawLineOfMotion: function(context = this.context) {
        context.beginPath();
        context.fillStyle = WHITE.string;
        context.arc(this.resizingBlock[0].lineOfMotion.originalGrabPoint.x, this.resizingBlock[0].lineOfMotion.originalGrabPoint.y, 3, 0, TWO_PI);
        context.fill();
        context.beginPath();
        context.fillStyle = GREEN.string;
        context.arc(this.resizingBlock[0].lineOfMotion.blockPointerPosition.x, this.resizingBlock[0].lineOfMotion.blockPointerPosition.y, 3, 0, TWO_PI);
        context.fill();
        context.beginPath();
        context.fillStyle = RED.string;
        context.arc(this.pointerFlags.blockPosition.x, this.pointerFlags.blockPosition.y, 3, 0, TWO_PI);
        context.fill();

        let points = new Array(6);
        points[0] = this.resizingBlock[0].lineOfMotion.pointFromX(this.boardTemplate.x);
        points[1] = this.resizingBlock[0].lineOfMotion.pointFromX(this.boardTemplate.x + this.boardTemplate.width);
        points[2] = this.resizingBlock[0].lineOfMotion.pointFromY(this.boardTemplate.y);
        points[3] = this.resizingBlock[0].lineOfMotion.pointFromY(this.boardTemplate.y + this.boardTemplate.height);

        for (let i = 0; i < 4; i++) {
            if (points[i] && !this.boardTemplate.rectangle.inside(points[i].x, points[i].y, false)) {
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
        context.strokeStyle = GREEN.toString();
        context.lineWidth = 1;
        context.setLineDash([6, 6])
        context.moveTo(points[4].x, points[4].y);
        context.lineTo(points[5].x, points[5].y);
        context.stroke();

    }
}

Block.prototype.resizeCursorStyle = function(event, surfaceOrCorner, boardEditor) {
    if (surfaceOrCorner instanceof Surface) {
        return Block.directionToCursorStyle(surfaceOrCorner.corner1.surfaceAngle + 90);

    } else if (surfaceOrCorner.isCorner) {
        if (surfaceOrCorner.sameBlockOtherSurface.point1 === surfaceOrCorner.point)
            return Block.directionToCursorStyle(Angle.acuteMidpoint(surfaceOrCorner.surfaceAngle, surfaceOrCorner.sameBlockOtherSurface.corner1.surfaceAngle));
        else if (surfaceOrCorner.sameBlockOtherSurface.point2 === surfaceOrCorner.point)
            return Block.directionToCursorStyle(Angle.acuteMidpoint(surfaceOrCorner.surfaceAngle, surfaceOrCorner.sameBlockOtherSurface.corner2.surfaceAngle))
    }

    throw new Error("Block.resizeCursorStyle could not recognize return value from editor.findGrabObject -- in select mode, resting subMode");
}

Block.directionToCursorStyle = function (direction) {
    if (direction instanceof Angle) direction = direction.degrees % 180

    if (Number.isFinite(direction)) direction %= 180;
    else throw new Error();

    if (direction < 0) direction += 180;

    if (direction < 30 || direction > 150) return "ew-resize";
    else if (direction <= 60) return "nesw-resize";
    else if (direction < 120) return "ns-resize";
    else if (direction <= 150) return "nwse-resize";
    else throw new Error("invalid cursor arrow direction");
}

Block.prototype.initiateResize = function (event, surfaceOrCorner, boardEditor) {
    this.oldPoints = new Array(this.surfaces.length);
    this.surfaces.forEach((surface, index) => { this.oldPoints[index] = surface.point1.copy(); });
    this.oldPoints.x = this.x;
    this.oldPoints.y = this.y;
    this.oldPoints.width = this.width;
    this.oldPoints.height = this.height;
    this.oldPoints.minSize = (boardEditor.snapSpacing > 0) ? Math.max(boardEditor.snapSpacing, Math.ceil(boardEditor.resizeGrabMargin * 3 / boardEditor.snapSpacing) * boardEditor.snapSpacing) : (Math.max(boardEditor.resizeGrabMargin, 1) * 3);
}

Block.prototype.finalizeResize = function (event, surfaceOrCorner, boardEditor) {
    this.resize(event, surfaceOrCorner, boardEditor);
    this.surfaces.forEach((surface) => {
        this.bounceProperties.apply(surface);
    });
    delete this.oldPoints;
}

Block.prototype.cancelResize = function (event, surfaceOrCorner, boardEditor) {
    this.surfaces.forEach((surface, index) => { surface.point1.updateFromPosition(this.oldPoints[index]); });
    this.rectangle.updateFromRectangle(this.oldPoints);
    this.recenter();
    delete this.oldPoints;
}


SimpleRectangleBlock.prototype.resize = function(event, surfaceOrCorner, boardEditor) {
    let index;
    if (surfaceOrCorner instanceof Surface)
        index = this.surfaces.indexOf(surfaceOrCorner);
    else if (surfaceOrCorner.isCorner)
        index = this.surfaces.indexOf(surfaceOrCorner.thisSurface);
    else throw new Error();

    let position = boardEditor.pointerFlags.blockPosition;
    while (index > -1) {
        switch (index) {
            case 0: if (position.x <= this.surfaces[2].point1.x - this.oldPoints.minSize) {
                this.surfaces[0].point1.x = position.x;
                this.surfaces[0].point2.x = position.x;
            } else {
                this.surfaces[0].point1.x = this.surfaces[2].point1.x - this.oldPoints.minSize; 
                this.surfaces[0].point2.x = this.surfaces[2].point1.x - this.oldPoints.minSize;
            }
            break;

            case 1: if (position.y >= this.surfaces[3].point1.y + this.oldPoints.minSize) {
                this.surfaces[1].point1.y = position.y;
                this.surfaces[1].point2.y = position.y;
            } else {
                this.surfaces[1].point1.y = this.surfaces[3].point1.y + this.oldPoints.minSize;
                this.surfaces[1].point2.y = this.surfaces[3].point1.y + this.oldPoints.minSize;
            }
            break;

            case 2: if (position.x >= this.surfaces[0].point1.x + this.oldPoints.minSize) {
                this.surfaces[2].point1.x = position.x;
                this.surfaces[2].point2.x = position.x;
            } else {
                this.surfaces[2].point1.x = this.surfaces[0].point1.x + this.oldPoints.minSize;
                this.surfaces[2].point2.x = this.surfaces[0].point1.x + this.oldPoints.minSize;
            }
            break;

            case 3: if (position.y <= this.surfaces[1].point1.y - this.oldPoints.minSize) {
                this.surfaces[3].point1.y = position.y;
                this.surfaces[3].point2.y = position.y;
            } else {
                this.surfaces[3].point1.y = this.surfaces[1].point1.y - this.oldPoints.minSize;
                this.surfaces[3].point2.y = this.surfaces[1].point1.y - this.oldPoints.minSize;
            }
            break;

            default: throw new Error();
        }
        if (surfaceOrCorner.isCorner) {
            if (index === (index = this.surfaces.indexOf(surfaceOrCorner.sameBlockOtherSurface))) {
                index = undefined;
                surfaceOrCorner.thisSurface.recalc();
                surfaceOrCorner.sameBlockOtherSurface.recalc();
            }
        } else {
            index = undefined;
            surfaceOrCorner.recalc();
        }
    }

    this.rectangle.updateFromRectangle(Block.findRectangleBounds(this.surfaces));
    this.recenter();
}

ShapedBlock.prototype.resizeCursorStyle = function (event, surfaceOrCorner, boardEditor) {
    let grabPoint;
    if (surfaceOrCorner instanceof Surface) grabPoint = surfaceOrCorner.nearestPointTo(boardEditor.pointerFlags.position);
    else if (surfaceOrCorner.isCorner) grabPoint = surfaceOrCorner.point.copy();
    else throw new Error();

    let lineOfMotion = this.lineOfMotionPreReqs(event, surfaceOrCorner, boardEditor, grabPoint);
    if (lineOfMotion instanceof Line) {
        return Block.directionToCursorStyle(lineOfMotion.angle());
    } else {
        return Block.prototype.resizeCursorStyle.call(this, event, surfaceOrCorner, boardEditor);
    }
}


ShapedBlock.prototype.initiateResize = function(event, surfaceOrCorner, boardEditor) {
    Block.prototype.initiateResize.call(this, event, surfaceOrCorner, boardEditor); //equivilent of 'super.initiateResize', but can't do that since this isn't inside the class declaration

    let originalGrabPoint;
    if (surfaceOrCorner instanceof Surface) originalGrabPoint = surfaceOrCorner.nearestPointTo(boardEditor.pointerFlags.blockPosition);
    else if (surfaceOrCorner.isCorner) originalGrabPoint = surfaceOrCorner.point.copy();
    else throw new Error();

    boardEditor.pointerFlags.position.updateFromPosition(originalGrabPoint);
    boardEditor.pointerFlags.grabPoint.updateFromCoordinates(0, 0);
    boardEditor.adjustBlockPointerPosition();
    boardEditor.pointerFlags.grabPoint.x = originalGrabPoint.x - boardEditor.pointerFlags.blockPosition.x;
    boardEditor.pointerFlags.grabPoint.y = originalGrabPoint.y - boardEditor.pointerFlags.blockPosition.y;

    let lineOfMotion = this.lineOfMotion = this.lineOfMotionPreReqs(event, surfaceOrCorner, boardEditor, originalGrabPoint);
    let previous = lineOfMotion.previous;
    let next = lineOfMotion.next;

    if (lineOfMotion instanceof Line) {

        originalGrabPoint = lineOfMotion.originalGrabPoint ?? (lineOfMotion.originalGrabPoint = originalGrabPoint);
        lineOfMotion.blockPointerPosition = originalGrabPoint.copy();
        lineOfMotion.previousLine = new Line(previous.point1, previous.point2);
        lineOfMotion.nextLine = new Line(next.point1, next.point2);

        if (surfaceOrCorner instanceof Surface) {
            lineOfMotion.surfacePrimarySlope = surfaceOrCorner.primarySlope(surfaceOrCorner);
            lineOfMotion.surfaceUsesInvSlope = surfaceOrCorner.primarySlope === slope_invSlope;
            lineOfMotion.point1offset = new Position(surfaceOrCorner.point1.x - originalGrabPoint.x, surfaceOrCorner.point1.y - originalGrabPoint.y);
            lineOfMotion.point2offset = new Position(surfaceOrCorner.point2.x - originalGrabPoint.x, surfaceOrCorner.point2.y - originalGrabPoint.y);

        } else if (surfaceOrCorner.isCorner) {
            lineOfMotion.prevPrevLine = new Line(previous.previous.point1, previous.previous.point2);
            lineOfMotion.nextNextLine = new Line(next.next.point1, next.next.point2);

        } else throw new Error();

        lineOfMotion.previousPrimaryFunc = lineOfMotion.previous.primaryCoordinate; //need to preserve in case subsequent recalcs cause this to change
        if (previous.primaryCoordinate(previous.point1) < previous.primaryCoordinate(previous.point2))
            lineOfMotion.checkPrevious = () => { return this.lineOfMotion.previousPrimaryFunc(this.lineOfMotion.previous.point1) < this.lineOfMotion.previousPrimaryFunc(this.lineOfMotion.previous.point2); }
        else if (previous.primaryCoordinate(previous.point1) > previous.primaryCoordinate(previous.point2))
            lineOfMotion.checkPrevious = () => { return this.lineOfMotion.previousPrimaryFunc(this.lineOfMotion.previous.point1) > this.lineOfMotion.previousPrimaryFunc(this.lineOfMotion.previous.point2); }
        else throw new Error();

        lineOfMotion.nextPrimaryFunc = lineOfMotion.next.primaryCoordinate; //need to preserve in case subsequent recalcs cause this to change
        if (next.primaryCoordinate(next.point1) < next.primaryCoordinate(next.point2))
            lineOfMotion.checkNext = () => { return this.lineOfMotion.nextPrimaryFunc(this.lineOfMotion.next.point1) < this.lineOfMotion.nextPrimaryFunc(this.lineOfMotion.next.point2); }
        else if (next.primaryCoordinate(next.point1) > next.primaryCoordinate(next.point2))
            lineOfMotion.checkNext = () => { return this.lineOfMotion.nextPrimaryFunc(this.lineOfMotion.next.point1) > this.lineOfMotion.nextPrimaryFunc(this.lineOfMotion.next.point2); }
        else throw new Error();
    } else throw new Error();
}

ShapedBlock.prototype.resize = function (event, surfaceOrCorner, boardEditor) {
    this.lineOfMotion.blockPointerPosition = this.lineOfMotion.nearestPointTo(boardEditor.pointerFlags.blockPosition);

    let oldP1;
    let oldP2;
    let oldC;

    this.checkSurfaces(surfaceOrCorner);

    if (surfaceOrCorner instanceof Surface) {
        oldP1 = surfaceOrCorner.point1.copy();
        oldP2 = surfaceOrCorner.point2.copy();

        let surfaceLine = this.getSurfaceLine?.(event, surfaceOrCorner, boardEditor)
        this.updateSurfacePoint1(event, surfaceOrCorner, boardEditor, surfaceLine);
        this.updateSurfacePoint2(event, surfaceOrCorner, boardEditor, surfaceLine);

    } else if (surfaceOrCorner.isCorner) {
        oldC = surfaceOrCorner.point.copy();
        oldP1 = surfaceOrCorner.sameSurfaceOtherCorner.point.copy();
        oldP2 = surfaceOrCorner.sameBlockOtherCorner.sameSurfaceOtherCorner.point.copy();

        this.updateCornerPoint(event, surfaceOrCorner, boardEditor);
        this.updatePreviousCorner?.(event, surfaceOrCorner, boardEditor);
        this.updateNextCorner?.(event, surfaceOrCorner, boardEditor);

    } else throw new Error();

    if (!oldP1?.defined || !oldP2?.defined || !(oldC?.defined ?? true)) throw new Error();

    this.recalcAndCheckSurfacesAfterResize(event, surfaceOrCorner, boardEditor, oldP1, oldP2, oldC);
}

ShapedBlock.prototype.finalizeResize = function (event, surfaceOrCorner, boardEditor) {
    Block.prototype.finalizeResize.call(this, event, surfaceOrCorner, boardEditor); //like calling 'super.finalizeResize' but outside of the class declaration
    delete this.lineOfMotion;
    this.surfaceResizeFunctions = resizeFunctions.surfaces.allNull;
    this.cornerResizeFunctions = resizeFunctions.corners.allNull;
}

ShapedBlock.prototype.cancelResize = function (event, surfaceOrCorner, boardEditor) {
    Block.prototype.cancelResize.call(this, event, surfaceOrCorner, boardEditor); //like calling super.cancelResize  etc
    delete this.lineOfMotion;
    this.surfaceResizeFunctions = resizeFunctions.surfaces.allNull;
    this.cornerResizeFunctions = resizeFunctions.corners.allNull;
}

ShapedBlock.prototype.lineOfMotionPreReqs = function (event, surfaceOrCorner, boardEditor, grabPoint) {
    let previous;
    let next;
    if (surfaceOrCorner instanceof Surface) {
        if (this.customResizeFunctions)
            this.surfaceResizeFunctions = this.customResizeFunctions.surfaces?.[this.surfaces.indexOf(surfaceOrCorner)];

        previous = surfaceOrCorner.previous;
        next = surfaceOrCorner.next;

    } else if (surfaceOrCorner.isCorner) {
        if (this.customResizeFunctions)
            this.cornerResizeFunctions = this.customResizeFunctions.corners?.[this.surfaces.indexOf(surfaceOrCorner.point === surfaceOrCorner.thisSurface.point1 ? surfaceOrCorner.thisSurface : surfaceOrCorner.sameBlockOtherSurface)];

        if (surfaceOrCorner.sameBlockOtherSurface.previous === surfaceOrCorner.thisSurface) {
            previous = surfaceOrCorner.thisSurface;
            next = surfaceOrCorner.sameBlockOtherSurface;

        } else if (surfaceOrCorner.sameBlockOtherSurface.next === surfaceOrCorner.thisSurface) {
            previous = surfaceOrCorner.sameBlockOtherSurface;
            next = surfaceOrCorner.thisSurface;

        } else throw new Error();
    }

    let lineOfMotion = this.getLineOfMotion?.(event, surfaceOrCorner, boardEditor, grabPoint, previous, next);

    if (lineOfMotion) {
        lineOfMotion.previous = previous;
        lineOfMotion.next = next;
        return lineOfMotion;

    } else return { next: next, previous: previous };
}

ShapedBlock.prototype.recalcAndCheckSurfacesAfterResize = function (event, surfaceOrCorner, boardEditor, oldP1, oldP2, oldC) {
    let surfacesCross = !(this.lineOfMotion.checkPrevious() && this.lineOfMotion.checkNext())

    for (let i = 0; i < this.surfaces.length; i++) { //compare every surface against every other surface for an intersection (other than a shared point)
        if (surfacesCross) break;
        let surface1 = this.surfaces[i];
        if (i === 0) { //recalc every surface on the first pass
            if (surface1.point1.equalTo(surface1.point2) || surface1.length() < this.oldPoints.minSize) {
                surfacesCross = true;
                break;
            } else surface1.recalc();
        }

        for (let j = i + 1; j < this.surfaces.length; j++) {
            let surface2 = this.surfaces[j];
            if (i === 0) { //recalc every surface on the first pass
                if (surface2.point1.equalTo(surface2.point2) || surface2.length() < this.oldPoints.minSize) {
                    surfacesCross = true;
                    break;
                } else surface2.recalc();
            }

            if (surface1.intersectionWith(surface2, surface1.previous !== surface2, surface1.next !== surface2, surface2.previous !== surface1, surface2.next !== surface1)) {
                surfacesCross = true;
                break;
            }
        }
    }

    if (surfacesCross) {
        if (surfaceOrCorner instanceof Surface) {
            surfaceOrCorner.point1.updateFromPosition(oldP1);
            surfaceOrCorner.point2.updateFromPosition(oldP2);
        } else if (surfaceOrCorner.isCorner) {
            surfaceOrCorner.point.updateFromPosition(oldC);
            surfaceOrCorner.sameSurfaceOtherCorner.point.updateFromPosition(oldP1);
            surfaceOrCorner.sameBlockOtherCorner.sameSurfaceOtherCorner.point.updateFromPosition(oldP2);
        }
        this.surfaces.forEach((surface) => surface.recalc());

    } else {
        this.rectangle.updateFromRectangle(Block.findRectangleBounds(this.surfaces));
        this.recenter();
    }
    this.checkSurfaces(surfaceOrCorner);
}

ShapedBlock.prototype.checkSurfaces = function (surfaceOrCorner) {
    this.surfaces.forEach((surface) => {
        if (surface.point1.equalTo(surface.point2)) throw new Error();
        if (surfaceOrCorner instanceof Surface) {
            if (surface.point1 !== surfaceOrCorner.point1 && surface.point1.equalTo(surfaceOrCorner.point1)) throw new Error();
            if (surface.point1 !== surfaceOrCorner.point2 && surface.point1.equalTo(surfaceOrCorner.point2)) throw new Error();
            if (surface.point2 !== surfaceOrCorner.point1 && surface.point2.equalTo(surfaceOrCorner.point1)) throw new Error();
            if (surface.point2 !== surfaceOrCorner.point2 && surface.point2.equalTo(surfaceOrCorner.point2)) throw new Error();

        } else if (surfaceOrCorner.isCorner) {
            if (surface.point1 !== surfaceOrCorner.point                                             && surface.point1.equalTo(surfaceOrCorner.point))                                              throw new Error();
            if (surface.point1 !== surfaceOrCorner.sameSurfaceOtherCorner.point                      && surface.point1.equalTo(surfaceOrCorner.sameSurfaceOtherCorner.point))                       throw new Error();
            if (surface.point1 !== surfaceOrCorner.sameBlockOtherCorner.sameSurfaceOtherCorner.point && surface.point1.equalTo(surfaceOrCorner.sameBlockOtherCorner.sameSurfaceOtherCorner.point))  throw new Error();
            if (surface.point2 !== surfaceOrCorner.point                                             && surface.point2.equalTo(surfaceOrCorner.point))                                              throw new Error();
            if (surface.point2 !== surfaceOrCorner.sameSurfaceOtherCorner.point                      && surface.point2.equalTo(surfaceOrCorner.sameSurfaceOtherCorner.point))                       throw new Error();
            if (surface.point2 !== surfaceOrCorner.sameBlockOtherCorner.sameSurfaceOtherCorner.point && surface.point2.equalTo(surfaceOrCorner.sameBlockOtherCorner.sameSurfaceOtherCorner.point))  throw new Error();

        } else throw new Error();
    });
}



function getLineOfMotion_midAngle(event, surfaceOrCorner, boardEditor, originalGrabPoint, previous, next) {
    //uses the midPoint between the angle of the previous line and next line

    let thisAng;
    if (surfaceOrCorner instanceof Surface) {
        thisAng = new Angle(surfaceOrCorner.corner1.surfaceAngle);

    } else if (surfaceOrCorner.isCorner) {
        thisAng = new Angle(Angle.acuteMidpoint(previous.corner1.surfaceAngle, next.corner2.surfaceAngle));

    } else throw new Error();

    let prevAng = thisAng.clockwiseFrom(previous.corner2.surfaceAngle) ? previous.corner1.surfaceAngle : previous.corner2.surfaceAngle; //based on counter-clockwise block construction
    if(surfaceOrCorner instanceof Surface) thisAng.degrees += 180;
    let nextAng = thisAng.counterclockwiseFrom(next.corner1.surfaceAngle) ? next.corner2.surfaceAngle : next.corner1.surfaceAngle; //based on counter-clockwise block construction

    let lineOfMotion = Line.fromPointAndAngle(originalGrabPoint, Angle.acuteMidpoint(prevAng, nextAng));
    lineOfMotion.prevAng = prevAng;
    lineOfMotion.nextAng = nextAng;

    return lineOfMotion;
}

function getLineOfMotion_prevSurfaceLine(event, surfaceOrCorner, boardEditor, grabPoint, previous, next) {
    return new Line(previous.getPrimarySlope(), grabPoint, previous.usesYAsPrimary);
}

function getLineOfMotion_nextSurfaceLine(event, surfaceOrCorner, boardEditor, grabPoint, previous, next) {
    return new Line(next.getPrimarySlope(), grabPoint, next.usesYAsPrimary);
}

function getLineOfMotion_perpToSurface(event, surfaceOrCorner, boardEditor, grabPoint, previous, next) {
    //returns the line perpendicular to the surface if a surface, or the acute midPoint between the two surfaces if a corner
    if (surfaceOrCorner instanceof Surface)
        return surfaceOrCorner.perpLine(grabPoint);
    else if (surfaceOrCorner.isCorner)
        return Line.fromPointAndAngle(grabPoint, Angle.acuteMidpoint(previous.corner1.surfaceAngle, next.corner2.surfaceAngle));
}

function getSurfaceLine_maintainSlope(event, surfaceOrCorner, boardEditor) {
    //used by the updateSurfacePoint?_maintainPrevAngle.  Return a line parallel to the original surface, but which intersects with the current lineOfMotion.blockPointerPosition
    return new Line(this.lineOfMotion.surfacePrimarySlope, this.lineOfMotion.blockPointerPosition, this.lineOfMotion.surfaceUsesInvSlope);
}

function updateSurfacePoint1_maintainPrevAngle(event, surface, boardEditor, surfaceLine) { //maintains same angle of previous line
    surface.point1.updateFromPosition(surfaceLine.intersectionWith(this.lineOfMotion.previousLine));
}

function updateSurfacePoint2_maintainNextAngle(event, surface, boardEditor, surfaceLine) { //maintains same angle of next line
    surface.point2.updateFromPosition(surfaceLine.intersectionWith(this.lineOfMotion.nextLine));
}


//maintains same distance between 'originalGrabPoint' / 'lineOfMotion.blockPointerPosition' and the point.
//point will move in parallel to the line of motion, but this will change the angles of this surface's corner and the previous/next surfaces's subsequent corner (two corners total)
function updateSurfacePoint1_maintainSegmentLength(event, surface, boardEditor, surfaceLine) {
    surface.point1.updateFromCoordinates(   this.lineOfMotion.blockPointerPosition.x + this.lineOfMotion.point1offset.x,
                                            this.lineOfMotion.blockPointerPosition.y + this.lineOfMotion.point1offset.y     );
}

function updateSurfacePoint2_maintainSegmentLength(event, surface, boardEditor, surfaceLine) {
    surface.point2.updateFromCoordinates(   this.lineOfMotion.blockPointerPosition.x + this.lineOfMotion.point2offset.x,
                                            this.lineOfMotion.blockPointerPosition.y + this.lineOfMotion.point2offset.y     );
}


function updateCornerPoint_lineOfMotion_blockPointerPosition(event, corner, boardEditor) {
    corner.point.updateFromPosition(this.lineOfMotion.blockPointerPosition);
}

function updateCornerPoint_freeForm(event, corner, boardEditor) {
    corner.point.updateFromPosition(boardEditor.pointerFlags.blockPosition);
}

//maintains same angle of the previous two lines, and the prevPrev surface remains on the same line (although it's segment length will change)
function updatePreviousCorner_maintainAngles(event, corner, boardEditor) {
    this.lineOfMotion.previousLine = new Line(this.lineOfMotion.previousLine.getPrimarySlope(), corner.point, this.lineOfMotion.previousLine.usesYAsPrimary);
    this.lineOfMotion.previous.point1.updateFromPosition(this.lineOfMotion.previousLine.intersectionWith(this.lineOfMotion.prevPrevLine));
}

//maintains same angle of the next two lines, and the nextNext surface remains on the same line (although it's segment length will change)
function updateNextCorner_maintainAngles(event, corner, boardEditor) {
    this.lineOfMotion.nextLine = new Line(this.lineOfMotion.nextLine.getPrimarySlope(), corner.point, this.lineOfMotion.nextLine.usesYAsPrimary);
    this.lineOfMotion.next.point2.updateFromPosition(this.lineOfMotion.nextLine.intersectionWith(this.lineOfMotion.nextNextLine));
}

const resizeFunctions = {
    surfaces: {
        functionNames: ["getLineOfMotion", "getSurfaceLine", "updateSurfacePoint1", "updateSurfacePoint2"],
        default: {
            getLineOfMotion: getLineOfMotion_midAngle,
            getSurfaceLine: getSurfaceLine_maintainSlope,
            updateSurfacePoint1: updateSurfacePoint1_maintainPrevAngle,
            updateSurfacePoint2: updateSurfacePoint2_maintainNextAngle
        },
        movePerp_maintainSegmentLength: {
            getLineOfMotion: getLineOfMotion_perpToSurface,
            getSurfaceLine: null,
            updateSurfacePoint1: updateSurfacePoint1_maintainSegmentLength,
            updateSurfacePoint2: updateSurfacePoint2_maintainSegmentLength,
        },
        movePerp_maintainAngles: {
            getLineOfMotion: getLineOfMotion_perpToSurface,
            getSurfaceLine: getSurfaceLine_maintainSlope,
            updateSurfacePoint1: updateSurfacePoint1_maintainPrevAngle,
            updateSurfacePoint2: updateSurfacePoint2_maintainNextAngle
        },
        allNull: {
            getLineOfMotion: null,
            getSurfaceLine: null,
            updateSurfacePoint1: null,
            updateSurfacePoint2: null
        }
    }
    ,
    corners: {
        functionNames: ["getLineOfMotion", "updateCornerPoint", "updatePreviousCorner", "updateNextCorner"],
        default: {
            getLineOfMotion: getLineOfMotion_midAngle,
            updateCornerPoint: updateCornerPoint_lineOfMotion_blockPointerPosition,
            updatePreviousCorner: updatePreviousCorner_maintainAngles,
            updateNextCorner: updateNextCorner_maintainAngles
        },
        movePerp_ignoreOtherCorners: {
            getLineOfMotion: getLineOfMotion_perpToSurface,
            updateCornerPoint: updateCornerPoint_lineOfMotion_blockPointerPosition,
            updatePreviousCorner: null,
            updateNextCorner: null
        },
        movePrevSurface_ignoreOtherCorners: {
            getLineOfMotion: getLineOfMotion_prevSurfaceLine,
            updateCornerPoint: updateCornerPoint_lineOfMotion_blockPointerPosition,
            updatePreviousCorner: null,
            updateNextCorner: null
        },
        moveNextSurface_ignoreOtherCorners: {
            getLineOfMotion: getLineOfMotion_nextSurfaceLine,
            updateCornerPoint: updateCornerPoint_lineOfMotion_blockPointerPosition,
            updatePreviousCorner: null,
            updateNextCorner: null
        },
        allNull: {
            getLineOfMotion: null,
            updateCornerPoint: null,
            updatePreviousCorner: null,
            updateNextCorner: null
        }

    }
}

Object.defineProperties(ShapedBlock.prototype, {
    surfaceResizeFunctions: {
        set: function(functions) { installSurfaceResizeFunctions(this, functions) }
    },
    cornerResizeFunctions: {
        set: function (functions) { installCornerResizeFunctions(this, functions) }
    }
});

function installSurfaceResizeFunctions(shapedBlock, functions = {}) {
    resizeFunctions.surfaces.functionNames.forEach((name) => {
        if (functions.hasOwnProperty(name)) shapedBlock[name] = functions[name];
        else shapedBlock[name] = shapedBlock.__proto__[name];
    });
}

function installCornerResizeFunctions(shapedBlock, functions = {}) {
    resizeFunctions.corners.functionNames.forEach((name) => {
        if (functions.hasOwnProperty(name)) shapedBlock[name] = functions[name];
        else shapedBlock[name] = shapedBlock.__proto__[name];
    });
}



ShapedBlock.prototype.surfaceResizeFunctions = resizeFunctions.surfaces.default;
ShapedBlock.prototype.cornerResizeFunctions = resizeFunctions.corners.default;

RightTriangleBlock.prototype.cornerResizeFunctions = resizeFunctions.corners.allNull; //do this first, so that getLineOfMotion = null is overridden
RightTriangleBlock.prototype.surfaceResizeFunctions = resizeFunctions.surfaces.movePerp_maintainSegmentLength;
RightTriangleBlock.prototype.customResizeFunctions = {
    surfaces: [, , resizeFunctions.surfaces.default],
    corners: [resizeFunctions.corners.moveNextSurface_ignoreOtherCorners, resizeFunctions.corners.default, resizeFunctions.corners.movePrevSurface_ignoreOtherCorners]
}

RightTriangleBlock.prototype.resize = function (event, surfaceOrCorner, boardEditor) {
    ShapedBlock.prototype.resize.call(this, event, surfaceOrCorner, boardEditor); //like calling super.resize
    this.points.legLength[0] = this.surfaces[0].length();
    this.points.legLength[1] = this.surfaces[1].length()
}

initializeLogger?.("editor.resizeBlocks ran");