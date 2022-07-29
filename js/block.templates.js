"use strict"; document.currentScript.initTime = performance.now();

let blockTemplates = [[], [], []]
BLOCK_COLOR_SCHEME.standard.forEach((tier) => {
    let size = tier.hits < 100 ? Block.standardSize : tier.hits < 500 ? Block.standardSize * 2 : Block.standardSize * 3;
    blockTemplates[0].push(new SimpleRectangleBlock(Math.max(tier.hits, 2), 0, 0, size, size));
});

ANGLES_45.forEach((angle) => {
    BLOCK_COLOR_SCHEME.standard.forEach((tier) => {
        if (tier.hits > 50) return;
        blockTemplates[0].push(new RightTriangleBlock(Math.max(tier.hits, 2), 0, 0, angle));
    });
});

blockTemplates[0].push(...blockTemplates[0].splice(0, 3));

blockTemplates[0].push(new BombBlock(50, 130, 100, 0, 0));
blockTemplates[0].push(new BombBlock(200, 150, 200, 0, 0, Block.standardSize * 2));
blockTemplates[0].push(new BombBlock(500, 160, 350, 0, 0, Block.standardSize * 3));

/*ANGLE_CONSTANTS.forEach((angle) => {
        blockTemplates[0].push(new RightTriangleBlock(50, 0, 0, angle, [Block.standardSize, Block.standardSize * 2]));
});*/

CARDINAL_DIRECTIONS.forEach((direction) => {
    blockTemplates[1].push(new DirectionalBlock(direction, 0, 0));
    blockTemplates[2].push(new SolidDirectionalBlock(direction, 0, 0));
});

ANGLES_45.forEach((direction) => {
    blockTemplates[1].push(new DirectionalBlock(direction, 0, 0));
    blockTemplates[2].push(new SolidDirectionalBlock(direction, 0, 0));
});

ANGLES_30_60.forEach((direction) => {
    blockTemplates[1].push(new DirectionalBlock(direction, 0, 0));
    blockTemplates[2].push(new SolidDirectionalBlock(direction, 0, 0));
});

ANGLES_15_75.forEach((direction) => {
    blockTemplates[1].push(new DirectionalBlock(direction, 0, 0));
    blockTemplates[2].push(new SolidDirectionalBlock(direction, 0, 0));
});

arrangeDiretionalBlockTemplates(blockTemplates[1]);
arrangeDiretionalBlockTemplates(blockTemplates[2]);


function arrangeDiretionalBlockTemplates(array) {
    let order = [   { top: ANGLE.upLeft45,    baseline: ANGLE.left,  clockwise: false },
                    { top: ANGLE.upRight45,   baseline: ANGLE.right, clockwise: true  },
                    { top: ANGLE.downLeft45,  baseline: ANGLE.down,    clockwise: false },
                    { top: ANGLE.downRight45, baseline: ANGLE.up,  clockwise: true  }
                ];

    let oldArray = [...array];

    for (let c = 0; c < 4; c++) {
        let col = oldArray.filter((block) => {
            return      Math.abs((block.bounceDirection.degrees - order[c].baseline.degrees) % 360) <= 45
                     || Math.abs((block.bounceDirection.degrees - order[c].baseline.degrees) % 360) >= 315;
                     //|| (block.bounceDirection.degrees - order[c].top.degrees) % 360 === 0;
        });
        if (col.length !== oldArray.length / 4 + 1) throw new Error("number of template directional blocks must be a multiple of 4, and evenly distributed across the 360 degrees!");

        col.sort((block1, block2) => {
            if ((block1.bounceDirection.degrees - block2.bounceDirection.degrees) % 360 === 0) throw new Error("cannot have two blocks of the same direction!");
            //else if ((block1.bounceDirection.degrees - order[c].top.degrees) % 360 === 0) return -1
            //else if ((block2.bounceDirection.degrees - order[c].top.degrees) % 360 === 0) return 1
            else {
                let dif = (block1.bounceDirection.degrees - block2.bounceDirection.degrees) % 360
                if (Math.abs(dif) > 90) dif *= -1;
                if (order[c].clockwise) dif *= -1;
                return dif;
            }
        });

        for (let r = 0; r < col.length; r++) {
            array[c + r * 4] = col[r];
        }
    }
}

initializeLogger?.("block.templates ran");