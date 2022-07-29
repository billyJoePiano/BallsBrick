"use strict"; document.currentScript.initTime = performance.now();

function setSubMode(subMode, event, argForNew, argForOld) {
    this.leaveSubMode?.(event, argForOld);
    for (let func in this.subMode) {
        delete this[func];
    }
    this.subMode = subMode;
    for (let func in subMode) {
        this[func] = subMode[func];
    }
    this.initializeSubMode?.(event, argForNew);
}

function leaveMode(event, arg) { //removes subMode functions
    this.leaveSubMode?.(event, arg);
    for (let func in this.subMode) {
        delete this[func];
    }
    delete this.subMode;
}

// for adding new or recycled (displaced) blocks
// this is used as a subMode only when re-placing a displaced block (by holding down shift when placing a block, grabs any displaced blocks)
//Behavior is slightly different in those cases -- selection is not reset in the absence of 'ctrl' key
//conversely, the re-placed block(s) do not become part of selection UNLESS 'ctrl' is held down)
BoardEditor.addBlocks = {
    initializeAddBlocks: function (pointerBlocks) {
        if (pointerBlocks instanceof Block) this.pointerBlocks = [pointerBlocks];
        else if (pointerBlocks instanceof Array) this.pointerBlocks = pointerBlocks;
        else throw new Error();

        this.canvas.style.cursor = "grabbing";
        this.updateBlockArrayCaches(this.pointerBlocks);
        this.pointerFlags.grabPoint.updateFromCoordinates(this.pointerBlocks.width / 2, this.pointerBlocks.height / 2);
        this.adjustBlockPointerPosition();
        this.movePointerBlocks();
    }
,
    initializeMode: function (event, pointerBlocks) {delete this.subMode, this.initializeAddBlocks(pointerBlocks); },
    initializeSubMode: function (event, pointerBlocks) { this.initializeAddBlocks(pointerBlocks); }
,
    setSubMode: setSubMode
,
    leaveMode: function (event, arg) {
        delete this.pointerBlocks;
        leaveMode.apply(this, event, arg);
    },
    leaveSubMode: function (event, arg) { delete this.pointerBlocks; },
    esc: function (event) {
        if (this.pointerFlags.depressed) {
            console.log("esc addBlocks1", event);

            this.escapeFromClick();
            this.displacedBlocks.length = 0;
            this.canvas.style.cursor = "grabbing";
        } else {
            console.log("esc addBlocks2", event);
            if (event?.type !== "keydown") return;
            if (this.subMode === BoardEditor.addBlocks) {
                let recycled = this.recycleBlocks("pointerBlocks");
                for (let i = 0; i < this.recycled.length; i++) {
                    let si = this.selectedBlocks.indexOf(recycled[i]);
                    if (si === -1) continue;
                    this.selectedBlocks.splice(si, 1);
                    i--;
                }
            }
            this.setMode(BoardEditor.select, event);
        }
    }
,
    getAlphas: function () {
        if(this.pointerFlags.depressed)
            return { "blocks": 0.5, "displacedBlocks": 1, "pointerBlocks": this.pointerFlags.blockPosition.defined ? 0.7 : 0 };
        else
            return { "blocks": 0.6, "selectedBlocks": 0.8, "pointerBlocks": this.pointerFlags.blockPosition.defined ? 1 : 0 };
    }
,
    pointerMoved: function (event) {
        if (this.adjustBlockPointerPosition()) {
            this.movePointerBlocks();
            if (this.pointerFlags.depressedAndOver && !this.pointerFlags.cancelPossible)
                this.findDisplaced(this.pointerBlocks);
            this.draw();
        }
    }
,
    pointerEvent: function(event) {
        if (this.adjustBlockPointerPosition()) {
            this.movePointerBlocks();
            if (this.pointerFlags.depressedAndOver && !this.pointerFlags.cancelPossible)
                this.findDisplaced(this.pointerBlocks);
            else
                this.displacedBlocks.length = 0;
        } else if (!this.pointerFlags.depressedAndOver || this.pointerFlags.cancelPossible)
            this.displacedBlocks.length = 0;

        if (this.pointerFlags.depressed) this.canvas.style.cursor = "grab";
        else this.canvas.style.cursor = "grabbing";
        this.draw();
    }
,
    click: function (event) {
        this.hasUpdates = true;

        if (this.adjustBlockPointerPosition()) {
            this.movePointerBlocks();
            this.findDisplaced(this.pointerBlocks);
        }

        if (!(event.altKey || event.ctrlKey || this.subMode === BoardEditor.addBlocks || (event.shiftKey && this.displacedBlocks.length > 0)))
            this.selectedBlocks = new Array();

        this.pointerBlocks.forEach((block, index) => {
            this.boardTemplate.addBlock(block);
            if (event.altKey || (this.subMode === BoardEditor.addBlocks && !event.ctrlKey)) return;
            this.selectedBlocks.push(block);
            if (!block.surfaces) block.generateSurfaces();
        });
        //console.log(this.displacedBlocks);

        if (event.shiftKey && this.displacedBlocks.length > 0) {
            this.setSubMode(BoardEditor.addBlocks, event, this.recycleBlocks());

        } else {
            //remove any blocks which were displaced from the selected array.  They will be removed from the main this.blocks (aka this.boardTemplate.blocks) array by the recycleBlocks method, but would remain in the selected array unless removed
            for (let i = 0; i < this.displacedBlocks.length; i++) {
                let si = this.selectedBlocks.indexOf(this.displacedBlocks[i]);
                if (si > -1) this.selectedBlocks.splice(si, 1);
            }

            if(this.displacedBlocks.length > 0) console.log("recycling", [...this.displacedBlocks]);
            this.recycleBlocks();

            //if (this.currentModeButton === "select") {
                //return to selection mode (meaning addBlocks mode was temporarily invoked when selection mode displaced blocks while 'shift' held)

                this.clickCurrentModeButton(event);

            //} else {
                //if file or options are currently selected, change to 'add blocks'
                //if add blocks is current, stay that way
                //this.clickModeButton("addBlocks", event);
            //}
        }
        this.draw();
    }
,
    movePointerBlocks: function() {
        if (this.pointerBlocks.length === 0) throw new Error("must have pointer blocks to be in this mode!");
        if (this.pointerFlags.blockPosition.defined) {
            this.pointerBlocks.forEach((block, index) => {
                block.moveTo(this.pointerBlocks.relativePositions[index].x + this.pointerFlags.blockPosition.x, this.pointerBlocks.relativePositions[index].y + this.pointerFlags.blockPosition.y);
            });
        }
    }
}



