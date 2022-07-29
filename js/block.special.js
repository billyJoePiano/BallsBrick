"use strict"; document.currentScript.initTime = performance.now();

class BombBlock extends SimpleRectangleBlock {
    constructorArgs() { return ["hits", "blastPower", "blastRadius", "x", "y", "width", "height"]; }
    constructor(hits, blastPower, blastRadius, x, y, width, height) {  //, displayText) {
        super(hits, x, y, width, height);
        delete this.color;
        delete this.colorScheme;
        this.blastPower = blastPower;
        this.blastRadius = blastRadius;
        this.blastCenter = new Position(this.x + this.width / 2, this.y + this.height / 2);
        this.text.color = RED.string;

        this.explosionPhysics = this.explosionPhysics.bind(this);
        this.ifEngineTerminates = this.ifEngineTerminates.bind(this);
        this.animateExplosion = this.animateExplosion.bind(this);
        this.rebuildExplosionCache = this.rebuildExplosionCache.bind(this);
        this.animateObscuringVectors = this.animateObscuringVectors.bind(this);
    }

    get blastCounterIncrement() { return BombBlock.blockCounterIncrement; }
    set board(value) {
        value.afterEngineConstruction?.((engine) => { engine.addToQueue("rebuildCaches", this.rebuildExplosionCache) });
        this.brd = value;
    }
    get board() { return this.brd; }

    setNextRoundPositions(pixelsToAdvance = Block.standardSize) {
        this.board.engine.addToQueue("rebuildCaches", this.rebuildExplosionCache);
        return super.setNextRoundPositions(pixelsToAdvance);
    }

    recenter() {
        super.recenter();
        this.blastCenter.updateFromCoordinates(this.x + this.width / 2, this.y + this.height / 2);
    }

    draw(context = this.board.context) {
        context.drawImage(BombBlock.image, 0, 0, BombBlock.image.width, BombBlock.image.height, this.x, this.y, this.width, this.height);
        context.strokeStyle = BLACK.string;
        context.lineWidth = 1;
        context.strokeRect(this.x, this.y, this.width, this.height);
        this.text.draw(context);
    }

    copy(x = this.x, y = this.y, rotateAngle = ANGLE.right) {
        rotateAngle = ANGLE_RANGE_360.default.transform(rotateAngle)
        if (rotateAngle === 0 || rotateAngle === 180 || rotateAngle === -180) {
            return new BombBlock(this.hits, this.blastPower, this.blastRadius, x, y, this.width, this.height)
        } else if (rotateAngle === 90 || rotateAngle === -90) {
            //flip width/height, but maintain the same center point (*not* neccessarily the same origin point, unless it is a square)
            return new BombBlock(this.hits, this.blastPower, this.blastRadius, x, y, x + (this.width - this.height) / 2, y + (this.height - this.width) / 2, this.height, this.width)
        } else {
            /*this.shapedPeer.hits = this.hits;
            this.shapedPeer.color = this.color;
            if (this.colorScheme) this.shapedPeer.colorScheme = this.colorScheme;
            return shapedPeer.copy(x, y, rotateAngle)*/
            throw new Error();
        }
    }

    bounce(ball, surfaces) {
        if (super.bounce(ball, surfaces)) this.explode(ball, surfaces);
    }

    explode(ball, surfaces) {
        ////console.log(this);
        this.text.string = "X";

        this.frame = -1.5;
        this.board.engine.requestAnimation(this.animateExplosion, false, true);

        this.timing = 0;
        this.timingFrameAlignment = new Array()

        this.engineTerminated = (Engine.intervalHandler !== this.board.engine.nextFrame);

        this.blast = new Circle(this.blastCenter, undefined, 0);
        this.blast.maxArea = PI * this.blastRadius ** 2;
        this.blast.maxPowerArea = this.blast.maxArea * this.blastPower;

        this.board.engine.advanceAllBalls();
        this.explosionPhysics(0);

        if (BombBlock.slowMoAnimation) {
            pause();
            restart(20, 0.002);
        }
    }

    ifEngineTerminates(seconds) {
        this.engineTerminated = true;
        this.timeAfterTermination = -seconds;
        this.timeAtTermination = this.timing;
        return this.explosionPhysics(seconds);
    }

