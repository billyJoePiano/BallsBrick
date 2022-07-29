"use strict"; document.currentScript.initTime = performance.now();

class BoardEditor extends ClickableObject {

    constructor(blckTemplts = blockTemplates) {
        super();

        this.displacedBlocks = new Array();
        this.selectedBlocks = new Array();

        //mode selector at the top
        let modeSelector = new TabButtonGroup(["esc", "add Blocks", "PLAY", /*"spacebar",*/ "FILE"], [this.boardSelector, undefined, undefined]);

        //selection mode (crosshair cursor)
        let selectionModeButton = modeSelector.buttons[0];
        selectionModeButton.onSelect = (event, button, alreadySelected) => { //selection mode button
            this.setMode(BoardEditor.select, event, true); //'true' arg indicates this call is coming from the button, rather than from another editor mode
            modeButtonsShorthand.current = selectionModeButton;
        }
        Object.defineProperty(selectionModeButton, "div", { get: () => modeSelector.currentDiv });

        modeSelector.htmlDiv.classList.add('editor');
        modeSelector.currentButton = selectionModeButton; //selection is default starting mode.
        //This button will be 'clicked' by newBoardTemplate() when invoked from the first startEditing()


        //add blocks mode

        const passedThroughBlockSelector = Symbol("Passed through block selector event handler");
        // signals the addBlocksModeButton to copy blocks and push out to setMode()
        // also signals the group selector not to choose a default block

        const addBlocksModeButton = modeSelector.buttons[1];
        const EDITOR = this;
        addBlocksModeButton.onSelect = function selectAddBlocksMode(event) {
            if (event[passedThroughBlockSelector]) {
                delete event[passedThroughBlockSelector];
                if (this.blocksToAdd instanceof Array) {
                    let pointerBlocks = new Array();
                    this.blocksToAdd.forEach((block) => {
                        let copy = block.copy();
                        copy.board = EDITOR.boardTemplate;
                        pointerBlocks.push(copy);
                    });
                    EDITOR.setMode(BoardEditor.addBlocks, event, pointerBlocks);

                } else if (this.objectToDraw instanceof Block) {
                    let newBlock = this.objectToDraw.copy();
                    newBlock.board = EDITOR.boardTemplate;
                    EDITOR.setMode(BoardEditor.addBlocks, event, newBlock);

                    modeButtonsShorthand.current = addBlocksModeButton;

                } else throw new Error("add blocks button cannot determine what to do");

            } else {
                //means the click event (or programatic invocation) originates from here
                //invoke the current/default group button, which will invoke the current/default block button (and end up back here)
                (blockGroupSelector.currentButton ?? blockGroupSelector.buttons[0]).onClick(event);
            }
        }



        //block & group selectors, for add blocks mode

        let blockGroupSelector = new TabButtonGroup(
            [...BoardEditor.numberShortcutKeys.slice(0, blockTemplates.length), "Recycled"],
            undefined,
            undefined,
            function selectBlockGroup(event) {
                if (event[passedThroughBlockSelector]) {
                    addBlocksModeButton.objectToDraw = this.objectToDraw;
                    if (this.blocksToAdd) addBlocksModeButton.blocksToAdd = this.blocksToAdd;
                    else delete addBlocksModeButton.blocksToAdd;
                    addBlocksModeButton.onClick(event);

                } else {
                    //means the click event (or programatic invocation) originates from either here OR addBlocksModeButton
                    (this.blockSelector.currentButton //find a default button to 'click' programatically
                        ?? this.blockSelector.buttons[0]
                        ?? blockGroupSelector.currentButton
                        ?? blockGroupSelector.buttons[0]
                    ).onClick(event);
                }
            },
        );

        addBlocksModeButton.div = blockGroupSelector.htmlDiv;

        //block selector panels

        [...blckTemplts, [/*recycled blocks*/]].forEach((group, index) => {
            let groupButton = blockGroupSelector.buttons[index];
            groupButton.blockSelector = new SelectionButtonGroup(
                BoardEditor.letterShortcutKeys.slice(0, group.length),
                group,
                function selectBlock(event) {
                    event[passedThroughBlockSelector] = true; //signals addBlocksModeButton that the block selector has run
                    groupButton.objectToDraw = this.objectToDraw;
                    if (this.blocksToAdd) groupButton.blocksToAdd = this.blocksToAdd;
                    else delete groupButton.blocksToAdd;
                    groupButton.onClick(event);
                }
            );

            groupButton.div = groupButton.blockSelector.htmlDiv;
            groupButton.objectToDraw = group[0];
        });



        let recycleBin = blockGroupSelector.buttons.pop().blockSelector;



        let playModeButton = modeSelector.buttons[2];
        // onClick function replaced instead of onSelect so the mode selection doesn't change
        Object.defineProperty(playModeButton, "onClick", { value: () => this.startPlaying() });
        

        let fileModeButton = modeSelector.buttons[3];
        fileModeButton.onSelect = () => modeButtonsShorthand.current = fileModeButton;
        fileModeButton.fileOptions = new SelectionButtonGroup(
            ["SAVE", "OPEN"],
            undefined, undefined,
        );
        fileModeButton.div = fileModeButton.fileOptions.htmlDiv;

        Object.defineProperty(fileModeButton.fileOptions.buttons[0], "onClick", {
            value: (event) => { //save
                let filename = prompt("Enter File Name to download \n(.brd extension will be automatically added)");
                if (filename && filename.length >= 1)
                    downloadToLocal(filename + ".brd", this.boardTemplate);
                else alert("Invalid filename, download cancelled");
            }
        });

        Object.defineProperty(fileModeButton.fileOptions.buttons[1], "onClick", {
            value: async function openBoardTemplate(event) {
                let revived = JSONreviver.parse(await openLocalFileAsText(".brd"));
                
                if (revived.result instanceof BoardTemplate) {
                    board = new Board(revived.result);

                    if (UI.board.object instanceof Board) {
                        if (Engine.isRunning()) Engine.terminate(Engine.intervalHandler);
                        UI.board.installNewTargetObject(board);
                        board.firstRound();

                    } else if (UI.board.object instanceof BoardEditor) {
                        UI.board.object.newBoardTemplate(board.template, event);
                    }

                } else alert("this file could not be converted into a BoardTemplate");
            }
        });

        let modeButtonsShorthand = {
            select: selectionModeButton,
            addBlocks: addBlocksModeButton,
            file: fileModeButton,
            current: selectionModeButton,
        }

        defineProperties(this, {
            currentModeButton: {
                get: () => {
                    for (let name in modeButtonsShorthand) {
                        if (modeButtonsShorthand[name] === modeButtonsShorthand.current && name !== "current")
                            return name;
                    }
                    throw new Error("Could not find the associated name for current mode button");
                }
            },
            clickCurrentModeButton: {
                value: function clickCurrentModeButton(event) {
                    modeButtonsShorthand.current.onClick(event);
                }
            },
            clickModeButton: {
                value: function clickModeButton(name, event) {
                    if (name in modeButtonsShorthand) {
                        modeButtonsShorthand[name].onClick(event);

                    } else throw new Error("Mode button " + name + " does not exist");
                }
            },
            recycleBlocks: {
                value: function recycleBlocks(propertyName = "displacedBlocks", addToRecycleBin = true) {
                    this[propertyName].forEach((block) => {
                        let index = this.boardTemplate.blocks.indexOf(block);
                        if (index > -1) this.boardTemplate.blocks.splice(index, 1);
                        else throw new Error("blocks being recycled should be on the board still, until they are recycled");
                    });

                    let result = this[propertyName];
                    this[propertyName] = new Array();

                    if (result.length > 0 && addToRecycleBin) {
                        new SelectionButton(recycleBin, recycleBin.buttons.length.toString(), result[0]).blocksToAdd = result;
                    }

                    return result;
                }
            },
            hasUpdates: {
                get: () => hasUpdates !== (hasUpdates = false),
                set: valueIgnored => {
                        window.onpagehide = null;
                        window.onbeforeunload = onbeforeunload;
                        hasUpdates = true;
                    },
                configurable: false
            },
            onbeforeunload: {
                get: () => onbeforeunload,
                set: listener => {
                    if (onbeforeunload !== null) throw new Error();
                    onbeforeunload = listener;
                    window.onpagehide = listener;
                    window.onbeforeunload = null;
                },
                configurable: false
            }
        });

        let hasUpdates = false;
        let onbeforeunload = null;




        this.buttonDiv = modeSelector.htmlDiv;

        this.shortcutKeys = [];

        this.pointerFlags.grabPoint = new Position();
        this.pointerFlags.blockPosition = new Position();
        this.animateAntsMarching = this.animateAntsMarching.bind(this);
        this.updateKeyFlags = this.updateKeyFlags.bind(this);
        this.keyFlags = new Array(256);

        this.antsMarching = {
            dashPattern: [3, 3],
            dashOffset: 0,
            turnaround: 6
            /*get turnaround() { //lazy getter
                Object.defineProperty(this, "turnaround", { value: mySum(this.dashPattern) });
                return this.turnaround;
            }*/
        }
    }

