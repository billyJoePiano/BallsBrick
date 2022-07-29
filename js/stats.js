"use strict"; document.currentScript.initTime = performance.now();

function printStats(name, array) {
    console.log(name + "  avg: " + Math.round(myMean(array) * 1000) / 1000 + "   med: " + Math.round(myMedian([...array]) * 1000) / 1000 + "   std: " + Math.round(myStd(array) * 1000) / 1000 + "   min: " + Math.round(Math.min(...array) * 1000) / 1000 + "   max: " + Math.round(Math.max(...array) * 1000) / 1000);
}

function myMean(array) {
    let result = 0;
    for (let i = 0; i < array.length; i++) {
        result += array[i];
    }
    return result / array.length;
}

function myStd(array, degreesOfFreedom = 1, mn = myMean(array)) {
    let result = 0;
    for (let i = 0; i < array.length; i++) {
        result += (mn - array[i]) ** 2;
    }
    if (array.length > degreesOfFreedom) return Math.sqrt(result / (array.length - degreesOfFreedom));
    else return Number.NaN;
}

function myMedian(array) { //sorts the array
    array.sort((a, b) => { return a - b; });
    if (array.length % 2 == 1) return array[(array.length - 1) / 2];
    else return (array[array.length / 2] + array[array.length / 2 - 1]) / 2;
}

function mySum(array) {
    let result = 0;
    array.forEach((element) => {
        if(!Number.isFinite(element)) throw new Error("cannot sum non-finite values!")
        result += element;
    });
    return result;
}

function myOrderedSum(array) { //sorts the array
    array.sort((a, b) => { return Math.abs(a) - Math.abs(b); });
    let result = 0;
    array.forEach((element) => {
        if (!Number.isFinite(element)) throw new Error("cannot sum non-finite values!")
        result += element;
    });
    return result;
}

function myDist(array) {
    let uniqueValues = new Array();
    let result = new Array();
    let maxOccurances = 0;
    let modeIndex;
    array.forEach((element) => {
        let index = uniqueValues.indexOf(element);
        if (index === -1) {
            uniqueValues.push(element);
            index = uniqueValues.length - 1;
            result.push({ value: element, occurances: 0 });
        }
        if (++result[index].occurances > maxOccurances) {
            modeIndex = index;
            maxOccurances = result[index].occurances;
        }
    });
    result.mode = result[modeIndex];
    return result;
}

function myMid(value1, value2) { //averages two values, but avoids losing a significant digit if they are equal
    if (!(Number.isFinite(value1) && Number.isFinite(value2))) throw new Error();
    if (value1 === value2) return value1;
    else return (value1 + value2) / 2;
}

initializeLogger?.("stats ran");