    explosionPhysics(seconds) {
        this.timingFrameAlignment.push({ timing: this.timing, frame: this.frame, explosionPhysics: true });
        let x = this.timing - 4;
        x = -(x ** 4) - 2 * x ** 2 - 8 * x + 256;
        let blastRadius = x * this.blastRadius / 261;
        let blastPowerPerSqPx;

        if (blastRadius > 0 || this.timing === 0) {
            if (this.engineTerminated) {
                this.timeAfterTermination += 0.0078125;
                this.board.engine.requestDuringRecalc(0.0078125, this.explosionPhysics, true, true, true);

            } else this.board.engine.requestDuringRecalc(0.0078125, this.explosionPhysics, this.ifEngineTerminates, true, true);
        } else {
            //restore ball collision functions
            this.blast.radius = 0;
            return;
        }

        for (let b = 0; b < this.affectedBlocks.length; b++) { //cull destroyed blocks, and remove their surfaces from other surfaces' "obscuredBy" arrays (including minSorted and maxSorted)
            if (this.affectedBlocks[b].block.hits > 0) continue;
            this.affectedBlocks[b].affectedSurfaces.forEach(this.cullDestroyedSurfaceFromObscuredByArrays);
            this.affectedBlocks[b].unaffectedSurfaces.forEach(this.cullDestroyedSurfaceFromObscuredByArrays);
            this.affectedBlocks.splice(b--, 1);
        }

        if (this.blast.radius < blastRadius) { //radius has expanded
            if (this.unaffectedBlocks.startedInwardDescent) throw new Error();
            let b = this.unaffectedBlocks.length - 1;
            while (b >= 0 && this.unaffectedBlocks[b].distance < blastRadius) {
                if (this.unaffectedBlocks[b--].block.hits > 0)
                    this.affectedBlocks.push(this.unaffectedBlocks.pop()); //affected blocks are sorted in the opposite order as unaffected -- ascending (nearest block to furthest)
                else this.unaffectedBlocks.pop()
            }

            this.affectedBlocks.forEach((block) => {
                b = block.unaffectedSurfaces.length - 1;
                while (b >= 0 && block.unaffectedSurfaces[b--].distance < blastRadius) {
                    block.affectedSurfaces.push(block.unaffectedSurfaces.pop());
                }
            });

            this.blast.radius = blastRadius;
            blastPowerPerSqPx = this.blast.maxPowerArea / this.blast.area();

        } else if (this.blast.radius > blastRadius) { //radius has contracted
            this.unaffectedBlocks.startedInwardDescent = true;
            let b = this.affectedBlocks.length - 1;
            while (b >= 0 && this.affectedBlocks[b--].distance >= blastRadius) {
                this.affectedBlocks.pop();
            }

            this.affectedBlocks.forEach((block) => {
                b = block.unaffectedSurfaces.length - 1;
                while (b >= 0 && block.unaffectedSurfaces[b--].distance >= blastRadius) {
                    block.affectedSurfaces.pop()
                }
            });

            this.blast.radius = blastRadius;
            blastPowerPerSqPx = this.blastPower * ( 1 - (this.timing - 3) / 5); //linear decay.  blast radius peaks at 3 seconds.  blast power will be completely extinguished at 8 seconds, theoretically, but the radius has fully contracted by ~7.75 seconds

        } else if(this.timing !== 0 || blastRadius !== 0 || this.blast.radius !== 0) throw new Error();

        

        this.affectedBlocks.forEach((block) => {
            let surfaceBlastPowerRatios = [];
            block.affectedSurfaces.forEach((surface) => {
                let intersections = this.blast.intersectionsWithLine(surface.surface);
                if (intersections?.length !== 2) throw new Error();
                let distances = [];
                let blastMin, blastMax;
                intersections.forEach((point) => {
                    if (surface.surface.inRange(point))
                        distances.push(surface.surface.point1.distanceTo(point));
                    else {
                        let primaryCoord = surface.surface.primaryCoordinate(point);
                        let point1 = surface.surface.primaryCoordinate(surface.surface.point1);
                        let point2 = surface.surface.primaryCoordinate(surface.surface.point2);
                        if (point1 < point2) {
                            if (primaryCoord < point1) blastMin = 0;
                            else if (primaryCoord > point2) blastMax = surface.length;
                            else throw new Error();
                        } else if (point1 > point2) {
                            if (primaryCoord > point1) blastMin = 0;
                            else if (primaryCoord < point2) blastMax = surface.length;
                            else throw new Error();
                        } else throw new Error();
                    }
                });
                if (!Number.isFinite(blastMin)) blastMin = Math.min(...distances);
                if (!Number.isFinite(blastMax)) blastMax = Math.max(...distances);
                if (!(Number.isFinite(blastMin) && Number.isFinite(blastMax)) || blastMin >= blastMax) throw new Error();


                if (surface.obscuredBy.minSorted.length !== surface.obscuredBy.maxSorted.length) throw new Error();

                let minIndex = 0, maxIndex = 0;
                while (minIndex < surface.obscuredBy.minSorted.length && surface.obscuredBy.minSorted[minIndex] <= blastMin) { minIndex++; }
                while (maxIndex < surface.obscuredBy.maxSorted.length && surface.obscuredBy.maxSorted[maxIndex] <= blastMin) { maxIndex++; }
                if (maxIndex > minIndex) throw new Error();

                //let layersObscured = minIndex - maxIndex;
                let blastPowerRatio = [];
                let lastPosition = blastMin;

                while (lastPosition < blastMax) {
                    let layersObscured = minIndex - maxIndex;
                    let newPosition = surface.obscuredBy.minSorted[minIndex];
                    if (newPosition <= surface.obscuredBy.maxSorted[maxIndex]) {
                        while (minIndex < surface.obscuredBy.minSorted.length && surface.obscuredBy.minSorted[minIndex] <= newPosition) { minIndex++; } //shouldn't be less than, but have it here just in case
                    }
                    if (newPosition >= surface.obscuredBy.maxSorted[maxIndex] || newPosition === undefined) {
                        newPosition = surface.obscuredBy.maxSorted[maxIndex] ?? blastMax;
                        if (newPosition > blastMax) newPosition = blastMax;
                        while (maxIndex < surface.obscuredBy.maxSorted.length && surface.obscuredBy.maxSorted[maxIndex] <= newPosition) { maxIndex++; } //shouldn't be less than, but have it here just in case
                    }
                    if (maxIndex > minIndex) throw new Error();

                    blastPowerRatio.push((newPosition - lastPosition) / (2 ** layersObscured)); //every layer causes a halving of blast power
                    lastPosition = newPosition;
                }
                blastPowerRatio = myOrderedSum(blastPowerRatio) * surface.aspectLength / surface.length;
                if (!Number.isFinite(blastPowerRatio)) throw new Error();
                surfaceBlastPowerRatios.push(blastPowerRatio);
            });

            let blastPowerInc = (block.area ** 0.75) * blastPowerPerSqPx * Math.max((blastRadius - block.distance) / block.distanceSpan, 1) * myOrderedSum(surfaceBlastPowerRatios) / block.totalAspectLength;
            if (blastPowerInc < 0) throw new Error();
            block.blastPowerCounter += blastPowerInc;
            
            while (block.blastPowerCounter >= this.blastCounterIncrement && block.block.hits > 0 ) {
                block.blastPowerCounter -= this.blastCounterIncrement;
                block.block.bounce(this, block.affectedSurfaces)
            }
        });

        this.timing += 0.02;

    }

