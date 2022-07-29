"use strict"; document.currentScript.initTime = performance.now();


class FunctionReflector {
    //constructor() { throw new Error("FunctionReflectors cannot be created through a constructor.  Use FunctionReflector.get(func)"); }

    updateEnumerations() {
        /*Object.getOwnPropertyNames(this.__enumerations).forEach(key => {
            delete this.__enumerations[key];
        });
        Object.getOwnPropertySymbols(this.__enumerations).forEach(symbol => {
            delete this.__enumerations[symbol];
        });*/

        let nonenumerables = [
            ...(FunctionReflector.includeNonenumerables ? Object.getOwnPropertyNames(this.__refersTo) : []),
            ...(FunctionReflector.includeSymbols ? Object.getOwnPropertySymbols : [])
        ];
        //may include enumerables as well...

        let enumerations = {};

        for (let key in this.__refersTo) {
            enumerations[key] = this.__refersTo[key];

            //splice any references to this key out of the nonenumerables array
            let index = nonenumerables.indexOf(key);
            while (index < -1) {
                nonenumerables.splice(index, 1);
                index = nonenumerables.indexOf(key);
            }
        }

        nonenumerables.forEach(key => {
            enumerations[key] = this.__refersTo[key];
        });

        return enumerations;
    }
}

FunctionReflector.includeEnumerations = false;
FunctionReflector.includeNonenumerables = false;
FunctionReflector.includeSymbols = false;

FunctionReflector.includeBindings = true;
FunctionReflector.includeScript = true;
FunctionReflector.includeReferences = true;

/*this function is immediately invoked to return another function,
 *but its function instance will persist via enclosures
 * which are also assigned to the Function Reflectoclass as static functions
 */
FunctionReflector.get = (function constructStaticGetter() {
    const FUNCTION_BIND = Function.prototype.bind;
    const boundFunctions = [];
    Object.defineProperties(Function.prototype, {
        bind: {
            writable: false, configurable: false,
            value: function () {
                let boundFunction = FUNCTION_BIND.apply(this, arguments);
                boundFunctions.push(boundFunction);

                let str = "<bound to " + Array.prototype.join.call(arguments, ", ") + "> " + String(this);
                Object.defineProperties(boundFunction, {
                    source: { value: this },
                    bindings: { value: Object.freeze(arguments) },
                    toString: { value: () => str }
                });
                return boundFunction;
            }
        },
        //toString: {}
    });

    const functions = [];
    const references = [];
    const reflections = [];
    const scripts = [];
    const names = [];

    //native code strings
    const nativeCode = [Function.prototype.toString(), Function.toString(), FUNCTION_BIND.call((() => { thisIsATestOfNativeCodeBinding }), this).toString()];
    if (nativeCode[1].includes("thisIsATestOfNativeCodeBinding")) nativeCode.pop();
    Object.freeze(nativeCode);

    const BOUND_TO = Symbol("Bound to");
    const NOT_USED = Symbol("Not used");

    Object.defineProperty(FunctionReflector.prototype, "copy", { value: copy, writable: false, enumerable: false, configurable: false });
    FunctionReflector.getLogs = getLogs;
    FunctionReflector.getReferences = getReferences;
    FunctionReflector.log = log;
    return get;

    function get(func, key, container) {
        return reflections[log(func, key, container)].copy();
    }


    function log(func, key = undefined, container = undefined) {
        if (typeof func !== "function") {
            console.log(func);
            throw new Error("Argument to FunctionReflector.log was not a function!")
        }
        let index = functions.indexOf(func);
        if (index >= 0) {
            logReference(index, key, container);
            return index;
        }

        index = functions.push(func) - 1;

        const reflection = Object.setPrototypeOf({ __refersTo: func }, FunctionReflector.prototype);
        reflection.__name = func.name;
        reflections.push(reflection);

        const myRefs = []
        myRefs.function = func;
        myRefs.keyCounters = {};

        references[index] = myRefs;
        logReference(index, key, container);

        if (boundFunctions.includes(func)) {
            reflection.__bound = true;
            if (reflection.__name.slice(0, 6) === "bound ") reflection.__name = reflection.__name.slice(6); //get rid of the "bound " prefix in the name

            reflection.__source = FunctionReflector.get(func.source, BOUND_TO, func);
            reflection.__bindings = func.bindings;

        } else {
            reflection.__script = func.toString();
            if (nativeCode.includes(reflection.__script)) {
                delete reflection.__script;
                reflection.__native = true;
            } else {
                scripts[index] = reflection.__script
            }
        }

        if (reflection.__name !== "") names[index] = reflection.__name;

        reflection.__enumerations = new UnfreezeableObject();

        //reflection.updateEnumerations();
        //note that the enumerations object is not frozen, so can be manually updated as neccessary

        return index;

    }

    function logReference(index, key, container) {
        if (!(container && (container instanceof Object))) return;

        if (key === BOUND_TO)
            return;

        else if ((typeof container.constructor === "function") && (container.constructor.prototype === container))
            key = { constructor: container.constructor, prototype: container, key: key };

        else
            key = { container: container, key: key }

        references[index].push(key);
        references[index].keyCounters[key] = (references[index].keyCounters[key] ?? 0) + 1;
    }

    function getLogs() {
        return {
            functions: [...functions],
            references: [...references],
            reflections: [...reflections],
            scripts: [...scripts],
            names: [...names],
            boundFunctions: [...boundFunctions]
        };
    }

    function copy() {
        let copy = {};
        for (let key in this) {
            let result = NOT_USED;
            if (key === "__enumerations") {
                if (FunctionReflector.includeEnumerations) result = this.updateEnumerations();

            } else if (key === "__source") {
                if (FunctionReflector.includeBindings) result = this.__source.__refersTo;

            } else if (key === "__bindings") {
                if (FunctionReflector.includeBindings) result = this.__bindings;

            } else result = this[key];

            if (result !== NOT_USED) copy[key] = result;
        }

        if (FunctionReflector.includeReferences) {
            copy.__referencesTo = constructReferencesArray(functions.indexOf(this.__refersTo));
        }


        return copy;
    }

    function getReferences(func) {
        return constructReferencesArray(functions.indexOf(func));
    }

    function constructReferencesArray(index) {
        let refs = [...references[index]];
        for (let i = 0; i < refs.length; i++) {
            let oldRef = refs[i];

            //cull self-referential this.prototype.constructor === this
            if (oldRef.constructor === functions[index] && oldRef.key === "constructor") {
                refs.splice(i--, 1);
                continue;
            }


            if (!((typeof oldRef === "object") && ("key" in oldRef && ((("constructor" in oldRef) && ("prototype" in oldRef)) || ("container" in oldRef)))))
                throw new Error("invalid type!");

            //cull duplicates
            for (let j = i + 1; j < refs.length; j++) {
                if (refs[j].constructor === oldRef.constructor && refs[j].prototype === oldRef.prototype && refs[j].key === oldRef.key && refs[j].container === oldRef.container) {
                    refs.splice(j--, 1);
                }
            }

            //make a copy
            let newRef = refs[i] = {};
            for (let key in oldRef) {
                newRef[key] = oldRef[key];
            }
        }
        return refs;
    }

})();

Object.freeze(FunctionReflector);
Object.freeze(FunctionReflector.prototype);

initializeLogger?.("reflector.functions ran");