//for selecting and moving blocks on the board.  has three difference subModes -- resting, selecting, and grabAndDrag
BoardEditor.select = {
    initializeMode: function (event, buttonClicked = false) {
        if (buttonClicked) {
            this.setSubMode(BoardEditor.select.resting, event);

        } else {
            this.clickModeButton("select", event);
        }
    }
    ,
    leaveMode: function (event, arg) {
        this.findDisplaced();
        this.recycleBlocks();
        this.updateBlockArrayCaches();
        leaveMode.apply(this, event, arg);
    },
    setSubMode: setSubMode,
    resizeGrabMargin: 4
}

BoardEditor.select.resting = {
    getAlphas: function () { return { "blocks": this.selectedBlocks.length > 0 ? 0.5 : 0.65, "selectedBlocks": 0.8, "displacedBlocks": 1 } }
,
    initializeSubMode: function (event, arg) {
        this.pointerFlags.grabPoint.updateFromCoordinates(undefined, undefined);
        this.updateBlockArrayCaches();
        this.pointerMoved(event);
    }
,
    esc: function (event) {
        /*if (event?.type === "keydown")*/ this.selectedBlocks.length = 0;
        this.draw();
    }
,   get ctrl() { return this.pointerMoved; }
,    
    findGrabObject: function() {
        if (this.pointerFlags.ctrl || this.pointerFlags.position.notDefined) return undefined;  //ctrl key implies selection / de-selection, not grabbing

        let tempRect = new Rectangle();
        let distance = this.resizeGrabMargin + 1;
        let nearestSelectedSurface = undefined;
        let nearestPointOnSurface = undefined;
        let insideSelectedBlock

        this.selectedBlocks.forEach((block) => {
            tempRect.updateFromCoordinates(block.x - this.resizeGrabMargin, block.y - this.resizeGrabMargin, block.width + this.resizeGrabMargin * 2, block.height + this.resizeGrabMargin * 2);
            if (tempRect.inside(this.pointerFlags.position.x, this.pointerFlags.position.y)) {
                block.surfaces.forEach((surface, index) => {
                    let tempNearestPoint = surface.nearestPointTo(this.pointerFlags.position);
                    let tempDist = this.pointerFlags.position.distanceTo(tempNearestPoint);
                    if (tempDist < distance) {
                        distance = tempDist;
                        nearestSelectedSurface = surface;
                        nearestPointOnSurface = tempNearestPoint;
                        insideSelectedBlock = true;
                    } else if (!insideSelectedBlock && block.inside(this.pointerFlags.position))
                        insideSelectedBlock = block;
                });
            }
        });
        if (nearestSelectedSurface) {
            let distP1 = nearestPointOnSurface.distanceTo(nearestSelectedSurface.point1);
            let distP2 = nearestPointOnSurface.distanceTo(nearestSelectedSurface.point2);

            if (distP1 < this.resizeGrabMargin * SQRT_2 && distP1 < distP2)  return nearestSelectedSurface.corner1;
            else if (distP2 < this.resizeGrabMargin * SQRT_2)                return nearestSelectedSurface.corner2;
            else return nearestSelectedSurface;

        } else if (insideSelectedBlock) return insideSelectedBlock;
        else {
            for (let i = 0; i < this.blocks.length; i++) {
                if (this.blocks[i].inside(this.pointerFlags.position)) 
                    return this.blocks[i]
            }
            return undefined;
        }
    }
,
    pointerMoved: function (event) {
        let grabObj = this.findGrabObject();
        if (grabObj === undefined) this.canvas.style.cursor = "crosshair";
        else if (grabObj instanceof Block) this.canvas.style.cursor = "grab";
        else this.canvas.style.cursor = grabObj.block.resizeCursorStyle(event, grabObj, this);
    }
,
    pointerEvent: function (event) {
        if (this.pointerFlags.depressedAndOver) {
            if (this.pointerFlags.grabPoint.defined) throw new Error("resting mode should not have a grab point!");
            let grabbedObj = this.findGrabObject();

            if (grabbedObj === undefined) {
                //no blocks being grabbed here.  Making a block/area selection.
                //displacedBlocks aren't recycled until the pointer is released (assuming it is not cancelled by 'esc' key and ctrl is not held)
                this.setSubMode(BoardEditor.select.selecting, event);

            } else if (this.selectedBlocks.indexOf(grabbedObj) > -1) {
                this.displacedBlocks.length = 0;
                this.pointerFlags.grabPoint.updateFromCoordinates(  this.pointerFlags.position.x - this.selectedBlocks.x,
                                                                    this.pointerFlags.position.y - this.selectedBlocks.y   );
                this.setSubMode(BoardEditor.select.grabAndDrag, event);

            } else if (grabbedObj instanceof Block) {
                this.recycleBlocks();
                this.pointerFlags.grabPoint.updateFromCoordinates(  this.pointerFlags.position.x - grabbedObj.x,
                                                                    this.pointerFlags.position.y - grabbedObj.y   );
                this.selectedBlocks = [grabbedObj];
                this.updateBlockArrayCaches();
                this.setSubMode(BoardEditor.select.grabAndDrag, event);

            } else if (grabbedObj instanceof Surface || grabbedObj.isCorner) {
                this.canvas.style.cursor = grabbedObj.block.resizeCursorStyle(event, grabbedObj, this);
                this.setSubMode(BoardEditor.select.resize, event, grabbedObj);

            } else throw new Error("cannot recognize return value from editor.findGrabObject -- in select mode, resting subMode");

            this.draw();
        } else if (this.pointerFlags.depressed || this.pointerFlags.cancelPossible) throw new Error("should not be in resting mode while pointer is depressed!");
        else if(this.pointerFlags.position.defined) this.pointerMoved(event);
    }
}

