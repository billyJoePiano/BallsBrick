"use strict"; document.currentScript.initTime = performance.now();

const RESERVED_KEYS = Object.freeze(["__constGroup", "__constName", "__constId", "__objId", "__refersTo", "__class", "__constructorArgs", "__enumerations", "__proto", "__funcId", "__name", "__bound", "__source", "__bindings", "__script", "__native", "__symbol", "__symId", "__symbols"]);
// note: only keys that will show up in the final result are reserved.  any which are used during construction but deleted at the end are not (e.g. __refersToArgs, objectIndex, firstReference, etc...)
// if one of these keys is encountered "in the wild" (so to speak), the escape character "%" is used at the begining.  If a key begins with %, it is simply added again to the begining

ObjectReflector.prototype.reflect = function reflect(rootObject,
    valueReplacer = this.valueReplacer,
    constructorArgsReplacer = this.constructorArgsReplacer,
    constructorKeysReplacer = this.constructorKeysReplacer,
    enumerationKeysReplacer = this.enumerationKeysReplacer,
    prototypeReplacer = this.prototypeReplacer,
    suppressToJSON = this.suppressToJSON
) {

    if (rootObject === undefined || rootObject === null) return rootObject;

    this.setConfigurations(valueReplacer, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, constructorArgsReplacer, constructorKeysReplacer, enumerationKeysReplacer, prototypeReplacer, suppressToJSON);

    Object.defineProperties(this, {
        reflect: {
            writable: false, configurable: false,
            value: function () {
                throw new Error("Construction was already executed on this instance of ObjectReflector.  Create a new ObjectReflector instance to construct another refelection");
            }
        }
    });

    construct = construct.bind(this);

    const MAXIMUM_CALL_STACK = 1024;
    const THIS = this;

    const ID_KEYS = Object.freeze({ const: "__constId", object: "__objId", function: "__funcId", symbol: "__symId" });

    const ROOT_REFLECTION = Symbol("Root reflection");

    const VALUE_NOT_USED = Symbol("Value not used");
    const CONSTRUCTOR_ARG = Symbol("Constructor Arg");
    const ARG_FROM_FUNCTION = Symbol("Constructor Arg from Function");
    const CLASS_NOT_USED = Symbol("Class not used");
    const CONSTRUCTOR_ARGS_NOT_USED = Symbol("Constructor Args not used");
    const REFERS_TO_NOT_USED = Symbol("__refersTo not used");
    const CONSTRUCT_PROTO = Symbol("Constructing __proto__ (key flag)");
    const FUNCTION_FINALIZER = Symbol("Function finalizer");
    const NOT_USED_SYMBOLS = Object.freeze([VALUE_NOT_USED, CONSTRUCTOR_ARG, ARG_FROM_FUNCTION, CLASS_NOT_USED, CONSTRUCTOR_ARGS_NOT_USED, REFERS_TO_NOT_USED, CONSTRUCT_PROTO, FUNCTION_FINALIZER]);

    const OBTAINING_CONSTRUCTOR_ARGS = Symbol("Obtaining Constructor Args");
    const ITERATING_CONSTRUCTOR_ARGS = Symbol("Iterating over Constructor Args");
    const ENUMERATING_CONSTRUCTION = Symbol("Enumerating Construction");
    const CONSTRUCTING_PROTO = Symbol("Constructing __proto__ (construction flag)")
    const POST_CONSTRUCTION_ENUMERATIONS = Symbol("Post-construction enumerations");
    

    const DEFERED_CONSTRUCTION = Symbol("Defered Construction");


    const errors = {
        keyAccess: [],
        constructorArgFunc: [],
        className: [],
        getProto: [],
        constructProto: []
    }
    const hierarchy = [];

    const values = {
        object: [],
        function: [],
        symbol: { //symbols are their own index, but need an id tracker because they need to be assigned an id in order to serialize
            nextId: { S: 0, G: 0, U: 0 }, // system, global, unknown
            indexOf: sym => values.symbol[sym] ? sym : -1,
        },
        const: [],
    };
    const references = {
        object: [],
        function: [],
        symbol: {},
        const: [],
    };
    const constructed = {
        object: [],
        function: [],
        symbol: {},
    };
    const circularReferences = {
        object: [],
        function: [],
        symbol: {},
    };

    const deferredConstruction = {
        object: [],
        function: [],
        symbol: {}
    }

    //var counter = 0; //for debugging
    //console.log(values);
    //console.log(references);
    //console.log(errors);

    this.objectReflected = rootObject;

    let rootReflection = VALUE_NOT_USED;
    rootReflection = construct(rootObject, "", rootObject, ROOT_REFLECTION);

    handleDeferredConstruction();

    refineReflection();

    this.reflection = rootReflection;
    pushArraysToPublicProperties();

    return rootReflection;


// UN-indenting below functions one tab just for readability
// construct() is actually an enclosure within reflect(), and has many enclosures (and sub-enclosures) of its own
function construct(thisArg, replacerKey, value, reflectionThisArg, reflectionKey = replacerKey, functionLoggerKey = replacerKey, deferredConfigs = false) {

    if (value === rootReflection) throw new Error("Root Reflection should not be included as a value, since it is not part of the public scope yet!");

    let type = typeof value;
    let index = values[type]?.indexOf(value);
    let mustConstruct = index === -1;

    if (!deferredConfigs) {
        //query toJSON and value replacer for substitute values
        if (!this.suppressToJSON && typeof value?.toJSON === "function") value = value.toJSON();

        if (typeof this.valueReplacer === "function" && !NOT_USED_SYMBOLS.includes(replacerKey)) {
            /* NOTE: valueReplacer = function(key, value, valueAlreadyConstructed) is like a traditional JSON replacer but with an extra optional argument -- valueAlreadyConstructed.
            *  valueAlreadyConstructed will always be false in the case of a primitive (number, string, boolean, undefined, null... NOT including symbol however)
            *  NOT_USED symbols indicate this is a constructorArg or prototypeChain, and therefore was already submitted to the constructorArgsReplacer/prototypeReplacer
            */
            if (value !== (value = this.valueReplacer.call(thisArg, replacerKey, value, !mustConstruct))) {
                //if the value changes from the replacer function, then recalc type, index, and mustConstruct
                type = typeof value;
                index = values[type]?.indexOf(value);
                mustConstruct = index === -1;
            }
        }
    }

    if (PRIMITIVES.includes(type) || value === null) return value; //may want to check for primitive constants here?

    hierarchy.push({ [replacerKey !== "__proto__" ? replacerKey : "__proto"]: value });

    let configurations = deferredConfigs ? deferredConfigs : this.configurations;
    //need to capture now, because replacers may change them with sub-constructions

    if (configurations["include" + type[0].toUpperCase() + type.slice(1) + "s"] !== true) {
        if (configurations["include" + type[0].toUpperCase() + type.slice(1) + "s"] !== false) {
            console.log(value);
            console.log(thisArg);
            throw new Error("unexpected type! " + type + " in key " + key);
        }

        hierarchy.pop();
        return undefined;
    }

    let reflection;

    if (deferredConfigs) { //deferred construction.  The reflection was made but not filled
        reflection = references[type][index][0];

    } else if (index !== -1) {
        alreadyConstructed();
        hierarchy.pop();
        return reflection;

    } else { 
        initiateConstructorReflection(arguments[2]);
        //if (counter === 1) console.log(reflection); //for debugging
    }

    if (hierarchy.length >= MAXIMUM_CALL_STACK) {
        constructed[type][index] = DEFERED_CONSTRUCTION;
        reflection.__refersToArgs = DEFERED_CONSTRUCTION;
        reflection.__class = DEFERED_CONSTRUCTION;
        reflection.__constructorArgs = DEFERED_CONSTRUCTION;

        let args = [...arguments];
        args[2] = value; //in case valueReplacer or toJSON() substituted something
        args[6] = configurations;
        deferredConstruction[type][index] = args;
        hierarchy.pop();
        return reflection;

    }

    //establishing preferred order of properties with "not used" symbol flags
    reflection.__refersToArgs = REFERS_TO_NOT_USED;
    reflection.__class = CLASS_NOT_USED;
    reflection.__constructorArgs = CONSTRUCTOR_ARGS_NOT_USED;

    let enumerations, skipEnumerations, enumerationKeys;
    let myCircularReferences = circularReferences[type][index]

    finishConstructorReflection();

    delete deferredConstruction[type][index];
    hierarchy.pop();
    return reflection;  //FINISHED MAKING THE CONSTRUCTOR REFLECTION!


    function alreadyConstructed() {
        reflection = references[type][index][1];

        if (reflection !== undefined) return;

        //need to construct the secondary (smaller) reflection reference object

        reflection = checkForEstablishedConstant() ?? {};

        if (type !== "symbol") {
            reflection.__refersTo = value;
            reflection[type + "Index"] = index; //for debugging, this is the index in the array of objects/functions
            references[type][index].push(reflection);

            if (type === "function" && !NOT_USED_SYMBOLS.includes(functionLoggerKey)) FunctionReflector.log(value, functionLoggerKey, thisArg);
            //for logging the key/container pair in the FunctionReflector logs

        } else if (type === "symbol") {
            reflection.__symId = getSymbolString(value, true);
            // neccesarry to log the reference in the references dictionary. 
            // true' argument indicates the symbol is used as a VALUE, not a key
            reflection.__refersTo = value;
            reflection.symbolIndex = index;

        } else { //unrecognized type, throw error
            console.log(value);
            throw new Error("unexpected typeof: " + typeof value);
        }
    }


    function initiateConstructorReflection(originalValueArg) {

        if (type !== "symbol") {
            reflection = checkForNewConstant(value) ?? { [ID_KEYS[type]]: undefined };
            index = values[type].push(value) - 1;

            if (type === "function" && NOT_USED_SYMBOLS.includes(functionLoggerKey)) FunctionReflector.get(value, functionLoggerKey, thisArg); //logs the key/container reference

        } else {
            //checking for constants is done by the getSymbolString() function,
            //which also adds this symbol to the values.symbol dictionary and assigns firstReference
            getSymbolString(value, true);

            index = values.symbol.indexOf(value); //should return the symbol itself, since symbols are their own index
            if (index !== value) throw new Error("Symbols are supposed to be their own index in the values.symbol dictionary object");
        }

        reflection.__refersTo = value;
        if (rootReflection === VALUE_NOT_USED) {
            if (reflectionThisArg === ROOT_REFLECTION && thisArg === rootObject && originalValueArg === rootObject && replacerKey === "")
                rootReflection = reflection;

            else throw new Error();
        }



        //'FIRST REFERENCE' INFORMATIONAL OBJECT
        if (type !== "symbol") {
            //these operations are done by getSymbolString() for new symbols
            //not included in above 'if' enclosure to maintain a certain order of properties

            reflection.firstReference = { container: reflectionThisArg, key: reflectionKey }
            //deleted at the end, by finalizeConstructor.  Needed to de-reference unindexed anonymous arrays/objects/etc

            references[type][index] = [reflection];
            references[type][index].firstReference = reflection.firstReference; // needed for fixing symbol key name changes during refinement
            if (type === "function") {
                reflection.firstReference.actualValue = value;

            }
        }

        if (reflection.isConst)
            references.const[reflection.constIndex].firstReference = reflection.firstReference;

        circularReferences[type][index] = [];
        reflection[type + "Index"] = index; //needed for circular reference tracking, deleted at the end
    }

    function finishConstructorReflection() {
        enumerations = {};
        skipEnumerations = [];
        enumerationKeys = [
            ... (value.mustEnumerate?.() ?? []),
            ... (configurations.optionalEnumerations ? (value.enumerate?.() ?? []) : []),
            ... (configurations.enumerateAll ? Object.getEnumerableKeys(value) : []),
            ... (configurations.nonenumerables ? Object.getOwnPropertyNames(value) : []),
            ... (configurations.includeSymbols ? Object.getOwnPropertySymbols(value) : [])
        ];


        determineConstructionMethod();

        if (!configurations.suppressEnumerations) {
            constructed[type][index] = POST_CONSTRUCTION_ENUMERATIONS;
            performEnumerations(configurations.enumerationKeysReplacer);
        }

        if (configurations.prototypeChain) {
            constructed[type][index] = CONSTRUCTING_PROTO;
            walkUpProtoChain();
        }

        constructed[type][index] = true;
        delete deferredConstruction[type][index];
    }

/* 
* 
* 
* end of main code block for construct()
* 
* below are enclosures invoked (directly or indirectly) from above
* 
* 
*/

    function accessKeyValue(key, invoker = val => val) {
       /* This is to trap errors, in case of Illegal Invocation of properties in root-level prototypes / functions / constructors
        * 
        * This function will be used indirectly to invoke construct() in virtually all cases EXCEPT for: 
        *  1) the initial call to construct(rootObject)
        *  2) symbol keys, which directly invoke construct() themselves, since there is no need to access a key-value pair
        *  3) walking up the prototype chain, where Object.getPrototypeOf() is used, and any accessing errors are trapped there prior to invoking construct()
        *  
        *  Note that keys for constructorArgs are submitted to this function, and collected together in an array,
        *  before being submitted to the constructorArgs replacer, THEN finally to construct()
        *  In that circumstance, the default invoker is used, which immediately returns the value back into the constructorArgs array.
        *  
        *  In most cases, a custom invoker is used which invokes construct() from here, with additional arguments provided by the calling function
        */

        let newValue = VALUE_NOT_USED;
        try {
            newValue = value[key];

        } catch (err) {
            err.key = key;
            err.container = value;
            err.containerIndex = index;
            err.value = value;
            err.index = index;
            err.keys = { invokedKey: key, replacerKey: replacerKey, reflectionKey: reflectionKey, functionLoggerKey: functionLoggerKey };
            err.thisArgs = { thisArg: thisArg, reflectionThisArg: reflectionThisArg };
            err.hierarchy = [...hierarchy];
            errors.keyAccess.push(err);
        }

        if (newValue === VALUE_NOT_USED) return undefined;
        else return invoker(newValue);
    }

    function checkForEstablishedConstant() {
        let index = values.const.indexOf(value);
        if (index >= 0) {
            let rflObj = references.const[index][1];
            if (rflObj === undefined) {
                rflObj = {
                    __constId: undefined,
                    constIndex: index,
                }
                references.const[index].push(rflObj);
            }
            return rflObj;
        }
    }

    function checkForNewConstant(val) {
        //if this method is being invoked, the object should not exist in any of the other value arrays/dictionaries
        if (values.const.indexOf(val) >= 0) throw new Error("New constant reference error!");

        for (let group in CONSTANTS) {
            for (let name in CONSTANTS[group]) {
                if (CONSTANTS[group][name] === val) {
                    values.const.push(val)
                    let index = references.const.push(val) - 1;
                    let rflObj = {
                        __constGroup: group,
                        __constName: name,
                        __constId: undefined, //the id given at the end, after indexed vs unindexed has been determined
                        constIndex: index, //used for internal function indexing only -- deleted at the end
                        isConst: true, // used for internal purposes, deleted at the end
                        type: type //also for internal use, deleted at the end
                    };
                    references.const[index] = [rflObj];
                    return rflObj;

            // IMPORTANT: this does not create 'firstReference' informational object
            // That task is upto above 'construct()' code above
                }
            }
        }
    }

    function determineConstructionMethod() {
        if (configurations.useConstructorArgs) {
            constructed[type][index] = OBTAINING_CONSTRUCTOR_ARGS;
            let constructorKeys = value.constructorArgs?.();
            if (constructorKeys) iterateConstructorArgs(constructorKeys);
            else enumerateConstruction();

        } else {
            enumerateConstruction(configurations.constructorKeysReplacer);
        }

        return;

        function iterateConstructorArgs(constructorKeys) {
            let constructorArgs = [];
            constructorKeys = [...constructorKeys];

            for (let constructorKey of constructorKeys) {
                if (typeof constructorKey === "function") {
                    let funcReturn
                    try {
                        funcReturn = constructorKey();
                    } catch (err) {
                        err.reason = "Obtaining constructor arg value with function call";
                        err.function = constructorKey;
                        err.value = value;
                        err.index = index;
                        err.keys = { replacerKey: replacerKey, reflectionKey: reflectionKey, functionLoggerKey: functionLoggerKey };
                        err.thisArgs = { thisArg: thisArg, reflectionThisArg: reflectionThisArg };
                        err.hierarchy = [...hierarchy];
                        errors.constructorArgFunc.push(err);
                    }

                    constructorArgs.push(funcReturn);

                } else {
                    constructorArgs.push(accessKeyValue(constructorKey));
                    skipEnumerations.push(constructorKey);
                }
            }

            if (configurations.constructorArgsReplacer instanceof Function)
                constructorArgs = [...configurations.constructorArgsReplacer.call(thisArg, value, constructorArgs)];

            if (!constructorArgs) {
                skipEnumerations = [];
                enumerateConstruction();
                return;
            }

            constructed[type][index] = ITERATING_CONSTRUCTOR_ARGS;
            skipEnumerations.push(...(value.skipEnumerationIfConstructed?.() ?? []));

            getClass();
            reflection.__constructorArgs = constructorArgs = [...constructorArgs];

            for (let i = 0; i < constructorArgs.length; i++) {
                constructorArgs[i] = construct(value, CONSTRUCTOR_ARG, constructorArgs[i], constructorArgs, i, (typeof constructorKeys[i] !== "function") ? constructorKeys[i] : ARG_FROM_FUNCTION);

                let t = typeof constructorArgs[i]?.__refersTo;

                if ((!configurations.includeFunctions && t === "function") || (!configurations.includeSymbols && t === "symbol")) {
                    console.log(value);
                    console.log(constructorArgs[i]);
                    throw new Error("Invalid type returned for constructor arg: " + t + ".  Enable the option to include this type or return an accepted type into the constructorArgs");
                    // ??? may want to just default to enumerated construction in this case ???
                }

                let otherIndex = values[t]?.indexOf(constructorArgs[i]);
                if (otherIndex !== -1 && otherIndex !== undefined) {
                    circularReferences[t][otherIndex].push(index);
                    //letting the other object/function/symbol know about a circular reference.  It is necessarily up-thread from this one
                }
            }

            if (myCircularReferences.length > 0) {
                console.log("WARNING: CIRCULAR REFERENCE WITHIN CONSTRUCTOR ARGS:  INDEX " + index + " OF TYPE " + type);
            }
        }

        function enumerateConstruction() {
            //anonymous construction through enumeration
            constructed[type][index] = ENUMERATING_CONSTRUCTION;
            if (configurations.includeClass) getClass();

            let constructorKeys = filterKeys([...Object.getEnumerableKeys(value), ...enumerationKeys]);

            if (configurations.constructorKeysReplacer instanceof Function)
                constructorKeys = filterKeys([...configurations.constructorKeysReplacer.call(thisArg, value, constructorKeys)], false);

            constructorKeys = determineFinalKeys(constructorKeys);

            let refersToArgs = value instanceof Array ? [] : {};

            for (let k of constructorKeys) {
                if (value instanceof Array && isNotWholeNumber(k)) {
                    enumerationKeys.push(k.actual);
                    continue;
                }
                refersToArgs[k.reflection] = accessKeyValue(k.actual, val => construct(value, k.actual, val, refersToArgs, k.reflection));

                if (myCircularReferences.length > 0 && !configurations.suppressEnumerations) {
                    enumerations[k.reflection] = refersToArgs[k.reflection];
                    delete refersToArgs[k.reflection];
                    myCircularReferences.length = 0;
                }
                skipEnumerations.push(k.actual);
            }
            reflection.__refersToArgs = refersToArgs;
        }

        function isNotWholeNumber(key) { //for arrays
            let num = Number(key);
            return num >= 0 && num % 1 === 0 && num.toString() === key?.toString?.();
        }
    }

    function getClass() {
        try {
            let className = value[Symbol.toStringTag]; //for DOM objects

            if (className === undefined || className.substring(0, 8) === "[object ") {
                className = Object.getPrototypeOf(value)?.constructor.name ?? value.constructor.name;

            }

            if (typeof className === "string") reflection.__class = className;
            else {
                let err = new Error("Invalid or unexpected class name");
                err.className = className;
                throw err;
            }

        } catch (err) {
            err.reason = "getClass()"
            err.code = "Object.getPrototypeOf(value)?.constructor.name ?? value.constructor.name";
            err.value = value;
            err.index = index;
            err.keys = { replacerKey: replacerKey, reflectionKey: reflectionKey, functionLoggerKey: functionLoggerKey };
            err.thisArgs = { thisArg: thisArg, reflectionThisArg: reflectionThisArg };
            err.hierarchy = [...hierarchy];
            errors.className.push(err);
        }
    }

    function filterKeys(keys, preReplacer = true) { //remove duplicates
        return keys.filter((ek, index) => {
            if (preReplacer) {
                if (((value instanceof Array) && (ek == "length")) || skipEnumerations.includes(ek)) return false;
                //weak ek == "length" comparison on purpose... want to coerce ek into a a string as a [calculatedPropertyAccessor] would
            }
            return index === keys.indexOf(ek);
        });
    }

    function determineFinalKeys(keys) { //
        let finalKeys = []
        for (let key of keys) {
            let reflectionKey
            if (typeof key === "symbol") {
                if (configurations.includeSymbols) reflectionKey = getSymbolString(key);
                else continue;

            } else reflectionKey = getStringKey(key);

            finalKeys.push({ actual: key, reflection: reflectionKey });
        }
        return finalKeys;
    }

    function getStringKey(key) {
        key = String(key);

        //test against reserved keys, add escape char if neccessary
        if (RESERVED_KEYS.includes(key) || key.slice(0, 7) === "__symId" || key[0] === ESCAPE_CHAR) key = ESCAPE_CHAR + key;
        return key;
    }

    function getSymbolString(symbol, isValue = false) {
        // returns string to use as a key in a reflection jsonObject
        // if it is a value, it is neccessarily the value for this instance of construct(), and is called from the top of the function
        // isValue = false  ----means--->  isKey = true

        let id = values.symbol[symbol]?.id;
        if (id !== undefined) {
            //already defined symbol
            if (isValue && mustConstruct !== false) throw new Error();
            if (isValue) {
                references.symbol[symbol].push(reflection);
                return id;

            } else {
                references.symbol[symbol].keyReferences.push(reflection);
                return "__symId" + id;
            }

        } else if (!isValue) return symbolKeyConstructor();
        else if (mustConstruct !== true) throw new Error("This symbol's reflection has not been constructed yet.  Erroneous call to getSymbolString() where value was true and mustConstruct was false.");

        //system symbols
        for (let systemKey of Object.getOwnPropertyNames(Symbol)) {
            if (Symbol[systemKey] === symbol) return symbolValueConstructor('S', systemKey);
        }

        //global symbols
        let globalKey = Symbol.keyFor(symbol);
        if (globalKey !== undefined) return symbolValueConstructor('G', globalKey);

        //unknown origin.  if we have reached this point, it is assumed this is the unknown category and the logging is created here
        return symbolValueConstructor('U', symbol.description);


        function symbolValueConstructor(category, description) {
            //determine if it is a constant
            id = category + (values.symbol.nextId[category]++);

            let isConst = checkForNewConstant(symbol);
            if (isConst) {
                reflection = isConst;
                isConst = true;
                id = "C_" + id;   //const id is left blank with '_' placeholder because it will probably change during refinement

                reflection.__symId = id;
                reflection.__symDesc = description;
                description = reflection.__constGroup.split(ESCAPE_CHAR).join(ESCAPE_CHAR_DBL) + ESCAPE_CHAR + reflection.__constName.split(ESCAPE_CHAR).join(ESCAPE_CHAR_DBL) + ESCAPE_CHAR + description;
                //detailed description string will be used in event of no construction, for the first key occurance

            } else {
                isConst = false;
                reflection = {
                    __symId: id,
                    __symDesc: description
                }
            }

            values.symbol[symbol] = {
                isConst: !!isConst,
                category: category,
                id: id,
                description: ESCAPE_CHAR + description, //detailed description string will be used in event of no construction, for the first key occurance
                construced: true,
            };

            if (isConst) values.symbol[symbol].constIndex = reflection.constIndex;

            references.symbol[symbol] = [reflection]
            references.symbol[symbol].keyReferences = [];
            references.symbol[symbol].firstReference = { isKey: false, container: reflectionThisArg, key: reflectionKey, isConstructed: true };
            reflection.firstReference = references.symbol[symbol].firstReference;

            return id;
        }

        function symbolKeyConstructor() {
            let symbolReflection = construct(value, "__symbols", symbol, reflection);
            // ...will recursively call getSymbolString(), where value = true, so above function is invoked instead

            references.symbol[symbol].firstReference.isKey = true; //fix the value created above
            references.symbol[symbol].firstReference.key === symbol;
            id = values.symbol[symbol].id;

            let includeConstruction = reflection.__refersToArgs ?? reflection.__constructorArgs ?? reflection.__enumerations ?? reflection.__proto ?? (("__class" in reflection) && (reflection.__class !== "Symbol"))
            // We are not considering __class relevant because that information is already encoded in the fact that it is a symbol.
            // Experiments show that although it is possible to extend Symbol into a subclass, it will throw errors when attempting to construct any members.  This is strangely in contrast to attempts to extend other primitive wrappers such as Number which do not throw such errors when constructing an instance of the subclass.  Although those instances show "object" as typeof, they can be used in mathematical operations as if they were a primitive number
            // HOWEVER, it is possible to re-assign the prototype of an already existing object to the 'Symbol2.0' subclass prototype, but this will still return "object" to typeof, and then throw errors when attempting to use as a Symbol key
            // Symbols themselves cannot have their prototype re-assigned, apparently

            if (includeConstruction) {
                if (reflection.__symbols) reflection.__symbols.push(symbolReflection)
                else reflection.__symbols = [symbolReflection];

                references.symbol[symbol].keyReferences.push(reflection);

            } else { //maintain as a reference in a key string only.  Add the description to the first occurance of this string at refinement
                if (references.symbol[symbol].pop() !== symbolReflection || references.symbol[symbol].length !== 0)
                    throw new Error("Unexpected references to Symbol that should not need construction");

                values.symbol[value].isConstructed = false;
                references.symbol[value].firstReference.isConstructed = false;
            }

            return "__symId" + id;
        }
    }

    function performEnumerations(enumerationKeysReplacer) { //post-construction enumerations

        enumerationKeys = filterKeys(enumerationKeys, true);

        if (enumerationKeysReplacer instanceof Function)
            enumerationKeys = filterKeys([...enumerationKeysReplacer.call(thisArg, value, enumerationKeys)], false);
           /* If the submitted keyReplacer wants to provide a "length" key to an array,
            * or repeat properties included in the constructorArgs/refersToArgs
            * or properties moved to enumerations to prevent a circular reference during construction etc...
            * ...it can do it here.
            * 
            * The filterKeys function:
            * Pre-replacer eliminates duplicates AND anything in the skipEnumerations array AND the 'length' key for arrays
            * Post-replacer elminates duplicates ONLY
            * 
            */

        enumerationKeys = determineFinalKeys(enumerationKeys); //determines actual keys vs reflection keys

        for (let ek of enumerationKeys) {
            let val = accessKeyValue(ek.actual, val => construct(value, ek.actual, val, enumerations, ek.reflection));
            if (val !== undefined) {
                enumerations[ek.reflection] = val;

            } else delete enumerations[ek]; //maybe ??? in case it was installed by the refersToArgs to prevent a circular reference during construction ???
        }

        if (Object.getEnumerableKeys(enumerations).length > 0) reflection.__enumerations = enumerations;
    }

    function walkUpProtoChain() {
        let proto = VALUE_NOT_USED;
        try {
            proto = Object.getPrototypeOf(value);

        } catch (err) {
            err.reason = "walkUpProtoChain()";
            err.code = "Object.getPrototypeOf(value)";
            err.value = value;
            err.index = index;
            err.keys = { replacerKey: replacerKey, reflectionKey: reflectionKey, functionLoggerKey: functionLoggerKey };
            err.thisArgs = { thisArg: thisArg, reflectionThisArg: reflectionThisArg };
            err.hierarchy = [...hierarchy];
            errors.getProto.push(err);
        }

        if (proto === VALUE_NOT_USED) return;
        if (typeof configurations.prototypeReplacer === "function")
            proto = configurations.prototypeReplacer.call(thisArg, value, proto)

        try { //this is prone to unexpected errors... trapping here just in case
            proto = construct(value, CONSTRUCT_PROTO, proto, reflection, "__proto", "__proto__");

        } catch (err) {
            err.reason = "construct(__proto__)";
            err.proto = proto;
            err.value = value;
            err.index = index;
            err.keys = { replacerKey: replacerKey, reflectionKey: reflectionKey, functionLoggerKey: functionLoggerKey };
            err.thisArgs = { thisArg: thisArg, reflectionThisArg: reflectionThisArg };
            err.hierarchy = [...hierarchy];
            errors.constructProto.push(err);
        }

        if (proto !== undefined) reflection.__proto = proto;
    }
}

/*
* 
* 
* 
* IMPORTANT
* This is the end of the construct() function lexical scope,
* which constructs the crude reflection objects.
* 
* 
* Here we are in this.reflect() scope
* And now enclosing the defferred/refining/finalizing functions below
* 
* 
* 
* 
*/

function handleDeferredConstruction() {
    let runLoop = 2;
    let startingIndex_functionConstructors = 0;
    do {
        let doneConstructingAll = true;

        for (let type of ["object", "function", "symbol"]) {
            let isSymbol = type === "symbol";
            let valArray = isSymbol ? Object.getOwnPropertySymbols(values.symbol) : values[type];

            for (let i = 0; i < values[type].length; i++) {
                let index = isSymbol ? valArray[i] : i;

                if (deferredConstruction[type][index]) {
                    doneConstructingAll = false;
                    let args = deferredConstruction[type][index];

                    if (args[2] !== values[type][index] || args[3] !== references[type][index].firstReference.container || args[4] !== references[type][index].firstReference.key)
                        throw new Error("references do not match!");

                    //delete deferredConstruction[type][index]; //done at the conclusion of constructing reflection

                    construct(...args);
                }
            }
        }

        startingIndex_functionConstructors = finishFunctionConstructors(startingIndex_functionConstructors);

        if (doneConstructingAll) runLoop--;
        else runLoop = 2;
        //need to check deferredConstruction again after finalizing Functions, because it may have added more deferred construction

    } while (runLoop > 0)


    function finishFunctionConstructors(i) {
        //index (i) is neccessary because we should not re-make the reflection constructors, only flesh out new references using re-iterate()

        let originalLength = values.function.length;
        for (i; i < values.function.length; i++) {
            let myReflection = references.function[i][0];
            if (myReflection.__refersToArgs === DEFERED_CONSTRUCTION) break;

            let otherReflection = FunctionReflector.get(values.function[i]);
            if (otherReflection.__refersTo !== values.function[i]) throw new Error();
            for (let key in otherReflection) {
                myReflection[key] = otherReflection[key];
            }

            if ("__referencesTo" in myReflection) {
                for (let i = 0; i < myReflection.__referencesTo.length; i++) {
                    myReflection.__referencesTo[i] = construct(myReflection.__refersTo, "__referencesTo: " + i, myReflection.__referencesTo[i], myReflection.__referencesTo, i, FUNCTION_FINALIZER);
                }
            }

            for (let key of ["source", "bindings"]) {
                let __key = "__" + key;
                if (__key in myReflection) {
                    let value = VALUE_NOT_USED;

                    if ("__enumerations" in myReflection && key in myReflection.__enumerations)
                        value = myReflection.__enumerations[key].__refersTo;

                    else if ("__refersToArgs" in myReflection && key in myReflection.__refersToArgs)
                        value = myReflection.__refersToArgs[key].__refersTo;

                    else if ("__constructorArgs" in myReflection) {
                        for (let cArgReflection of myReflection.__constructorArgs) { //iterate through constructor Arg reflection to see if the __refersTo is this value
                            if (cArgReflection.__refersTo === myReflection[__key]) {
                                value = cArgReflection.__refersTo;
                                break;
                            }
                        }
                    }

                    if (value === VALUE_NOT_USED) //NOT already included in construction.  Must run through the value replacer
                        myReflection[__key] = construct(myReflection.__refersTo, key, myReflection[__key], myReflection, __key, key);

                    else if (value === myReflection[__key]) { //already included somewhere in the construction, don't run through the value replacer again
                        myReflection[__key] = construct(myReflection.__refersTo, FUNCTION_FINALIZER, value, myReflection, __key, key);

                    } else throw new Error("sources do not match up!")
                }
            }
        }

        if (i > originalLength) reiterate();

        return i;

        // continue iterating until references are fleshed out fully
        // this is neccessary because iterating over '__referencesTo' arrays may turn up new objects,
        // functions, and new references to the original functions
        function reiterate() {
            console.log("RE-ITERATING OVER FUNCTIONS FINALIZER -- originalLength: " + originalLength + "  new length: " + values.function.length);
            originalLength = values.function.length;
            let i;
            for (i = 0; i < values.function.length; i++) {
                if (!FunctionReflector.includeReferences) break;
                if (references.function[i][0].__refersToArgs === DEFERED_CONSTRUCTION) break;

                let newRefs = FunctionReflector.getReferences(values.function[i]);
                let oldRefs;
                if ("__referencesTo" in references.function[i][0]) oldRefs = references.function[i][0].__referencesTo;
                else continue;
                for (let newRef of newRefs) {
                    if (!oldRefs.includes(newRef))
                        oldRefs.push(construct(references.function[i].__refersTo, "__referencesTo: " + oldRefs.length, newRef, oldRefs, oldRefs.length, FUNCTION_FINALIZER));
                }

            }
            if (i > originalLength) finishFunctionConstructors(originalLength);
        }
    }
}


var indexed;
var unindexed;
/*   ^^^ declared in this scope so they are accessible to pushArraysToPublicProperties()
    *       However, they are only actually used/modified by refineReflection()
    */

function refineReflection() {
    const CONST_PLACEHOLDER = Symbol("Constants placeholder");
    //a placeholder for objects in their own type arrays/dictionaries to identify them as a constant

    indexed = {
        const: [],
        object: [],
        function: [],
        symbol: []
    }
    unindexed = {
        const: [],
        object: [],
        function: [],
        symbol: []
    }
    let changedKeys = {
        container: [],
        oldKey: [],
        newKey: []
    };

    let value;
    let type;
    let category;
    let index;
    let isConst;
    let isSymbol;
    let isIndexed;
    let constructor;
    let firstRef;
    let refs;


    let iterator = makeIterable()[Symbol.iterator]();

    //for (value of makeIterators()) { //Symbol.iterator doesn't work even in desktop Chrome, not sure why :-(  

    while (iterator().done === false) { //use this instead

        if (value === CONST_PLACEHOLDER) {
            delete constructor.isConst;
            delete constructor.type;
            continue;
        }
        //means this object has already been refined/groomed, and belongs in the const category, not its type category

        //count the number of references
        let r;
        for (r = 0; r < refs.length; r++) {
            if (refs[r].__refersTo !== value) throw new Error();
            delete refs[r].__refersTo;
            delete refs[r][type + "Index"];
        }

        if (isSymbol) {
            if (r === 1 && refs.keyReferences.length === 1) {
                // COULD mean there is actually only one reference, with a second "value" reference for
                // construction in the __symbols array of the object (reflection object) where the symbol is a key

                if (refs.firstReference.container !== refs.keyReferences[0]) {
                    if (refs.firstReference.isKey !== false) throw new Error();
                    //means there were actually two references, where the value reference (& construction) came first, followed by a later use as a key
                    r = 2;
                }

            } else r += refs.keyReferences.length //add key references

           /* CONST_PLACEHOLDER replacement for consts is not included in the symbols sections...
            * symbols are their own index key, so there is an important informational object in place of the symbol itself
            * ...that information object includes an 'isConst' boolean property
            * for everything else, we overwrite the value since it is just the original object, which is now being added to the indexed/unindexed const array instead
            * The iterator for symbols knows to returns CONST_PLACEHOLDER if the symbol is also a constant, to simulate this replacement
            */

            let id;
            if (r > 1) { //indexed
                isIndexed = true;
                id = indexed[category].push({ value: value, references: refs }) - 1;
                if (isConst) id = "C" + id + values.symbol[value].id.slice(2); //replace the 'C_' dummy prefix
                else id = values.symbol[value].id;


                refs.forEach(reference => {
                    reference.__symId = id;
                    delete reference.symbolIndex;
                    if (isConst) {
                        delete reference.constIndex;
                    }
                });

            } else if (r === 1) { //unindexed
                isIndexed = false;
                unindexed[category].push({ value: value, references: refs }) - 1;

                id = values.symbol[value].id;
                if (isConst) id = "C" + id.slice(2); //replace the 'C_' dummy prefix

                //__symId is never deleted, even if unindexed, because it contains crucial identifying information (System, Global, Unknown... sometimes the description as well)
                constructor.__symId = id;
                delete constructor.symbolIndex;
                if (isConst) {
                    delete constructor.constIndex;
                    delete constructor.__constId;
                }

            } else throw new Error("Must have at least one reference");

            if (id !== values.symbol[value].id) {
                //the keys need to be changed!
                let first = true;
                let oldKey = "__symId" + values.symbol[value].id
                let newKey = "__symId" + id;
                for (let keyRef of refs.keyReferences) {
                    if (first) {
                        if (!firstRef.isConstructed) newKey = newKey + values.symbol[value].description;
                        //put the detailed description string into the first key
                    }
                    if (!(oldKey in keyRef) || (newKey in keyRef)) throw new Error("Invalid reference");

                    keyRef[newKey] = keyRef[oldKey];
                    delete keyRef[oldKey];

                    changedKeys.container.push(keyRef);
                    changedKeys.oldKey.push(oldKey);
                    changedKeys.newKey.push(newKey);

                    if (first) {
                        first = false;
                        newKey = "__symId" + id;
                    }
                }

            } else if (!firstRef.isConstructed) {
                //the id is still the same, but we need to put the detailed description string in the first key reference
                if (!firstRef.isKey || firstRef.container !== refs.keyReferences[0]) throw new Error("Invalid reference");

                let oldKey = "__symId" + values.symbol[value].id
                let newKey = "__symId" + id + values.symbol[value].description;

                firstRef.container[newKey] = firstRef.container[oldKey];
                delete firstRef.container[oldKey];

                changedKeys.container.push(keyRef);
                changedKeys.oldKey.push(oldKey);
                changedKeys.newKey.push(newKey);
            }

        } else { //NOT A SYMBOL

            if (isConst) {
                //not done for symbols, see explanation above
                let otherIndex = values[type].indexOf(value);
                values[type][otherIndex] = CONST_PLACEHOLDER;
            }

            if (r > 1) { //indexed
                isIndexed = true;
                let id = indexed[category].push({ value: value, references: refs }) - 1;

                refs.forEach(reference => {
                    reference[ID_KEYS[category]] = id;
                    delete constructor[type + "Index"];
                    if (isConst) delete reference.constIndex;
                });

            } else if (r === 1) { //unindexed
                isIndexed = false;
                unindexed[category].push({ value: value, references: refs }) - 1;
                delete constructor[ID_KEYS[type]];

                delete constructor[type + "Index"];
                if (isConst) {
                    delete constructor.constIndex;
                    delete constructor.__constId;
                }
            } else throw new Error("Must have at least one reference");
        }

        finalizeConstructor();
    }

    return;


    function finalizeConstructor() {
        //aka first reflection object to reference the original object, which becomes the constructor reflection
        constructor.__refersTo = constructor.__refersToArgs;
        delete constructor.__refersToArgs;

        if (constructor.__refersTo === REFERS_TO_NOT_USED) {
            if (constructor.__constructorArgs === CONSTRUCTOR_ARGS_NOT_USED) {
                if (!(("__enumerations" in constructor) || ("__proto" in constructor))) throw new Error("there is no way to cosntruct this object");
                delete constructor.__constructorArgs
            }
            if (constructor.__class === CLASS_NOT_USED) delete constructor.__class;

            delete constructor.__refersTo;

        } else if (verifyAnonymous()) { //means this has a "__refersTo" enumerated construction
            if (!((typeof constructor.__refersTo === "object") || (typeof constructor.__enumerations === "object") || isSymbol))
                throw new Error("there is no way to construct this object!");

            delete constructor.__constructorArgs;

            if (!(isIndexed || ("__enumerations" in constructor) || isSymbol)) {
               /* for functionally anonymous objects/arrays that are only referenced once
                * we "dereference" them, get rid of the reflection object with __refersTo, and just assign that directly to the property in the containing object
                */
                let firstReferenceContainer = constructor.firstReference.container;
                let key = constructor.firstReference.key;
                let i = changedKeys.container.indexOf(firstReferenceContainer);

                if (i >= 0 && key === changedKeys.oldKey[i]) {
                    constructor.firstReference.oldKey = key;
                    key = changedKeys.newKey[i]
                    constructor.firstReference.key = key;
                }

                if (!(typeof constructor.__refersTo === "object")) {
                    throw new Error();

                } else if (firstReferenceContainer !== ROOT_REFLECTION) {
                    firstReferenceContainer[key] = constructor.__refersTo;
                } else {
                    rootReflection = constructor.__refersTo;
                }
            }

        } else if (constructor.__constructorArgs === CONSTRUCTOR_ARGS_NOT_USED) { //uses __class AND __refersTo, but not __constructorArgs
            delete constructor.__constructorArgs;

        } else throw new Error("cannot have both enumerated construction and constructorArgs construction at the same time!");
        //or there was an error in the NOT_USED symbols implementation

        delete constructor.firstReference;

        if (isConst) {
            //delete constructor.constIndex
        }

        function verifyAnonymous() {
            if (constructor.__constructorArgs === CONSTRUCTOR_ARGS_NOT_USED) {
                if (constructor.__class === CLASS_NOT_USED) {
                    delete constructor.__class;
                    return true;

                } else if (constructor.__class === "Object") {
                    /*let proto = Object.getPrototypeOf(value);
                    if (proto !== Object.prototype && !(proto === null && value === Object.prototype)) throw new Error("A constructor other than Object was named 'Object'\n" + JSON.stringify(value));
                    if ("__proto" in constructor && typeof constructor.__proto === "string") {
                        if (constructor.__proto !== "Object") throw new Error("A constructor other than Object was named 'Object'\n" + JSON.stringify(value));
                    }*/
                    return true;

                } else if (constructor.__class === "Array") {
                    /*if (Object.getPrototypeOf(value) !== Array.prototype) throw new Error("A constructor other than Array was named 'Array'\n" + JSON.stringify(value));
                    if ("__proto" in constructor && typeof constructor.__proto === "string") {
                        if (constructor.__proto !== "Array") throw new Error("A constructor other than Array was named 'Array'\n" + JSON.stringify(value));
                    }*/
                    return true;
                }
            }
            return false;
        }
    }


    var symbolsArray; //put here so it is accessible to the outer scope --- refineReflection()

    function makeIterable() {
        symbolsArray = Object.getOwnPropertySymbols(values.symbol);

        const iterableObj = {};
        iterableObj[Symbol.iterator] = returnIterator;
        return iterableObj;

            /* 
            * This is a worker function, for iterating over all of the values and references
            * iterableObj exists solely for the purpose of having an iterator. (NOTE: for ... of IS NOT WORKING WITH THIS ITERATOR FOR SOME REASON?!?)
            * The iterations will return the original object from values arrays/dictionaries,
            * but also update other variables from the outer scope -- refineReflection()
            */

        function returnIterator() {
            let typeFunction = iterateOverConsts; //this changes to the function for the current type being iterated over
            index = -1;
            isConst = true;
            category = "const"
            const FINISHED = Symbol("finished iterating");

            return iterateOverAllValues;

            function iterateOverAllValues() {
                let val = typeFunction();
                return {
                    value: value = (val === FINISHED ? undefined : val),
                    done: val === FINISHED
                }
            }

            function iterateOverConsts() {
                if (++index < values.const.length) {
                    let val = updateVars();
                    type = constructor.type;
                    isSymbol = type === "symbol";
                    return val;

                } else {
                    type = category = "object";
                    isConst = false;
                    isSymbol = false;
                    index = -1;
                    return (typeFunction = iterateOverObjects)();

                }
            }

            function updateVars() {
                isIndexed = null;
                refs = references[category][index];
                constructor = refs[0];
                firstRef = refs.firstReference;
                return values[category][index];
            }

            function iterateOverObjects() {
                if (++index < values.object.length)
                    return updateVars();

                else {
                    type = category = "function";
                    index = -1;
                    return (typeFunction = iterateOverFunctions)();
                }
            }

            function iterateOverFunctions() {
                if (++index < values.function.length)
                    return updateVars();

                else {
                    type = category = "symbol";
                    isSymbol = true;
                    symbolsArray = Object.getOwnPropertySymbols(values.symbol);
                    symbolsArray.index = -1;
                    return (typeFunction = iterateOverSymbols)();
                }
            }

            function iterateOverSymbols() {
                if (++symbolsArray.index < symbolsArray.length) {
                    index = symbolsArray[symbolsArray.index];
                    updateVars();
                    if (constructor.isConst) return CONST_PLACEHOLDER;
                    return index;

                } else return FINISHED
            }
        }
    }
}


function pushArraysToPublicProperties() { // because it is a closure, can't access the parent 'this' -- use constant THIS instead
    THIS.values = values;
    THIS.reflections = references;
    THIS.constructed = constructed;
    THIS.circularReferences = circularReferences;
    THIS.indexed = indexed;
    THIS.unindexed = unindexed;
    THIS.errors = errors;
}

}


initializeLogger?.("reflect ran");