    calcSurfaceAspectLength(surface) {
        let bisectorAng = ((surface.point1Angle < surface.point2Angle ? surface.point1Angle + 360 : surface.point1Angle) - surface.point2Angle) / 2;
        if (!(bisectorAng > 0)) throw new Error();
        let maxDist = Math.max(surface.point1Distance, surface.point2Distance);
        surface.aspectLength = 2 * maxDist * Math.sin(Angle.degreesToRadians(bisectorAng));
        surface.length = surface.surface.length();
        /*if (surface.aspectLength > surface.length) {
            if (surface.aspectLength - surface.length > 2 ** -30) throw new Error(); //not a rounding error
            surface.aspectLength = surface.length;
        }*/

        //surface.point1Length = surface.surface.point1.distanceTo(surface.nearestPoint);
        //surface.point2Length = surface.surface.point2.distanceTo(surface.nearestPoint);
    }

    rebuildExplosionCache() {
        let time = performance.now();
        this.affectedBlocks = new Array();
        this.unaffectedBlocks = new Array();
        this.board.blocks.forEach((block) => {
            if (!Number.isFinite(block.hits) || block === this) return;
            let maxDistance = Number.NEGATIVE_INFINITY;
            let distance = Number.POSITIVE_INFINITY;
            let surfaces = [];
            let firstPointAngle = this.blastCenter.angleTo(block.surfaces[0].point1);
            let point1Angle = firstPointAngle;

            block.surfaces.forEach((surface, index) => {
                let nearestPoint = surface.nearestPointTo(this.blastCenter);
                let tempDistance = this.blastCenter.distanceTo(nearestPoint);

                let point1Distance = surface.point1.distanceTo(this.blastCenter);
                let point2Distance = surface.point2.distanceTo(this.blastCenter);
                maxDistance = Math.max(maxDistance, point1Distance, point2Distance, tempDistance);
                
                if (tempDistance > this.blastRadius) {
                    point1Angle = null;
                    return;
                }

                distance = Math.min(tempDistance, distance);
                
                let nearestPointAngle = this.blastCenter.angleTo(nearestPoint);
                let point2Angle = (index === block.surfaces.length - 1) ? firstPointAngle : this.blastCenter.angleTo(surface.point2);
                if (point1Angle === null) point1Angle = this.blastCenter.angleTo(surface.point1);

                if (!(surface.bounceRange.inRange(nearestPointAngle, false, true, true) || surface.bounceRange.inRange(point1Angle, false, true, true) || surface.bounceRange.inRange(point2Angle, false, true, true))) {
                    if (Angle.clockwiseFrom(point1Angle, point2Angle, false, true)) throw new Error();
                    let point1Dis
                    surfaces.push({
                        surface: surface,
                        block: block, //this is the actual block, not the explosion reference object 'block' pushed into the unaffectedBlocks array below!
                        distance: tempDistance,
                        nearestPoint: nearestPoint,
                        nearestAngle: nearestPointAngle,
                        point1Angle: point1Angle,
                        point2Angle: point2Angle,
                        point1Distance: point1Distance,
                        point2Distance: point2Distance
                    });

                } else {
                    if (!(surface.bounceRange.inRange(nearestPointAngle, false, true, true) && surface.bounceRange.inRange(point1Angle, false, true, true) && surface.bounceRange.inRange(point2Angle, false, true, true)))
                        throw new Error();
                    if (Angle.counterclockwiseFrom(point1Angle, point2Angle, false, true)) throw new Error();
                }

                point1Angle = point2Angle; //for the next surface
            });

            if (distance > this.blastRadius) return;

            let totalAspectLength = 0;
            this.findObscured([{ unaffectedSurfaces: surfaces }]).forEach((surface) => {
                //if this block is obscuring any of its own surfaces, we need to create a substitute surface that is not obscured, or if that is not possible, eliminate this surface from the surfaces array
                if (surface.obscuredBy.length === 0) {
                    this.calcSurfaceAspectLength(surface);
                    totalAspectLength += surface.aspectLength;
                    return;
                }
                let index = surfaces.indexOf(surface);
                if (index === -1) throw new Error();
                let distance = Math.POSITIVE_INFINITY;
                let point1, point2;
                surfaces.obscuredBy.forEach((obscuring) => {
                    if (obscuring.point1) {

                        if (obscuring.distance1 < distance) {
                            distance = obscuring.distance1;
                            point1 = obscuring.point1;
                        } else if (!point1) point1 = true;
                    }
                    if (obscuring.point2) {
                        if (obscuring.distance2 < distance) {
                            distance = obscuring.distance2;
                            point2 = obscuring.point2;
                        } else if (!point2) point2 = true;
                    }
                });
                let pointName, newSurface;
                if (point1 && point2) throw new Error();
                else if (point1 instanceof Position) {
                    pointName = "point2";
                    newSurface = new Surface(surface.surface.surface.point1, point1);
                }
                else if (point2 instanceof Position) {
                    pointName = "point1";
                    newSurface = new Surface(point2, surface.surface.surface.point2);
                }
                else if (point1 === undefined && point2 === undefined) {
                    surfaces.splice(index, 1);
                    return;
                } else throw new Error();

                newSurface.corner1 = surface.surface.corner1;
                newSurface.corner2 = surface.surface.corner2;
                surface.surface = newSurface;
                surface.length = newSurface.length();
                surface.nearestPoint = surface.surface.nearestPointTo(this.blastCenter);
                surface.distance = this.blastCenter.distanceTo(surface.nearestPoint);
                surface.nearestAngle = this.blastCenter.angleTo(surface.nearestPoint);
                surface[pointName + "Angle"] = this.blastCenter.angleTo(newSurface[pointName]);
                surface[pointName + "Distance"] = this.blastCenter.distanceTo(newSurface[pointName]);
                this.calcSurfaceAspectLength(surface);
                totalAspectLength += surface.aspectLength;
            });

            this.findObscured([{ unaffectedSurfaces: surfaces }]).forEach((surface) => { //safety redundancy check, to make sure no surfaces are obscured
                if (surface.obscuredBy.length > 0) throw new Error();
            });
            if (surfaces.length === 0) throw new Error();
            surfaces.sort((surface1, surface2) => { return surface2.distance - surface1.distance }); //sorted in descending order (furthest to nearest)
            this.unaffectedBlocks.push({
                block: block,
                distance: distance,
                distanceSpan: maxDistance - distance,
                maxDistance: maxDistance,
                area: block.area(),
                unaffectedSurfaces: surfaces,
                affectedSurfaces: [],
                blastPowerCounter: 0,
                totalAspectLength: totalAspectLength
            });
        });

        this.unaffectedBlocks.sort((block1, block2) => { return block2.distance - block1.distance; });
        //sorted in descending order (furthest block to nearest block)

        if (BombBlock.animateObscuringVectors) {
            this.obscuringVectorsToDraw = this.findObscured();

            //console.log(performance.now() - time);

            this.obscuringVectorsToDraw.index = 0;
            this.obscuringVectorsToDraw.timing = 0;
            this.animateObscuringVectors(0.00);
        } else this.findObscured();
    }

