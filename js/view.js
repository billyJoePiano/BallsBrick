"use strict";


initialize([
    "files",

    "objectTemplates",
    "stats",

    "geometry.lines",
    "geometry.polygons",
    "geometry.angles",
    "geometry.constants",
    "geometry.curves",
    "color",

    //"listener.filter",
    //"context.scaler.customTransform",
    "ui",
    "ui.pointers",
    "board.viewer",

    //"board.template",
    //"board",
    "board.block",
    "block.special",

    //"engine",
    //"engine.caches",
    //"engine.physics",
    //"engine.moveBalls",
    "surface",
    //"ball.bounce",

    //"object.unfreezable",
    //"reflector.objects",
    //"reflector.functions",
    //"reflect",
    "JSONreviver",

    "metrics",
    "debug",

    "run"
]);


function run(constructBoards, makeButtons, event) {
    let boardPromises = constructBoards();

    for (let promise of boardPromises) {
        if (!(promise instanceof Promise)) throw new Error();

        if (!(promise.canvas instanceof HTMLCanvasElement)) throw new Error();
        let canvas = promise.canvas;
        let id = promise.url.split('?', 2)[1];



        promise.then(board => {
            if (!(board instanceof BoardTemplate)) throw new Error();
            UI.for(canvas).installNewTargetObject(board);
        },

        (err) => {

        })
    }
}