    get blocks() { return this.boardTemplate.blocks; }

    startEditing(boardTemplate = UI.board.object?.template, playtimeButtonsDiv, event) {
        if (Engine.isRunning()) Engine.terminate(Engine.intervalHandler);

        this.playtimeButtonsDiv = playtimeButtonsDiv;
        playtimeButtonsDiv.remove();

        document.body.appendChild(this.buttonDiv);

        UI.board.installNewTargetObject(this, false);
        document.addEventListener("keydown", this.updateKeyFlags);
        document.addEventListener("keyup", this.updateKeyFlags);
        this.keyFlags.fill(false);

        if (boardTemplate === this.boardTemplate) {
            this.resetPointerFlags(); //done in newBoardTemplate() in other conditional branch, probably unneccessary here, but better to be cautious
            this.clickCurrentModeButton(event); //same as above, but definitely neccessary here
            this.engine.requestAnimation(() => { }); //empty function, causes engine to restart in idle.  Ants marching should still be in the queue.
            this.draw();
        } else {
            this.newBoardTemplate(boardTemplate, event);
            if (this.mode === undefined) this.setMode(BoardEditor.select);
        }
    }

    newBoardTemplate(template, event) {
        if (!(template instanceof BoardTemplate)) throw new Error("Only boardTemplates can be edited!");
        if (template.engine instanceof Engine) throw new Error("Board template should not have a pre-installed engine");

        if (Engine.isRunning()) Engine.terminate(Engine.intervalHandler);
        this.resetPointerFlags();

        this.boardTemplate = template;
        this.rct = template.rectangle;

        this.selectedBlocks = new Array();
        this.pointerBlocks = new Array();
        this.displacedBlocks = new Array();

        template.blocks.forEach((block) => {
            if (!block.surfaces) block.generateSurfaces();
        });

        this.engine = new Engine(this);
        this.boardTemplate.engine = new Engine(this); //not sure if this is neccessary, but if so, it requires the next line...
        Object.defineProperty(this.boardTemplate, "engine", { enumerable: false }); //...for JSON stringifying.  don't want to stringify engine

        this.clickCurrentModeButton(event);
        this.engine.requestAnimation(this.animateAntsMarching);
        this.draw();

    }