    findObscured(blocks = this.unaffectedBlocks) {
        let surfaces = [];
        let surfacesStraddlingXOver = [];
        blocks.forEach((block) => {
            block.unaffectedSurfaces.forEach((surface) => {
                surfaces.push(surface);
                surface.obscuring = [];
                surface.obscuredBy = [];
                surface.obscuredBy.minSorted = [];
                surface.obscuredBy.maxSorted = [];

                if (surface.point1Angle < surface.point2Angle) {
                    if (surface.point2Angle - surface.point1Angle <= 180) throw new Error();
                    else surfacesStraddlingXOver.push(surface);
                    surface.straddlesXOver = true;
                    surface.point1AngleNeg = surface.point1Angle;
                    surface.point1AnglePos = surface.point1Angle + 360;
                    surface.point2AnglePos = surface.point2Angle;
                    surface.point2AngleNeg = (surface.point2Angle -= 360);
                }
            });
        });

        surfaces.sort(this.sortSurfaces);

        let spliceIndex = surfaces.length;
        if (surfacesStraddlingXOver.length > 0 && surfacesStraddlingXOver.length < surfaces.length) {
            while (!surfaces[spliceIndex - 1].straddlesXOver) { spliceIndex--; }
            if (spliceIndex < 1) throw new Error();

            let upperHalf = surfaces.splice(spliceIndex, surfaces.length - spliceIndex);
            surfacesStraddlingXOver.forEach((surface) => {
                surface.point1Angle = surface.point1AnglePos;
                surface.point2Angle = surface.point2AnglePos;
            });

            upperHalf.push(...surfacesStraddlingXOver);
            upperHalf.sort(this.sortSurfaces);
            surfaces.push(...upperHalf);

            surfacesStraddlingXOver.forEach((surface) => {
                surface.point1Angle = surface.point1AngleNeg;
                surface.point2Angle = surface.point2AngleNeg;
            });
        }

        surfaces.forEach((surface, index) => {
            let i = index + 1;
            while (i < surfaces.length && surfaces[i].point2Angle < surface.point1Angle) {
                if (surface.straddlesXOver && surfaces[i].straddlesXOver) {
                    if (i >= spliceIndex) { i++; continue; }
                    if (surface === surfaces[i]) throw new Error();
                    if (surface.secondIteration || surfaces[i].secondIteration) throw new Error();
                }
                let obscuring = undefined;
                let intersection;
                if (surfaces[i].point2Angle === surface.point2Angle)
                    obscuring = surfaces[i].point2Distance >= surface.point2Distance //if they are equal (same point), this was already determined by the above sort function, using surface angles

                else {
                    let line = surfaces[i].point2Line ?? (surfaces[i].point2Line = new Line(surfaces[i].surface.point2, this.blastCenter));
                    intersection = surface.surface.intersectionWith(line, false, true, undefined, true);
                    if (!intersection) throw new Error(); //rounding errors in the point2Line could cause this to be undefined???  In theory, [i].point2Line should always contain point2 of that surface, but maybe not in practice
                    let distance = intersection.distanceTo(this.blastCenter);
                    obscuring = distance < surfaces[i].point2Distance
                }

                if (obscuring === true) { //this surface is closer
                    surface.obscuring.push(surfaces[i]);
                    surfaces[i].obscuredBy.push({ surface: surface });

                } else if (obscuring === false) {
                    surfaces[i].obscuring.push(surface);
                    if (intersection) surface.obscuredBy.push({ surface: surfaces[i], point2: intersection });
                    else surface.obscuredBy.push({ surface: surfaces[i] });

                } else throw new Error();
                i++;
            }

            surface.obscuredBy.forEach((obscuring) => {
                if (surface.secondIteration && obscuring.surface.secondIteration) return;
                let line = obscuring.surface.point1Line ?? (obscuring.surface.point1Line = new Line(obscuring.surface.surface.point1, this.blastCenter));
                obscuring.point1 = surface.surface.intersectionWith(line, false, false) ?? null;
                obscuring.distance1 = obscuring.point1 ? surface.surface.point1.distanceTo(obscuring.point1) : 0;
                

                line = obscuring.surface.point2Line ?? (obscuring.surface.point2Line = new Line(obscuring.surface.surface.point2, this.blastCenter));
                obscuring.point2 = obscuring.point2 ?? surface.surface.intersectionWith(line) ?? null
                obscuring.distance2 = obscuring.point2 ? surface.surface.point1.distanceTo(obscuring.point2) : surface.length;

                if (obscuring.point1 && Math.abs(this.blastCenter.angleTo(obscuring.point1) - this.blastCenter.angleTo(obscuring.surface.surface.point1)) > 1) { //give 1 degree for rounding error... should be more than enough.  It these situations it will be ~180 degree difference (give or take a fraction of a degree, with rounding error)
                    if (Math.abs(this.blastCenter.angleTo(obscuring.point2) - this.blastCenter.angleTo(obscuring.surface.surface.point2)) > 1) throw new Error();
                    if (obscuring.distance1 <= obscuring.distance2) throw new Error(); // under this circumstance, min should be greater than max!  we're about to fix that...
                    obscuring.point1 = null;
                    obscuring.distance1 = 0;
                }
                if (obscuring.point2 && Math.abs(this.blastCenter.angleTo(obscuring.point2) - this.blastCenter.angleTo(obscuring.surface.surface.point2)) > 1) { //give 1 degree for rounding error... should be more than enough.  It these situations it will be ~180 degree difference (give or take a fraction of a degree, with rounding error)
                    if (obscuring.distance1 <= obscuring.distance2) throw new Error(); // under this circumstance, min should be greater than max!  we're about to fix that...
                    obscuring.point2 = null;
                    obscuring.distance2 = surface.length;
                }

                if (!(obscuring.distance1 <= obscuring.distance2)) throw new Error();

                surface.obscuredBy.minSorted.push(obscuring.distance1);
                surface.obscuredBy.maxSorted.push(obscuring.distance2);
            });

            if (surface.obscuredBy.minSorted.length !== surface.obscuredBy.maxSorted.length) throw new Error();

            if (surface.straddlesXOver && !surface.secondIteration) {
                surface.secondIteration = true;
                surface.point1Angle = surface.point1AnglePos;
                surface.point2Angle = surface.point2AnglePos;

            } else {
                surface.obscuredBy.minSorted.sort((distance1, distance2) => { return distance1 - distance2; });
                surface.obscuredBy.maxSorted.sort((distance1, distance2) => { return distance1 - distance2; });
            }

        });

        surfacesStraddlingXOver.forEach((surface) => {
            surface.point1Angle = surface.point1AngleNeg;
            surface.point2Angle = surface.point2AnglePos;
            delete surface.secondIteration;
            delete surface.straddlesXOver;
        });

        return surfaces;
    }

