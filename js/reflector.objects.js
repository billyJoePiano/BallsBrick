"use strict"; document.currentScript.initTime = performance.now();


const ESCAPE_CHAR = "^"
const ESCAPE_CHAR_DBL = ESCAPE_CHAR + ESCAPE_CHAR + " ";
const PRIMITIVES = Object.freeze(["string", "number", "boolean", "undefined"]);
//Symbols are technically a primitive but excluded becuase there is special code in the 'iterate' function for dealing with them

const SYSTEM_PROTOS = Object.freeze(
    [Object, Function, String, Number, Boolean, Array, Symbol, Date, Window, Document, Node, Element, HTMLElement]
        .map(constructor => constructor.prototype)
);
//there are many more obviously, just starting with a small amount, will expand this


const UNDEFINED = Symbol.for("undefined"); //use of this symbol as a key guarentees the key will return an undefined value in all objects
const NULL = Symbol.for("null"); //ditto for null

Object.defineProperty(Object.prototype, UNDEFINED, { writable: true, enumberable: false, configurable: false });
Object.defineProperty(Object.prototype, NULL, { writable: true, enumberable: false, configurable: false, value: null });

Object.getEnumerableKeys = function getEnumerableKeys(object) {
    let keys = Object.keys(object);
    for (let key in object) {
        if (!keys.includes(key)) keys.push(key);
    }
    return keys;
}



class ObjectReflector {
    static stringify(   value,
                        valueReplacer = undefined,
                        useConstructorArgs = true,
                        optionalEnumerations = false,
                        includeObjects = true,
                        includeFunctions = false,
                        includeSymbols = false,
                        enumerateAll = false,
                        nonenumerables = false,
                        suppressEnumerations = false,
                        includeClass = false, // when false, __class is only included alongside __constructorArgs
                        prototypeChain = false,
                        constructorArgsReplacer = undefined,
                        constructorKeysReplacer = undefined,
                        enumerationKeysReplacer = undefined,
                        prototypeReplacer = ObjectReflector.protoReplacers.ignoreSystemProtos,
                        suppressToJSON = true,
        ) {

        return JSON.stringify(ObjectReflector.reflect(...arguments));
    }

    static reflect(     value,
                        valueReplacer = undefined,
                        useConstructorArgs = true,
                        optionalEnumerations = false,
                        includeObjects = true,
                        includeFunctions = false,
                        includeSymbols = false,
                        enumerateAll = false,
                        nonenumerables = false,
                        suppressEnumerations = false,
                        includeClass = false, // when false, __class is only included alongside __constructorArgs
                        prototypeChain = false,
                        constructorArgsReplacer = undefined,
                        constructorKeysReplacer = undefined,
                        enumerationKeysReplacer = undefined,
                        prototypeReplacer = ObjectReflector.ignoreSystemProtos,
                        suppressToJSON = true,
        ) {

        let reflector = new ObjectReflector(valueReplacer, useConstructorArgs, optionalEnumerations, includeObjects, includeFunctions, includeSymbols, enumerateAll, nonenumerables, suppressEnumerations, includeClass, prototypeChain, constructorArgsReplacer, constructorKeysReplacer, enumerationKeysReplacer, prototypeReplacer, suppressToJSON);
        console.log(reflector);
        return reflector.reflect(value);
    }

    constructor(valueReplacer = undefined,
                useConstructorArgs = true,
                optionalEnumerations = false,
                includeObjects = true,
                includeFunctions = false,
                includeSymbols = false,
                enumerateAll = false,
                nonenumerables = false,
                suppressEnumerations = false,
                includeClass = false,
                prototypeChain = false,
                constructorArgsReplacer = undefined,
                constructorKeysReplacer = undefined,
                enumerationKeysReplacer = undefined,
                prototypeReplacer = ObjectReflector.ignoreSystemProtos,
                suppressToJSON = false,
        ) {

        let configurations = {};
        ["valueReplacer", "useConstructorArgs", "optionalEnumerations", "includeObjects", "includeFunctions", "includeSymbols", "enumerateAll", "nonenumerables", "suppressEnumerations", "includeClass", "prototypeChain", "constructorArgsReplacer", "constructorKeysReplacer", "enumerationKeysReplacer", "prototypeReplacer", "suppressToJSON", "configurations"]
        .forEach(property => {
            configurations[property] = { configurable: true, enumerable: true }; //getters/setters can only be changed by Object.defineProperty
        });
        Object.defineProperties(this, configurations);
        this.setConfigurations(valueReplacer, useConstructorArgs, optionalEnumerations, includeObjects, includeFunctions, includeSymbols, enumerateAll, nonenumerables, suppressEnumerations, includeClass, prototypeChain, constructorArgsReplacer, constructorKeysReplacer, enumerationKeysReplacer, prototypeReplacer, suppressToJSON);
    }

