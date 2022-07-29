"use strict"; document.currentScript.initTime = performance.now();

class JSONreviver {
    static parse(string) {
        let reviver = new JSONreviver();
        let result = JSON.parse(string, reviver.revive);
        reviver.endTime = performance.now();
        return { reviver: reviver, result: result };
    }

    constructor(verifyConstantsOverride) {
        this.startTime = performance.now();
        this.verifyConstants = verifyConstantsOverride;
        this.objects = new Array();
        this.constants = new Array();
        this.revive = this.revive.bind(this);
    }

    get calcTime() { return this.endTime - this.startTime; }

    revive(key, value) {
        if (typeof value !== "object" || value === null) return value; //primitive

        if (value.__refersTo || (value.__class && value.__constructorArgs)) { //appears to be a JSONobject wrapper with something to construct
            if (this.objects[value.__objectId] || this.constants[value.__constId]) throw new Error("object from this objectIndex or constId was already constructed!");

            let object;
            let constant;

            if ("__constGroup" in value && "__constName" in value) {
                constant = true;
                if (value.__constGroup in CONSTANTS
                        && value.__constName in CONSTANTS[value.__constGroup]) {

                    object = CONSTANTS[value.__constGroup][value.__constName];

                } else throw new Error("constant verification failed!");

                this.constants[value.__constId] = object;
                if (    (this.verifyConstants ?? JSONreviver.verifyConstants)
                    &&  value.__class !== object.__proto__.constructor.name
                    &&  !JSONreviver.verifyConstant(value.__constructorArgs ?? value.__refersTo, object.constructorArgs?.() ?? object)
                    ) {
                    throw new Error("constant verification failed!");
                }

            } else if (value.__constructorArgs instanceof Array) { //wraps a dynamically constructable class
                let classConstructor = JSONreviver.getClassConstructor(value.__class);
                constant = false;
                object = new (classConstructor)(...value.__constructorArgs);

            } else if (typeof value.__refersTo === "object") { //wraps a array, anonymous class, or functionally anonymous class
                constant = false;
                object = value.__refersTo;
                if (typeof value.__class === "string") {
                    let classProto = JSONreviver.getClassConstructor(value.__class)?.prototype;
                    if (classProto) Object.setPrototypeOf(object, classProto);
                    else object[Symbol.for("__class")] = value.__class;
                }

            } else throw new Error("What appears to be an object reflection did not have a property that could be converted into an object");

            if (!constant && value.__objId > -1) this.objects[value.__objId] = object;

            return object;

        } else if (value.__constId > -1) { //wrapping an already-ID'd (and verified if required) constant
            return this.constants[value.__constId];

        } else if (value.__objId > -1) { //wrapping an already-constructed object
            return this.objects[value.__objId];

        } else return value; //is not a JSONobject wrapper
    }

    static verifyConstant(value, constant) { //recursive function for verifying every property or  of a constant object
        if (!(typeof value === 'object' && typeof constant === 'object')) { //has reached the primitive level
            return value === constant;
        }
        for (let property in value) {
            if (!JSONreviver.verifyConstant(value[property], constant[property])) return false;
        }
        for (let property in constant) {
            if (!JSONreviver.verifyConstant(constant[property], value[property])) return false;
        }
        return true;
    }

    static getClassConstructor(className) {
        if (typeof className !== "string") throw new Error("invalid class name");
        if (typeof JSONreviver.classes[className] === "function") return JSONreviver.classes[className];

        //validate the string before calling eval() on it, to prevent any malicious or invalid code

        let constructor = !Number.isNaN(Number(className[0])); //global variables can't start with a number

        if (constructor) {
            //if (className.length > 50) constructor = false; //??? hmm.... would exclude extremely long class names, but also prevent unwanted code from executing

            for (let char of [" ", ".", ",", "?", ":", ";", "{", "}", "[", "]", "(", ")", "=", "+", "*", "-", "/", "%", "!", "&", "|", "~", "^", "<", ">", '"', "'", "`", "\\"]) {
                if (className.includes(char)) {
                    constructor = false;
                    break;
                }
            }
        }

        if (constructor) {
            try {
                constructor = eval(className);
                if (typeof constructor !== "function") constructor = undefined;

            } catch (err) {
                constructor = undefined;
            }

        } else {
            constructor = undefined;
        }

        JSONreviver.classes[className] = constructor;
        return constructor;
    }

}

JSONreviver.verifyConstants = true;

JSONreviver.classes = {};

initializeLogger("JSONreviver ran");