    sortSurfaces(surface1, surface2) {
        if (surface1.point2Angle !== surface2.point2Angle) return surface1.point2Angle - surface2.point2Angle;
        else if (surface1.point2Distance !== surface2.point2Distance) return surface1.point2Distance - surface2.point2Distance;
        else if ((surface1.surface.corner2.surfaceAngle - surface2.surface.corner2.surfaceAngle) % 180 !== 0)
            return Angle.counterclockwiseFrom(surface1.surface.corner2.surfaceAngle, surface2.surface.corner2.surfaceAngle) ? -1 : 1;
        else throw new Error();
    }

    cullDestroyedSurfaceFromObscuredByArrays(surface) {
        surface.obscuring.forEach((obscured) => {
            for (let s = 0; s < obscured.obscuredBy.length; s++) {
                if (obscured.obscuredBy[s].surface === surface) {
                    if (obscured.obscuredBy.minSorted.splice(obscured.obscuredBy.minSorted.indexOf(obscured.obscuredBy[s].distance1), 1)[0] !== obscured.obscuredBy[s].distance1) throw new Error();
                    if (obscured.obscuredBy.maxSorted.splice(obscured.obscuredBy.maxSorted.indexOf(obscured.obscuredBy[s].distance2), 1)[0] !== obscured.obscuredBy[s].distance2) throw new Error();
                    obscured.obscuredBy.splice(s, 1);
                    break;
                }
            }
        });
    }