    animateAntsMarching(frameSeconds) {
        if (this.selectedBlocks.length > 0) {
            this.antsMarching.dashOffset += 8 * frameSeconds;
            while (this.antsMarching.dashOffset > this.antsMarching.turnaround) this.antsMarching.dashOffset -= this.antsMarching.turnaround;
            this.draw();
        }
        this.engine.requestAnimation(this.animateAntsMarching);
    }

    startPlaying(boardTemplate = this.boardTemplate) {
        this.resetPointerFlags();

        Engine.terminate(this.engine.runIdleQueues);

        document.removeEventListener("keydown", this.updateKeyFlags);
        document.removeEventListener("keyup", this.updateKeyFlags);

        this.buttonDiv.remove();
        document.body.appendChild(this.playtimeButtonsDiv);

        UI.board.installNewTargetObject(board = new Board(boardTemplate));
        board.firstRound();
    }

    setMode(editorMode, event, argForNew, argForOld) {
        this.leaveMode?.(event, argForOld);
        for (let func in this.mode) {
            delete this[func];
        }
        this.mode = editorMode;
        for (let func in editorMode) {
            this[func] = editorMode[func];
        }
        this.initializeMode?.(event, argForNew);
    }

    updateKeyFlags(event) {
        //console.log(event);
        if (this.pointerFlags.shift !== (this.pointerFlags.shift = event.shiftKey)) this.shift?.(event);
        if (this.pointerFlags.ctrl !== (this.pointerFlags.ctrl = event.ctrlKey)) this.ctrl?.(event);
        if (this.pointerFlags.alt !== (this.pointerFlags.alt = event.altKey)) this.alt?.(event);

        if (event.type === "keyup") this.keyFlags[event.which] = false;

        if (event.type === "keydown") {
            this.keyFlags[event.which] = true;
            let keyCount = this.countKeyFlags();
            if (keyCount === 1) {
                if (event.which === 27) this.esc?.(event); //escape key
                else if (event.which === 13) this.enter?.(event); //enter key
                else if (event.which === 8 || event.which == 46) this.delete?.(event); //delete/backspace keys
                else {
                    if (event.key === 'e') throw new Error("testing");
                    for (let i = 0; i < this.shortcutKeys.length; i++) {
                        if (this.shortcutKeys[i] === event.key) {
                            this.blockSelector.buttons[i].onClick(event);
                            break;
                        }
                    }
                }
            } else if (keyCount === 2) {
                if (event.which === 88 && event.ctrlKey) this.cut?.(event); //ctrl+X
                else if (event.which === 67 && event.ctrlKey) this.copy?.(event); //ctrl+C
                else if (event.which === 86 && event.ctrlKey) this.paste?.(event); //ctrl+V
                else if (event.which === 90 && event.ctrlKey) this.undo?.(event); //ctrl+Z
                else if (event.which === 89 && event.ctrlKey) this.redo?.(event); //ctrl+Y
            }
        }
        this.draw();
    }