Object.defineProperty(BoardEditor.select, "resting", { enumerable: false });



BoardEditor.select.selecting = {
    initializeSubMode: function (event, arg) {
        this.pointerFlags.grabPoint.updateFromPosition(this.pointerFlags.position);
        this.canvas.style.cursor = "crosshair";

        let corner1 = this.pointerFlags.position.copy()
        let corner2 = this.pointerFlags.position.copy();
        let corner3 = this.pointerFlags.position.copy();
        let corner4 = this.pointerFlags.position.copy();
        this.pointerFlags.selectionArea = new Rectangle(corner1, undefined, new Dimension(0, 0));
        this.pointerFlags.selectionArea.segments = [
            new Segment(corner1, corner2),
            new Segment(corner2, corner3),
            new Segment(corner3, corner4),
            new Segment(corner4, corner1)
        ];
        this.newlySelectedBlocks = new Array();
        this.findBlocksInCurrentSelectionArea(event);

        this.draw = (context = this.context, alphas) => {
            BoardEditor.prototype.draw.call(this, context, alphas);
            this.drawSelectionArea(context);
        };
    }
,
    leaveSubMode: function (event, displacingBlocks = this.selectedBlocks) {
        this.verifyDisplaced(displacingBlocks);
        this.pointerFlags.grabPoint.x = undefined;
        this.pointerFlags.grabPoint.y = undefined;
        delete this.pointerFlags.selectionPolygon;
        delete this.newlySelectedBlocks;
        delete this.notDeselectedBlocks;
        delete this.deselectedBlocks;
        delete this.draw; //resorts back to the prototype's method
    }
,
    getAlphas: function () { return { "blocks": 0.4, "notDeselectedBlocks": this.pointerFlags.ctrl ? 0.8 : 0.6, "displacedBlocks": this.pointerFlags.ctrl ? 0.6 : 0.8, "newlySelectedBlocks": 1 }; } 
,   get ctrl() { return this.pointerMoved; }
,
    pointerMoved: function (event) {
        if (this.pointerFlags.depressed) this.findBlocksInCurrentSelectionArea(event);
        //else throw new Error("selecting submode should only be active while pointer is depressed");
        //^^^ CHANGE 12-29-2020, depressed flag turns false before click is invoked async (in ClickableObject.pointerup) in in order to account for pointercancel events
        this.draw();
    }
,
    pointerEvent: function (event) {
        if (this.pointerFlags.depressed) {
            //expanding/contracting selection area
            this.findBlocksInCurrentSelectionArea(event);
        } else { //pointer was released off-board or other cancel event
            if (event.type === POINTER_UP) this.click(event);
            else {
                //console.log(event);
                this.esc(event);
            }
        }
        this.draw();
    }
,
    esc: function (event) {
        /*if (event.type === "keydown")*/ this.escapeFromClick();
        this.setSubMode(BoardEditor.select.resting, event);
    }
,
    click: function (event) {
        //this.hasUpdates = true; //TO DO -- refine this ... not all events have changes

        //add or change selection
        this.findBlocksInCurrentSelectionArea(event);
        
        if (event.ctrlKey) {
            this.newlySelectedBlocks.unshift(...this.notDeselectedBlocks);
            if (event.shiftKey) {
                this.newlySelectedBlocks.push(...this.findDisplaced(this.deselectedBlocks));
            } else {
                this.findDisplaced(this.deselectedBlocks)
                this.recycleBlocks();
            }
            this.selectedBlocks = this.newlySelectedBlocks;
            this.findDisplaced();
            this.setSubMode(BoardEditor.select.resting, event)

        } else if (event.shiftKey) {
            this.verifyDisplaced();
            if (this.displacedBlocks.length > 0) {
                let oldSelected = this.selectedBlocks; //to appease the verifyDisplaced safety check
                this.selectedBlocks = this.newlySelectedBlocks;
                let displaced = this.recycleBlocks();
                this.findDisplaced(oldSelected); //to appease the verifyDisplaced safety check
                this.setSubMode(BoardEditor.addBlocks, event, displaced, oldSelected);
            } else {
                this.selectedBlocks = this.newlySelectedBlocks;
                this.setSubMode(BoardEditor.select.resting, event);
            }
        } else {
            this.verifyDisplaced();
            this.recycleBlocks();
            this.selectedBlocks = this.newlySelectedBlocks;
            this.setSubMode(BoardEditor.select.resting, event);
        }

        this.draw();
    }
,
    verifyDisplaced: function (displacingBlocks = this.selectedBlocks) { //safety check
        //NOTE: Safari on iphone threw this error at least once (possibly due to more than one pointer acting at once???)
        let oldDisplaced = this.displacedBlocks;
        let newDisplaced = this.findDisplaced(displacingBlocks);
        if (oldDisplaced.length !== newDisplaced.length) throw new Error("changing selected blocks should not alter the displaced blocks from the old selection, AND newly selected blocks should not be displacing anything!!");
        for (let i = 0; i < oldDisplaced.length; i++) {
            if (oldDisplaced[i] !== newDisplaced[i]) throw new Error("changing selected blocks should not alter the displaced blocks from the old selection, AND newly selected blocks should not be displacing anything!!");;
        }
    }
,
    findBlocksInCurrentSelectionArea: function (event) {
        let selection = this.pointerFlags.selectionArea;
        if (Number.isFinite(event.offsetX) && Number.isFinite(event.offsetY)) { //keyboard events just use the pre-existing selection
            selection.x = Math.min(event.offsetX, this.pointerFlags.grabPoint.x);
            selection.y = Math.min(event.offsetY, this.pointerFlags.grabPoint.y);
            selection.width = Math.abs(event.offsetX - this.pointerFlags.grabPoint.x);
            selection.height = Math.abs(event.offsetY - this.pointerFlags.grabPoint.y);
            selection.segments[1].point1.updateFromCoordinates(selection.x, selection.y + selection.height);
            selection.segments[2].point1.updateFromCoordinates(selection.x + selection.width, selection.y + selection.height);
            selection.segments[3].point1.updateFromCoordinates(selection.x + selection.width, selection.y);

            selection.width = selection.segments[1].length(); //need to recalc because of rounding imposed by Position class (but not imposed by Dimension class)
            selection.height = selection.segments[0].length();
        }

        this.newlySelectedBlocks.length = 0;


        if (selection.width > 0 && selection.height > 0) {
            try {
                selection.segments.forEach((segment) => { segment.recalc(); }); //source of errors in iphone Safari
            } catch (err) {
                console.error(err, new Rectangle(selection.x, selection.y, selection.width, selection.height), selection.segments.map(point => new Position(point.x, point.y)));
            }
            var testLine1 = new Segment(selection.segments[0].point1, new Position(this.boardTemplate.x + this.boardTemplate.width + 1), selection.segments[0].point1.y);
            var testLine2 = new Segment(undefined, new Position(this.boardTemplate.x + this.boardTemplate.width + 1), selection.segments[0].point1.y);
        } else if (selection.width > 0) { var line = selection.segments[1]; line.recalc(); }
        else if (selection.height > 0) { line = selection.segments[0]; line.recalc(); }

        this.notDeselectedBlocks = [...this.selectedBlocks];
        this.deselectedBlocks = new Array();

        for (let i = this.boardTemplate.blocks.length + this.selectedBlocks.length - 1; i >= 0; i--) {
            let block;
            if (i >= this.boardTemplate.blocks.length) { //start by iterating over selectedBlocks array in reverse order
                block = this.selectedBlocks[i - this.boardTemplate.blocks.length];

            } else  { //iterate over full blocks array in reverse order, skipping blocks already in the selectedBlocks array
                while (i >= 0) {
                    block = this.boardTemplate.blocks[i];
                    if (this.selectedBlocks.indexOf(block) > -1) i--;
                    else break;
                }
                if (i < 0) break;
            }

            //if (this.displacedBlocks.indexOf(block) > -1) continue;


            let addBlock = false;
            if (this.pointerFlags.position.defined && block.inside(this.pointerFlags.position, true) && block.inside(this.pointerFlags.grabPoint, true)) {
                //if entirely inside a single polygon, then select/de-select only that polygon
                //NOTE: THIS MAY NOT BE DESIRABLE FOR IRREGULAR/CONCAVE-SHAPED BLOCKS THAT HAVE OTHER BLOCKS IN THEIR "CREVICES."  CONSIDER RE-WRITING THIS PART
                if (event.ctrlKey) {
                    let ndsi = this.notDeselectedBlocks.indexOf(block);
                    if (ndsi > -1) {
                        if ((this.notDeselectedBlocks.length !== this.selectedBlocks.length) || this.deselectedBlocks.length > 0) throw new Error("It appears there are overlapping blocks in the currently selected blocks array!");
                        this.notDeselectedBlocks.splice(ndsi, 1);
                        this.deselectedBlocks.push(block);
                        this.newlySelectedBlocks.length = 0;
                        break;
                    }
                }
                this.newlySelectedBlocks.length = 1;
                this.newlySelectedBlocks[0] = block;
                break;
            }
            if (line) {
                for (let s = 0; s < block.surfaces.length; s++) {
                    if (line.intersectionWith(block.surfaces[s], true, true, true, true)) {
                        addBlock = true;
                        break;
                    }
                }
            } else if (testLine1) addBlock = block.overlapsWith(selection, false, testLine1, testLine2);

            if (addBlock) {
                if (event.ctrlKey) {
                    let ndsi = this.notDeselectedBlocks.indexOf(block);
                    if (ndsi > -1) {
                        this.deselectedBlocks.push(this.notDeselectedBlocks.splice(ndsi, 1)[0]);
                        continue;
                    }
                }
                this.newlySelectedBlocks.push(block);
            }

        }
    }
,
    drawSelectionArea: function (context = this.context) {
        context.lineWidth = 1.5;
        context.setLineDash([5, 3]);
        context.strokeStyle = WHITE.string;
        let segments = this.pointerFlags.selectionArea.segments;
        let startingIndex = 0;
        while (segments[startingIndex].point1.notEqualTo(this.pointerFlags.grabPoint)) { startingIndex++; }

        context.beginPath();
        context.moveTo(segments[startingIndex].point1.x, segments[startingIndex].point1.y);
        let i = startingIndex;
        do {
            context.lineTo(segments[i].point2.x, segments[i].point2.y);
            if (i < segments.length - 1) i++; else i = 0;
        } while (i !== startingIndex);

        context.stroke();
        context.setLineDash([]);
    }
}