    animateObscuringVectors(seconds) {
        this.obscuringVectorsToDraw.timing += seconds;
        if (this.obscuringVectorsToDraw.timing >= 0.03) {
            this.obscuringVectorsToDraw.index++;
            if (++this.obscuringVectorsToDraw.index > this.obscuringVectorsToDraw.length - 1) {
                delete this.obscuringVectorsToDraw;
                return;
            } else this.obscuringVectorsToDraw.timing = 0;
        }
        let surface = this.obscuringVectorsToDraw[this.obscuringVectorsToDraw.index];

        UI.board.context.lineWidth = 3;
        UI.board.context.strokeStyle = WHITE.string;
        surface.surface.draw();
        UI.board.context.lineWidth = 1;

        /*UI.board.context.strokeStyle = BLACK.string;
        surfaces?.forEach((surface, index) => {
            if (index < firstIndex || index > lastIndex) return;
            surface.surface.draw()
        });*/

        UI.board.context.strokeStyle = RED.string;
        surface.obscuredBy.forEach((obscuring) => {
            obscuring.surface.surface.draw();

            obscuring.point1?.draw();
            obscuring.point2?.draw();

            let point
            if (this.blastCenter.distanceTo(surface.surface.point1) >= this.blastCenter.distanceTo(surface.surface.point2))
                point = surface.surface.point1; // find the point furthest from blast center
            else point = surface.surface.point2;
            let line = Line.fromPointAndAngle(point, Angle.acuteMidpoint(this.blastCenter.angleTo(obscuring.surface.surface.point1), this.blastCenter.angleTo(obscuring.surface.surface.point2)) + 90);

            point = line.intersectionWith(obscuring.surface.point1Line);
            (new Segment(obscuring.surface.surface.point1, point)).draw();

            point = line.intersectionWith(obscuring.surface.point2Line);
            (new Segment(obscuring.surface.surface.point2, point)).draw();

        });

        UI.board.context.strokeStyle = GREEN.string;
        surface.obscuring.forEach((obscured) => {
            obscured.surface.draw();
            let obscuring = 0;

            while (Number.isFinite(obscuring)) {
                if (obscured.obscuredBy[obscuring].surface === surface) obscuring = obscured.obscuredBy[obscuring];
                else if (obscuring++ >= obscured.obscuredBy.length) throw new Error();
            }

            (obscuring.point1 ?? obscured.surface.intersectionWith(surface.point1Line ?? (surface.point1Line = new Line(surface.surface.point1, this.blastCenter))))?.draw();
            (obscuring.point2 ?? obscured.surface.intersectionWith(surface.point2Line ?? (surface.point2Line = new Line(surface.surface.point2, this.blastCenter))))?.draw();

            let point
            if (this.blastCenter.distanceTo(obscured.surface.point1) >= this.blastCenter.distanceTo(obscured.surface.point2))
                point = obscured.surface.point1; // find the point furthest from blast center
            else point = obscured.surface.point2;
            let line = Line.fromPointAndAngle(point, Angle.acuteMidpoint(this.blastCenter.angleTo(surface.surface.point1), this.blastCenter.angleTo(surface.surface.point2)) + 90);

            point = line.intersectionWith(surface.point1Line);
            (new Segment(surface.surface.point1, point)).draw();

            point = line.intersectionWith(surface.point2Line);
            (new Segment(surface.surface.point2, point)).draw();

        });

        UI.board.context.strokeStyle = WHITE.string;
        UI.board.context.lineWidth = 2;
        surface.surface.draw();
        //this.blastCenter.draw();
        let breakPoint = true;

        this.board.engine.requestAnimation(this.animateObscuringVectors);
    }