    countKeyFlags() {
        let result = 0;
        this.keyFlags.forEach((key) => { if (key) result++; });
        return result;
    }

    getAlphas() { return {"blocks": 1}; } //dummy method for initial draw(context) called by UI.  This is replaced by the editor modes

    adjustBlockPointerPosition(pointerPosition = this.pointerFlags.position, blockPosition = this.pointerFlags.blockPosition, grabPointOffset = this.pointerFlags.grabPoint) {
        //returns true if blockPosition moved, false if not
        let oldX = blockPosition.x;
        let oldY = blockPosition.y;
        if (pointerPosition.defined && this.pointerFlags.grabPoint.defined) {
            blockPosition.x = pointerPosition.x - grabPointOffset.x;
            blockPosition.y = pointerPosition.y - grabPointOffset.y;
            this.snapToGrid?.(blockPosition);
        } else {
            blockPosition.x = undefined;
            blockPosition.y = undefined;
        }
        return blockPosition.x === oldX && blockPosition.y === oldY;
    }

    snapToGrid(blockPosition) { //delete this function from the BoardEditor instance to eliminate snapping to grid
        blockPosition.x = Math.round(blockPosition.x / this.snapSpacing) * this.snapSpacing;
        blockPosition.y = Math.round(blockPosition.y / this.snapSpacing) * this.snapSpacing;
    }


