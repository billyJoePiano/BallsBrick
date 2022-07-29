"use strict"; document.currentScript.initTime = performance.now();

class BoardTemplate extends ClickableObject {
    constructor(boardTemplate) {
        if (boardTemplate instanceof BoardTemplate) {
            super(boardTemplate.rectangle)

            this.blocks = new Array(boardTemplate.blocks.length)
            boardTemplate.blocks.forEach((block, index) => {
                let blockCopy = block.copy();
                blockCopy.board = this;
                this.blocks[index] = blockCopy;
            });
            this.blocks.sort((block1, block2) => { return block2.bouncePriority - block1.bouncePriority; })

        } else {
            super(new Rectangle(0, 0, UI.board.canvas.baselineWidth ?? UI.board.canvas.width, UI.board.canvas.baselineHeight ?? UI.board.canvas.height));
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

    draw(context) {
        context.clearRect(this.x, this.y, this.width, this.height);
        for (let block of this.blocks) {
            block.draw(context);
        }
    }

    click(event) {
        const click = BoardTemplate.prototype.click;
        BoardTemplate.prototype.click = undefined;

        const input = this.canvas.getElementsByTagName('input')[0];
        const id = Number.parseInt(input.id);
        const name = input.value;

        if (id + '' !== input.id) throw new Error();

        const div = document.body.appendChild(document.createElement('div'));
        div.classList.add('modal');
        document.body.classList.add('underModal');

        const exit = div.appendChild(document.createElement('button'));
        exit.classList.add('xOut');

        div.appendChild(document.createElement('h2')).innerText = name;

        const play = div.appendChild(document.createElement('a'));
        const edit = div.appendChild(document.createElement('a'));

        play.href = HOME_PATH + '/play?id=' + input.id;
        edit.href = HOME_PATH + '/edit?board=' + input.id;

        exit.innerText = 'Nevermind... back to browsing'
        play.innerText = 'PLAY!\nGive it a roll... sounds like fun?';
        edit.innerText = 'EDIT!\nGet creative with your own draft of this board';

        exit.onclick = xOut;
        document.onclick = xOut;
        div.onclick = keepFocus;

        function xOut(event) {
            BoardTemplate.prototype.click = click;
            div.remove();
            document.onclick = null;
            document.body.classList.remove('underModal');
            event.stopPropagation();
            event.preventDefault();
        }

        function keepFocus(event) {
            event.stopPropagation();
        }

    }
}


initializeLogger?.("board.viewer ran");