    animateExplosion(seconds, context = UI.board.context) {
        let frame = this.frame += seconds * 12.5;
        this.timingFrameAlignment.push({ timing: this.timing, frame: this.frame, animateExplosion: true });

        if (BombBlock.drawBlastRadius) {
            context.strokeStyle = BLACK.string;
            context.lineWidth = 3;
            this.blast.draw();
        }

        let centerFrame = Math.round(frame);
        if (centerFrame - 1 >= BombBlock.explosion.length) {
            //this.lastFrameTiming.block = this;
            ////console.log(this.lastFrameTiming);
            return;
        } else if (Math.abs(this.frame - BombBlock.explosion.length) < (this.lastFrameTiming?.distFromLastFrame ?? Number.POSITIVE_INFINITY)) {
            this.lastFrameTiming = { timing: this.timing, lastFrame: this.frame, distFromLastFrame: Math.abs(this.frame - BombBlock.explosion.length) };
        }

        let sizeRatio = this.blastRadius / BombBlock.explosion.blastRadius;
        let baselineAlpha = Math.max(0.55 - 0.125 / Math.sqrt(sizeRatio), 0.2);

        let width = BombBlock.explosion[0].width * sizeRatio;
        let height; // = BombBlock.explosion[0].height * sizeRatio;

        if (frame < 0) {
            context.globalAlpha = Math.min((0.5 - frame) / 1.5, 1);
            this.draw();
        }

        let ratio = 0.5 + centerFrame - frame;

        if (centerFrame >= 1) {
            let x = BombBlock.explosion[centerFrame - 1].center.x * ratio + BombBlock.explosion[Math.min(centerFrame, BombBlock.explosion.length - 1)].center.x * (1 - ratio) - BombBlock.explosion[0].width / 2;
            let y = BombBlock.explosion[centerFrame - 1].center.y * ratio + BombBlock.explosion[Math.min(centerFrame, BombBlock.explosion.length - 1)].center.y * (1 - ratio) - BombBlock.explosion[0].height / 2;
            height = BombBlock.explosion[0].height * sizeRatio * BombBlock.explosion[centerFrame - 1].center.heightAdjustment;
            
            context.globalAlpha = ratio * baselineAlpha;
            if (centerFrame - 1 !== 1) {
                x = this.blastCenter.x - x * sizeRatio - width / 2;
                y = this.blastCenter.y - y * sizeRatio - height / 2;
                context.drawImage(BombBlock.explosion[centerFrame - 1], x, y, width, height);
            } else {
                x = this.blastCenter.x - x * sizeRatio * 4 - width * 2;
                y = this.blastCenter.y - y * sizeRatio * 4 - height * 2;
                context.drawImage(BombBlock.explosion[centerFrame - 1], x, y, width * 4, height * 4);
            }
        }

        if (centerFrame >= 0 && centerFrame < BombBlock.explosion.length) {
            let x = BombBlock.explosion[centerFrame].center.x - BombBlock.explosion[0].width / 2;
            let y = BombBlock.explosion[centerFrame].center.y - BombBlock.explosion[0].height / 2;
            height = BombBlock.explosion[0].height * sizeRatio * BombBlock.explosion[centerFrame].center.heightAdjustment;

            context.globalAlpha = baselineAlpha;
            if (centerFrame !== 1) {
                x = this.blastCenter.x - x * sizeRatio - width / 2;
                y = this.blastCenter.y - y * sizeRatio - height / 2;
                context.drawImage(BombBlock.explosion[centerFrame], x, y, width, height);
            } else {
                x = this.blastCenter.x - x * sizeRatio * 4 - width * 2;
                y = this.blastCenter.y - y * sizeRatio * 4 - height * 2;
                context.drawImage(BombBlock.explosion[centerFrame], x, y, width * 4, height * 4);
            }

        }

        ratio = 1 - ratio;
        if (centerFrame >= -1 && centerFrame + 1 < BombBlock.explosion.length) {
            let x = BombBlock.explosion[centerFrame + 1].center.x * ratio + BombBlock.explosion[Math.max(centerFrame, 0)].center.x * (1 - ratio) - BombBlock.explosion[0].width / 2;
            let y = BombBlock.explosion[centerFrame + 1].center.y * ratio + BombBlock.explosion[Math.max(centerFrame, 0)].center.y * (1 - ratio) - BombBlock.explosion[0].height / 2;
            height = BombBlock.explosion[0].height * sizeRatio * BombBlock.explosion[centerFrame + 1].center.heightAdjustment;

            context.globalAlpha = ratio * baselineAlpha;
            if (centerFrame + 1 !== 1) {
                x = this.blastCenter.x - x * sizeRatio - width / 2;
                y = this.blastCenter.y - y * sizeRatio - height / 2;
                context.drawImage(BombBlock.explosion[centerFrame + 1], x, y, width, height);
            } else {
                x = this.blastCenter.x - (x * sizeRatio + width / 2) * (ratio * 3 + 1);
                y = this.blastCenter.y - (y * sizeRatio + height / 2) * (ratio * 3 + 1);
                context.drawImage(BombBlock.explosion[centerFrame + 1], x, y, width * (ratio * 3 + 1), height * (ratio * 3 + 1));
            }
        }

        context.globalAlpha = 1;
        this.board.engine.requestAnimation(this.animateExplosion, false, true);
    }
}