Object.defineProperty(BoardEditor.select, "selecting", { enumerable: false });



BoardEditor.select.grabAndDrag = {
    initializeSubMode: function (event, arg) { this.canvas.style.cursor = "grabbing"; },
    getAlphas: function (event) { return { "blocks": 0.6, "selectedBlocks": 1, "displacedBlocks": 0.8 } }
,
    pointerMoved: function (event) {
        //CHANGE 12-29-2020, depressed flag turns false before click is invoked async (in ClickableObject.pointerup) in in order to account for pointercancel events
        //if (this.adjustBlockPointerPosition()) {
        if (this.pointerFlags.depressed && this.adjustBlockPointerPosition()) {
            this.moveSelectedBlocks();
            this.draw();
        }
        //if (!this.pointerFlags.depressed) throw new Error("pointer must be depressed in grabAndDrag SubMode!");

        //this.aspect();
    }
,
    pointerEvent: function (event) {
        if (this.pointerFlags.depressedAndOver) {
            //selection was already grabbed and is still being held/dragged
            if (this.adjustBlockPointerPosition()) {
                this.moveSelectedBlocks();
            }
        } else if (this.pointerFlags.depressed) { //cursor moved off-board but still grabbing pointer blocks or holding a selection area start-point
            if (!this.pointerFlags.cancelPossible || this.pointerFlags.position.defined) throw new Error();
            if (this.adjustBlockPointerPosition()) {
                this.moveSelectedBlocks();
            }
        } else { //pointer was released off-board
            this.esc(event);
        }
        this.draw();
    }
,
    esc: function (event) {
        /*if (event.type === "keydown")*/ this.escapeFromClick();
        this.pointerFlags.grabPoint.updateFromCoordinates(undefined, undefined);
        if (this.adjustBlockPointerPosition()); {
            this.moveSelectedBlocks();
        }
        this.findDisplaced();
        this.setSubMode(BoardEditor.select.resting, event);
    }
,
    click: function (event) {
        this.hasUpdates = true;

        //release grabbed blocks in the new location

        if (this.adjustBlockPointerPosition())
            this.moveSelectedBlocks();
        this.findDisplaced();

        if (event.shiftKey && this.displacedBlocks.length > 0) {
            /*this.displacedBlocks.selectedBefore = new Array(this.displacedBlocks.length).fill(false);
            for (let i = 0; i < this.selectedBlocks.length; i++) {
                //remove any displaced blocks from the currently selected
                let di = this.displacedBlocks.indexOf(this.selectedBlocks[i]);
                if (di > -1) {
                    this.displacedBlocks.selectedBefore[di] = true;
                    this.selectedBlocks.splice(i, 1);
                    i--;
                }
            }*/

            let displaced = this.recycleBlocks();
            this.setSubMode(BoardEditor.addBlocks, event, displaced);

        } else {
            this.pointerFlags.grabPoint.updateFromCoordinates(undefined, undefined);
            this.setSubMode(BoardEditor.select.resting, event);
        }
        this.draw();
    }
,
    moveSelectedBlocks: function () {
        if (this.pointerFlags.blockPosition.defined) {
            this.selectedBlocks.forEach((block, index) => {
                block.moveTo(this.selectedBlocks.relativePositions[index].x + this.pointerFlags.blockPosition.x, this.selectedBlocks.relativePositions[index].y + this.pointerFlags.blockPosition.y);
            });
        } else {
            this.selectedBlocks.forEach((block, index) => {
                block.moveTo(this.selectedBlocks.relativePositions[index].x + this.selectedBlocks.x, this.selectedBlocks.relativePositions[index].y + this.selectedBlocks.y);
            });
        }
    }
}

Object.defineProperty(BoardEditor.select, "grabAndDrag", { enumerable: false });

initializeLogger?.("editor.modes ran");