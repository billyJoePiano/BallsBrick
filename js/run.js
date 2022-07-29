"use strict"; document.currentScript.initTime = performance.now();


const CONSTANTS = {
    ANGLE: ANGLE,
    ANGLE_RANGE_360: ANGLE_RANGE_360,
    ANGLE_RANGE_180: ANGLE_RANGE_180,
    BLOCK_COLOR_SCHEME: BLOCK_COLOR_SCHEME,
}

JSONreviver.classes = (function fillClassNames() {
    let classConstructorFunctions = [
        'Position',
        'Surface',
        'SimpleRectangleBlock',
        'ShapedBlock',
        'RightTriangleBlock',
        'DirectionalBlock',
        'SolidDirectionalBlock',
        'BombBlock',
        'Angle',
        'AngleRange',
        'CompoundAngleRange',
        'BoardTemplate',
    ];
    let classes = {}
    classConstructorFunctions.forEach((cls, index) => {
        try {
            classes[cls] = eval(cls);
        } catch (e) { }
    });
    return classes;
})();




initializeLogger?.("run ran");