    get calcTime() { return this.endTime - this.startTime; }

    setConfigurations(      valueReplacer = this.valueReplacer,
                            useConstructorArgs = this.useConstructorArgs,
                            optionalEnumerations = this.optionalEnumerations,
                            includeObjects = this.includeObjects,
                            includeFunctions = this.includeFunctions,
                            includeSymbols = this.includeSymbols,
                            enumerateAll = this.enumerateAll,
                            nonenumerables = this.nonenumerables,
                            suppressEnumerations = this.suppressEnumerations,
                            includeClass = this.includeClass,
                            prototypeChain = this.prototypeChain,
                            constructorArgsReplacer = this.constructorArgsReplacer,
                            constructorKeysReplacer = this.constructorKeysReplacer,
                            enumerationKeysReplacer = this.enumerationKeysReplacer,
                            prototypeReplacer = this.prototypeReplacer,
                            suppressToJSON = this.suppressToJSON,
    ) {
        //need to add code to construct() to include arrays/iterable replacers as well!!
        if (typeof           valueReplacer !== "function" && typeof           valueReplacer?.[Symbol.iterator] !== "function")           valueReplacer = undefined;
        if (typeof constructorArgsReplacer !== "function" && typeof constructorArgsReplacer?.[Symbol.iterator] !== "function") constructorArgsReplacer = undefined;
        if (typeof constructorKeysReplacer !== "function" && typeof constructorKeysReplacer?.[Symbol.iterator] !== "function") constructorKeysReplacer = undefined;
        if (typeof enumerationKeysReplacer !== "function" && typeof enumerationKeysReplacer?.[Symbol.iterator] !== "function") enumerationKeysReplacer = undefined;
        if (typeof       prototypeReplacer !== "function" && typeof       prototypeReplacer?.[Symbol.iterator] !== "function")       prototypeReplacer = undefined;
        const configurations = {

            valueReplacer:              { get: function () { return valueReplacer;              },   set: function (val) { if (            valueReplacer !== (valueReplacer             = val))     reconfigure(); } },
            constructorArgsReplacer:    { get: function () { return constructorArgsReplacer;    },   set: function (val) { if (  constructorArgsReplacer !== (constructorArgsReplacer   = val))     reconfigure(); } },
            constructorKeysReplacer:    { get: function () { return constructorKeysReplacer;    },   set: function (val) { if (  constructorKeysReplacer !== (constructorKeysReplacer   = val))     reconfigure(); } },
            enumerationKeysReplacer:    { get: function () { return enumerationKeysReplacer;    },   set: function (val) { if (  enumerationKeysReplacer !== (enumerationKeysReplacer   = val))     reconfigure(); } },
            prototypeReplacer:          { get: function () { return prototypeReplacer;          },   set: function (val) { if (        prototypeReplacer !== (prototypeReplacer         = val))     reconfigure(); } },

                                                                                                                                                                //coerce val into a boolean
            useConstructorArgs:   { get: function () { return useConstructorArgs;   },   set: function (val) { if (   useConstructorArgs !== (useConstructorArgs   = !!val))  reconfigure(); } },
            optionalEnumerations: { get: function () { return optionalEnumerations; },   set: function (val) { if ( optionalEnumerations !== (optionalEnumerations = !!val))  reconfigure(); } },
            includeObjects:       { get: function () { return includeObjects;       },   set: function (val) { if (       includeObjects !== (includeObjects       = !!val))  reconfigure(); } },
            includeFunctions:     { get: function () { return includeFunctions;     },   set: function (val) { if (     includeFunctions !== (includeFunctions     = !!val))  reconfigure(); } },
            includeSymbols:       { get: function () { return includeSymbols;       },   set: function (val) { if (       includeSymbols !== (includeSymbols       = !!val))  reconfigure(); } },
            enumerateAll:         { get: function () { return enumerateAll;         },   set: function (val) { if (         enumerateAll !== (enumerateAll         = !!val))  reconfigure(); } },
            nonenumerables:       { get: function () { return nonenumerables;       },   set: function (val) { if (       nonenumerables !== (nonenumerables       = !!val))  reconfigure(); } },
            suppressEnumerations: { get: function () { return suppressEnumerations; },   set: function (val) { if ( suppressEnumerations !== (suppressEnumerations = !!val))  reconfigure(); } },
            includeClass:         { get: function () { return includeClass;         },   set: function (val) { if (         includeClass !== (includeClass         = !!val))  reconfigure(); } },
            prototypeChain:       { get: function () { return prototypeChain;       },   set: function (val) { if (       prototypeChain !== (prototypeChain       = !!val))  reconfigure(); } },
            suppressToJSON:       { get: function () { return suppressToJSON;       },   set: function (val) { if (       suppressToJSON !== (suppressToJSON       = !!val))  reconfigure(); } },

            configurations: { get: function () { return configs ? configs : makeConfigs(); }, set: function (val) { iterateConfigs(val); } }
            /* NOTE: the 'configs' object returned by configurations is immutably FROZEN.
             * There is only one constructed per configurations change, AND only after 'configurations' is requested by the lazy getter.
             * This is to prevent adding to the memory heap unneccessarily while construct() is running and requesting/storing the current configs.
             * Use the method configs.copy() to make a mutable copy of the configs object, for changing settings and then submitting to the configurations setter
             * The copy will also have the copy() method installed
             */
        };
        Object.defineProperties(this, configurations);

        //coerce to booleans (or undefined in the case of a replacer that is not a function or array)
        let reconfigure = () => { };
        for (let setting in configurations) {
            if (setting === "configurations") continue;
            this[setting] = this[setting];
        }
        reconfigure = () => this.setConfigurations(valueReplacer, useConstructorArgs, optionalEnumerations, includeObjects, includeFunctions, includeSymbols, enumerateAll, nonenumerables, suppressEnumerations, includeClass, prototypeChain, constructorArgsReplacer, constructorKeysReplacer, enumerationKeysReplacer, suppressToJSON);

        let configs = false;
        let origin = this;
        function makeConfigs() { //lazy getter for configs object
            configs = {};
            for (let setting in configurations) {
                if (setting !== "configurations")
                    configs[setting] = configurations[setting].get()
            }
            Object.defineProperty(configs, "copy", {
                enumerable: false,
                value: function copy() {
                    let copyObj = {};
                    for (let setting in this) {
                        if (setting !== "configurations")
                            copyObj[setting] = this[setting];
                    }
                    return Object.defineProperties(copyObj, {
                        copy: { value: copy, writable: true, enumerable: false, configurable: true },
                        origin: { value: origin, writable: true, enumerable: false, configurable: true }
                    });
                }
            });
            return Object.freeze(configs);
        }

        const iterateConfigs = (configsObj) => { //need arrow function to access 'this'
            const finalize = reconfigure;
            let changed = false;
            reconfigure = () => { changed = true };
            for (let key in configsObj) {
                if (key in this && key !== "configurations")
                    this[key] = configsObj[key];
            }
            if (changed) finalize();
            else reconfigure = finalize;
        }
    }


