"use strict"; document.currentScript.initTime = performance.now();

class BoardTemplate extends ClickableObject {

    constructorArgs() { return ["blocks"]; }

    constructor(boardTemplate) {
        if (boardTemplate instanceof BoardTemplate) {
            super(boardTemplate.rectangle)
            this.balls = boardTemplate.balls;
            this.ballOrigin = boardTemplate.ballOrigin.copy();
            this.ballVelocity = boardTemplate.ballVelocity.copy();
            this.ballFireInterval = boardTemplate.ballFireInterval;

            this.blocks = new Array(boardTemplate.blocks.length)
            boardTemplate.blocks.forEach((block, index) => {
                let blockCopy = block.copy();
                blockCopy.board = this;
                this.blocks[index] = blockCopy;
            });
            this.blocks.sort((block1, block2) => { return block2.bouncePriority - block1.bouncePriority; })
            
        } else {
            super(new Rectangle(0, 0, UI.board.canvas.baselineWidth ?? UI.board.canvas.width, UI.board.canvas.baselineHeight ?? UI.board.canvas.height));
            this.balls = BoardTemplate.defaultBalls;
            this.ballOrigin = new Position(this.x + this.width / 2, this.y + this.height - Ball.standardRadius - 1);
            this.ballVelocity = new Velocity(500, 90);
            this.ballVelocity.direction.range = ANGLE_RANGE_360.mostlyPositive;
            this.ballFireInterval = 0.109375 //0.0625  // 0.0715;
            if (boardTemplate instanceof Array) { //array of blocks
                this.blocks = new Array(boardTemplate.length)
                boardTemplate.forEach((block, index) => {
                    let blockCopy = block.copy();
                    blockCopy.board = this;
                    this.blocks[index] = blockCopy;
                });
                this.blocks.sort((block1, block2) => { return block2.bouncePriority - block1.bouncePriority; })
            } else this.blocks = new Array();
        }
    }

    addBlock(block) {
        //convinence method for sorting by bouncePriority and installing the block.board property
        let i = 0;
        while (i < this.blocks.length && this.blocks[i].bouncePriority >= block.bouncePriority) { i++; }
        this.blocks.splice(i, 0, block);
        this.blocks[i].board = this;
    }
}

BoardTemplate.defaultBalls = 100;


initializeLogger?.("board.template ran");