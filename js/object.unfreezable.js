"use strict"; document.currentScript.initTime = performance.now();

/* can't be frozen, sealed, have its prototype changed, or have properties redefined by Object.defineProperty/defineProperties
 * therefore it is impossible to make a property-key permenant, unwriteable, unconfigurable, unenumerable, etc... 
 * All property-keys (except __proto__) can always be changed/added with assignment operator '=' or deleted with keyword 'delete'
 */


class UnfreezeableObject extends Object {
    constructor() {
        super(arguments);
    }
}

Object.defineProperty(UnfreezeableObject.prototype, "__proto__", {
    writable: false, configurable: false, enumerable: false,
    value: UnfreezeableObject.prototype
});

Object.freeze(UnfreezeableObject); //ironic, isn't it ;-)
Object.freeze(UnfreezeableObject.prototype); //but its the only way to guarentee the unfreeze-ability can't be overriden

Object.defineProperties(Object, {
    freeze: {
        value: function () {
            const OBJECT_FREEZE = Object.freeze;
            return function freezeExceptUnfreezable(obj) {
                if (obj instanceof UnfreezeableObject) throw new Error("Cannot freeze an instance of UnfreezeableObject");
                return OBJECT_FREEZE.apply(this, arguments);
            }
        }()
    },
    seal: {
        value: function () {
            const OBJECT_SEAL = Object.seal;
            return function sealExceptUnfreezable(obj) {
                if (obj instanceof UnfreezeableObject) throw new Error("Cannot seal an instance of UnfreezeableObject");
                return OBJECT_SEAL.apply(this, arguments);
            }
        }()
    },
    preventExtensions: {
        value: function () {
            const OBJECT_PREVENT_EXTENSIONS = Object.preventExtensions;
            return function preventExtensionsExceptUnfreezable(obj) {
                if (obj instanceof UnfreezeableObject) throw new Error("Cannot prevent extensions of an instance of UnfreezeableObject!");
                return OBJECT_PREVENT_EXTENSIONS.apply(this, arguments);
            }
        }()
    },
    setPrototypeOf: {
        value: function () {
            const OBJECT_SET_PROTOTYPE_OF = Object.setPrototypeOf;
            return function setPrototypeOfExceptUnfreezable(obj) {
                if (obj instanceof UnfreezeableObject) throw new Error("Cannot change the prototype of an instance of UnfreezeableObject!");
                return OBJECT_SET_PROTOTYPE_OF.apply(this, arguments);
            }
        }()
    },
    defineProperty: {
        value: function () {
            const OBJECT_DEFINE_PROPERTY = Object.defineProperty;
            return function setPrototypeOfExceptUnfreezable(obj) {
                if (obj instanceof UnfreezeableObject) throw new Error("Cannot configure the properties of an instance of UnfreezeableObject!  Use the assignment operator '=' or keyword 'delete' to alter properties");
                return OBJECT_DEFINE_PROPERTY.apply(this, arguments);
            }
        }()
    },
    defineProperties: {
        value: function () {
            const OBJECT_DEFINE_PROPERTIES = Object.defineProperties;
            return function setPrototypeOfExceptUnfreezable(obj) {
                if (obj instanceof UnfreezeableObject) throw new Error("Cannot configure the properties of an instance of UnfreezeableObject!  Use the assignment operator '=' or keyword 'delete' to alter properties");
                return OBJECT_DEFINE_PROPERTIES.apply(this, arguments);
            }
        }()
    }
});

initializeLogger?.("object.unfreezable ran");