BombBlock.blockCounterIncrement = 256 ** 2;
BombBlock.drawBlastRadius = false;
BombBlock.slowMoAnimation = false;
BombBlock.animateObscuringVectors = false;



loadExplosionFrames();

function loadExplosionFrames() {
    let imageLoadTime = performance.now()
    const bombPath = HOME_PATH + '/explosion';
    BombBlock.image = new Image();
    BombBlock.image.src = bombPath + '/bomb.jpg';

    BombBlock.explosion = new Array(48);
    BombBlock.explosion.blastRadius = 120;

    let centers = [ //frame position and size adjustments
        { frame: 1, x: 270, y: 160 },
        { frame: 4, x: 268, y: 160 },
        { frame: 7, x: 260, y: 165, heightAdjustment: 1.25},
        { frame: 14, x: 250, y: 159, heightAdjustment: 1.4 },
        { frame: 20, x: 225, y: 146, heightAdjustment: 1.4 },
        { frame: 25, x: 220, y: 143, heightAdjustment: 1.2 },
        { frame: 30, x: 225, y: 135, heightAdjustment: 1.1 },
        { frame: 35, x: 228, y: 125 },
        { frame: 40, x: 230, y: 110 },
        { frame: 48, x: 230, y: 90 }
    ]

    let fileNames = [null, 6, 6, 7, 6, 7, 7, 6, 7, 7, 6, 7, 7, 6, 7, 7, 6, 7, 7, 6, 7, 7, 6, 7, 7, 6, 7, 7, 6, 7, 7, 6, 7, 7, 6, 7, 7, 6, 7, 7, 6, 7, 7, 6, 7, 7, 6, 7, 7]

    centers.forEach((center) => { if (center.heightAdjustment === undefined) center.heightAdjustment = 1; });

    let c = 0;
    for (let frame = 1; frame < 49; frame++) {
        let image = new Image();

        image.src = `${bombPath}/frame_${(frame > 9 ? "" : "0") + frame}_delay-0.0${fileNames[frame]}s.gif`;

        image.onerror = function (event) {
            event.frame = frame;
            console.log(event);
            throw new Error("couldn't load an explosion frame");
        }
        if (frame === 48) image.onload = () => console.log("Time to load explosion animation frames: " + (performance.now() - imageLoadTime) + " ms ... \tsince init: " + (performance.now() - initializeStartTime) + " ms ");


        if (frame >= centers[c].frame) { //shouldn't be less than, but just in case
            image.center = centers[c];
            if (c < centers.length - 1)
                c++;

        } else if (frame < centers[c].frame) {
            let previous = centers[Math.max(c - 1, 0)];
            let next = centers[c];
            let ratio = (frame - previous.frame) / (next.frame - previous.frame)
            image.center = { frame: frame, x: previous.x + (next.x - previous.x) * ratio, y: previous.y + (next.y - previous.y) * ratio, heightAdjustment: previous.heightAdjustment + (next.heightAdjustment - previous.heightAdjustment) * ratio };
        } else throw new Error();

        BombBlock.explosion[frame - 1] = image;
    }
}

initializeLogger?.("block.special ran");