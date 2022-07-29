"use strict";

const blockTemplates = [[]];

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

    "listener.filter",
    "context.scaler.customTransform",
    "ui",
    "ui.pointers",

    "board.template",
    "board",
    "board.block",
    "block.special",

    "engine",
    "engine.caches",
    "engine.physics",
    "engine.moveBalls",
    "surface",
    "ball.bounce",

    "JSONreviver",

    "metrics",
    "debug",

    "run"
]);

function run(constructBoards, makeButtons, event) {
    let boardPromises = constructBoards();

    if (boardPromises.length !== 1 || !(boardPromises[0] instanceof Promise)) throw new Error();

    let promise = boardPromises[0];
    if (!(promise.canvas instanceof HTMLCanvasElement)) throw new Error();
    const canvas = promise.canvas;

    const input = canvas.getElementsByTagName('input')[0];
    const id = Number.parseInt(input.id);
    const name = input.value;

    if (id + '' !== input.id) throw new Error();

    blockTemplates[0][0] = new SimpleRectangleBlock(50, 0, 0);
    const div = makeButtons(event => window.location.href = HOME_PATH + '/edit?board=' + id);

    promise.then(template => {
        if (!(template instanceof BoardTemplate)) throw new Error();

        board = new Board(template);

        UI.board = UI.for(canvas);
        UI.board.installNewTargetObject(board);
        board.firstRound();
    },
    error => {
        /* do something with the error, display a message to the user */

    });

}

const navMyBoards = function navMyBoards() { window.location.href = HOME_PATH + '/myBoards' }
const navMyDrafts = function navMyDrafts() { window.location.href = HOME_PATH + '/myDrafts' }
const navHomePage = function navHomePage() { window.location.href = HOME_PATH + '/' }
const navBlog = function navBlog() { window.location.href = HOME_PATH + '/blog' }
const navLogout = function navLogout() { window.location.href = HOME_PATH + '/logout' }
const navLogin = function navLogin() { window.location.href = HOME_PATH + '/login' }
const navSignup = function navSignup() { window.location.href = HOME_PATH + '/signup' }