    static getChainedReplacer(replacer1, replacer2, etc) {
        const replacers = arguments;
        chainedReplacer.replacers = arguments;

        return chainedReplacer;

        function chainedReplacer(key, value, otherArgs) {
            for (let replacer of replacers) {
                if (typeof replacer !== "function") throw new Error("Invalid replacer.  This was not a function: " + replacer);
                arguments[1] = replacer.call(this, ...arguments);
            }
            return arguments[1];
        }
    }


}

ObjectReflector.valueReplacers = {
    functionsToString: function functionsToString(key, value) {
        if (typeof value === "function") return value.toString();
        else return value;
    },
    //add other value replacers as needed ???
}

ObjectReflector.protoReplacers = {
    ignoreSystemProtos: function ignoreSystemProtos(value, proto) {
        const INVALID_CONSTRUCTOR_NAME = Symbol("invalid constructor name");
        let constructorName = proto?.constructor?.name ?? INVALID_CONSTRUCTOR_NAME;
        if (!constructorName || constructorName === "") constructorName = INVALID_CONSTRUCTOR_NAME;
        else constructorName = String(constructorName);

        if (SYSTEM_PROTOS.includes(proto))
            return (constructorName !== INVALID_CONSTRUCTOR_NAME) ? constructorName : undefined;

        else if (SYSTEM_PROTOS.includes(constructorName))  //this implicitly filters out invalid constructor names
            return constructorName;

        else return proto;
    },
    //add other proto replacers as needed?
}

initializeLogger?.("reflector.objects ran");