    findDisplaced(displacedBy = this.selectedBlocks) {
        this.displacedBlocks = new Array();

        let blocks = this.boardTemplate.blocks;
        for (let c = 0; c < displacedBy.length; c++) {
            let block = displacedBy[c];
            if (!block.surfaces) block.generateSurfaces();
            let testLine1 = new Segment(block.surfaces[0].point1, new Position(this.boardTemplate.x + this.boardTemplate.width + 1), block.surfaces[0].point1.y);
            let testLine2 = new Segment(undefined, new Position(this.boardTemplate.x + this.boardTemplate.width + 1), block.surfaces[0].point1.y);

            if (block.bouncePriority < 3) {
                for (let i = 0; i < blocks.length; i++) {
                    if (blocks[i].bouncePriority >= 3 || this.displacedBlocks.indexOf(blocks[i]) > -1 || blocks[i] === block) continue;
                    //if (!blocks[i].surfaces) blocks[i].generateSurfaces();
                    if (block.overlapsWith(blocks[i], false, testLine1, testLine2)) {
                        this.displacedBlocks.push(blocks[i]);
                    }
                }
            }
        }
        return this.displacedBlocks;
    }

    draw(context = this.context, alphas = this.getAlphas()) {
        context.fillStyle = BLACK.string;
        context.fillRect(this.boardTemplate.x, this.boardTemplate.y, this.boardTemplate.width, this.boardTemplate.height);
        if (this.gridlinesSpacing) {
            context.beginPath();
            context.strokeStyle = WHITE.string;
            context.setLineDash([this.gridlinesSpacing * 9 / 128, this.gridlinesSpacing * 23 / 128]);
            context.lineWidth = 1;
            for (let x = this.boardTemplate.x + this.gridlinesSpacing; x < this.boardTemplate.x + this.boardTemplate.width; x += this.gridlinesSpacing) {
                context.moveTo(x, this.boardTemplate.y);
                context.lineTo(x, this.boardTemplate.y + this.boardTemplate.height);
            }
            for (let y = this.boardTemplate.y + this.gridlinesSpacing; y < this.boardTemplate.y + this.boardTemplate.height; y += this.gridlinesSpacing) {
                context.moveTo(this.boardTemplate.x, y);
                context.lineTo(this.boardTemplate.x + this.boardTemplate.width, y);
            }
            context.stroke();
            context.setLineDash([]);
        }

        let dashAlpha;

        for (let blockArray in alphas) {
            if ((context.globalAlpha = alphas[blockArray]) === 0) continue;
            if (blockArray === "blocks") {
                this.blocks.forEach((block) => {
                    for (let otherBlockArray in alphas) {
                        if (otherBlockArray === "blocks") continue;
                        try {
                            if (this[otherBlockArray].indexOf(block) > -1) return; //source of errors in iphone Safari
                        } catch (err) {
                            //console.error(err, otherBlockArray);
                        }
                    }
                    block.draw(context);
                });
            } else if (blockArray === "dash") {
                dashAlpha = alphas[blockArray];
            } else {
                this[blockArray].forEach((block) => {
                    block.draw(context);
                });
            }
        }

        if (dashAlpha === undefined) dashAlpha = 1;
        context.globalAlpha = dashAlpha;
        context.setLineDash(this.antsMarching.dashPattern);
        context.lineDashOffset = this.antsMarching.dashOffset;
        context.lineWidth = 1.25;
        context.strokeStyle = WHITE.string;
        this.selectedBlocks.forEach((block) => {
            if (block instanceof SimpleRectangleBlock) context.strokeRect(block.x, block.y, block.width, block.height);
            else if (block instanceof ShapedBlock) {
                context.beginPath();
                context.moveTo(block.points[0].x, block.points[0].y);
                block.points.forEach((point) => context.lineTo(point.x, point.y));
                context.lineTo(block.points[0].x, block.points[0].y);
                context.stroke();
            } else throw new Error("unrecognized block type!");
        });
        context.setLineDash([]);
        context.lineDashOffset = 0;

        context.globalAlpha = 1;
    }

    updateBlockArrayCaches(blocks = this.selectedBlocks, resetOriginalPositionsCache = false) {
        let x = Number.POSITIVE_INFINITY;
        let y = Number.POSITIVE_INFINITY;
        let xMax = Number.NEGATIVE_INFINITY;
        let yMax = Number.NEGATIVE_INFINITY;
        blocks.forEach((block) => {
            x = Math.min(x, block.x);
            y = Math.min(y, block.y);
            xMax = Math.max(xMax, block.x + block.width);
            yMax = Math.max(yMax, block.y + block.height);
        });

        if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(xMax) && Number.isFinite(yMax)) {
            //this.pointerFlags.blockPosition.updateFromCoordinates(x, y)
            blocks.x = x;
            blocks.y = y;
            blocks.width = xMax - x;
            blocks.height = yMax - y;
            blocks.xMax = xMax;
            blocks.yMax = yMax;
            if (!blocks.originalPositions || resetOriginalPositionsCache) blocks.originalPositions = new Array();
            blocks.relativePositions = new Array(blocks.length);

        } else {
            if (blocks.length > 0) throw new Error("unexpected result in updateBlockArrayCaches function!  if there are selectedBlocks there should be a finite x and y value!");
            //this.pointerFlags.blockPosition.updateFromCoordinates(undefined, undefined);
            delete blocks.x;
            delete blocks.y;
            delete blocks.width;
            delete blocks.height;
            delete blocks.xMax;
            delete blocks.yMax;
            delete blocks.originalPositions;
            delete blocks.recentPositions;
        }

        for (let i = 0; i < blocks.length; i++) {
            if (!blocks.originalPositions[i]) blocks.originalPositions[i] = blocks[i].position.copy();
            blocks.relativePositions[i] = blocks[i].position.copy();
            blocks.relativePositions[i].x -= x; //relative to the group 'x' and 'y'
            blocks.relativePositions[i].y -= y;
        }
    }

    delete(event) {
        this.recycleBlocks("selectedBlocks");
        this.draw();
    }

    /*aspect() {
        if (this.blocks[0] instanceof BombBlock && this.blocks[1]) {
            this.blocks[0].explode();
            let aspects = [];
            let sum = 0;
            let string = ""
            let surfaces = this.blocks[0].unaffectedBlocks[0]?.unaffectedSurfaces;
            surfaces?.forEach((surface, index) => {
                aspects.push(surface.aspectLength);
                sum += surface.aspectLength;
                string += "  surface" + index + ": " + surface.aspectLength.toFixed(3);
            });

            if(sum !== 0 || string !== "")
                console.log(sum + string + "   actual distance: " + surfaces[0].surface.point1.distanceTo(surfaces[surfaces.length - 1].surface.point2));
        }
    }*/
}

BoardEditor.letterShortcutKeys = ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', 'a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'z', 'x', 'c', 'v', 'b', 'n', 'm'];
BoardEditor.numberShortcutKeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

BoardEditor.prototype.gridlinesSpacing = Block.standardSize;
BoardEditor.prototype.snapSpacing = Block.standardSize / 2;

BoardEditor.prototype.boardSelector = Object.freeze({
    width: 20,
    height: 20,
    drawAt: function (x, y, context) {
        let imageSmoothingEnabled = context.imageSmoothingEnabled;
        context.imageSmoothingEnabled = false;

        context.fillStyle = BLACK.string;
        context.fillRect(x, y, this.width, this.height);

        //offset centers:
        let leftX = x + this.width / 2 - 1;
        let rightX = x + this.width / 2 + 1;
        let topY = y + this.height / 2 - 1;
        let bottomY = y + this.height / 2 + 1;

        context.lineWidth = 0.95;
        context.strokeStyle = WHITE.string;
        context.beginPath();

        //draw the outline of a cross-hairs
        context.moveTo(x, topY);
        context.lineTo(x, bottomY);
        context.lineTo(leftX, bottomY);
        context.lineTo(leftX, y + this.height);
        context.lineTo(rightX, y + this.height);
        context.lineTo(rightX, bottomY);
        context.lineTo(x + this.width, bottomY);
        context.lineTo(x + this.width, topY);
        context.lineTo(rightX, topY);
        context.lineTo(rightX, y);
        context.lineTo(leftX, y);
        context.lineTo(leftX, topY);
        context.lineTo(x, topY);

        context.stroke();

        context.imageSmoothingEnabled = imageSmoothingEnabled;

    },
});

initializeLogger?.("editor ran");