"use strict";

/* ListenerFilter() documentation:
 * 
 * NOTE: THIS IS QUICK AND DIRTY --- IT DOES NOT ACCOUNT FOR OPTIONS / CAPTURE / ETC NUANCES
 * OPTIONS/CAPTURE ARGS ARE PASSED ALONG TO THE SYSTEM FUNCTION, BUT NOT ACKNOWLEDGED BY THIS FUNCTION
 * THIS COULD CREATE UNDESIRED OR UNPREDICTABLE BEHAVIOR IF USING OPTIONS/CAPTURE/ETC
 * 
 * ALSO, THIS ONLY EFFECTS element.addEventListener / element.removeEventListener
 * Does NOT do anything to element properties like element.onclick , window.onresize , etc.
 * 
 * 
 * Maintains arrays of event listeners for each object inheritted from a given prototype, and submits to three callback filters -- add, event, and remove
 * Returns an accessor object with functions to obtain copies of the various arrays
 * 
 * ADD FILTER:
 * addFilter(listenerArray, eventType, listener, ...optionsArgs)
 * 
 * Note that the listenerArray will NOT include the listener being added, as it is not added until instructed to do so by the addFilter callback return
 * 
 * addFilter can return an object in the below format, or an empty string (or an object with only one of the key-value pairs).  Unprovided values default as follows:
 *      { addToFilterList = eventType, removeFromSystemList = eventType, addToSystemList = false }
 * 
 *      Note that falsey values such as null, 0, undefined, and "" (empty string) will evaluate as false, and no action will be taken in that regard
 *      Actual 'true' (boolean only) will cause the default eventType to be used
 *      Other truthy values will be coerced into a string if they are not already, and used to either submit to the system function,
 *          or as the eventType key reference for the filter's array of listeners for that object/eventType pair
 *          
 *          
 * 
 * EVENT FILTER:
 * When an event occurs, the array of listeners for that particular eventType are submitted to eventFilter, which can modify or substitute in its return:
 *      1) The event object itself, and
 *      2) The array of listeners to be invoked.  Invocation will be in order of index
 *
 * eventFilter can return an object in the below format, or an empty string (or an object with only one of the key-value pairs).  Unprovided values default as follows:
 * { event = eventObjectFromSystem, listeners = arrayMaintainedByListenerFilterClosure }
 * 
 * 
 * 
 * REMOVE FILTER:
 * removeFilter(listenerArray, eventType, listener, ...optionsArgs)
 * 
 * Note that the listenerArray will include the listener being removed, as it is not removed until instructed to do so by the filter callback return
 * Same return format as addFilter, except with two return arguments instead of three:
 *      { removeFromFilterList = eventType, removeFromSystemList = eventType }
 * 
 * 
 * Note on 'this' argument in callback filters:
 * Add and remove filters are called with the 'this' argument of the object on which the add/remove function is being called upon
 * Event filters and listeners are called with the same 'this' argument which the system provides to event callbacks
 * Obviously, any of these will be overriden if the filter/listener is a bound function
 * 
 * 
 * ListenerFilter itself is an accessor object with the following functions 
 *  --  addEventListener(...args)       This is the native system function.  Use .apply or .call to invoke on a particular object
 *  --  removeEventListener(...args)    This is the native system function.  Use .apply or .call to invoke on a particular object
 *  --  getAffectedObjects()            Returns a copy of the objectsAffected array (all objects which currently have at least one filtered listener
 *                                                      of any event type, even if the event type is not recognized by the system)
 *  --  getListeners(object, eventType = undefined)
 *              -If an eventType is provided (any truthy value) returns a copy of the listeners array for that eventType in the given object
 *              -If no eventType is provided (any falsey value) returns a two-layer deep copy of the listeners reference object, formated like:
 *                              { eventType1: [listeners], eventType2: [listeners], etc... }
 *              -Returns undefined if the object isn't in the objectsAffected array, or if the provided eventType isn't included in that object's list
 *                  
 */             

function ListenerFilter(targetProto,
        addFilter = function (listenerArray, eventType, listener, ...options) { return { addToFilterList: eventType, addToSystemList: false, removeFromSystemList: eventType }; },
        eventFilter = function (listenerArray, eventType, event) { return { event: event, listeners: listenerArray }; },
        removeFilter = function (listenerArray, eventType, listener, ...options) { return { removeFromFilterList: eventType, removeFromSystemList: eventType }; },
    ) {

    const nativeAddEventListener = targetProto.addEventListener;
    const nativeRemoveEventListener = targetProto.removeEventListener;

    this.addEventListener = nativeAddEventListener;
    this.removeEventListener = nativeRemoveEventListener;
    this.getAffectedObjects = getAffectedObjects;
    this.getListeners = getListeners

    targetProto.addEventListener = addEventListenerFiltered;
    targetProto.removeEventListener = removeEventListenerFiltered;

    const objectsAffected = []; //parallel arrays
    const objectListeners = [];

    return;

    function addEventListenerFiltered(eventType, listener, ...args) { 
        if (typeof listener !== "function" && typeof listener !== "object") return;
        let index = objectsAffected.indexOf(this);
        let myListeners;
        if (index >= 0) {
            myListeners = objectListeners[index];

        } else {
            myListeners = {};
            objectsAffected.push(this);
            objectListeners.push(myListeners);
        }

        let isEstablishedEventType
        let myEventTypeListeners;
        getListenersArray(eventType);

        function getListenersArray(eventType) { //invoked again below, if event type changes for addToFilterList
            if (isEstablishedEventType = (eventType in myListeners)) {
                myEventTypeListeners = myListeners[eventType];

            } else {
                myEventTypeListeners = [];
                myListeners[eventType] = myEventTypeListeners;
            }
        }

        let { addToFilterList = eventType, removeFromSystemList = eventType, addToSystemList = false } = addFilter.call(this, [...myEventTypeListeners], ...arguments)
        let returnVal;

        if (addToFilterList) {
            if (addToFilterList === true) addToFilterList = eventType;
            else if (addToFilterList !== eventType) {
                if (!isEstablishedEventType) delete myListeners[eventType];
                getListenersArray(eventType);
            }

            if (isEstablishedEventType) {
                if (!myEventTypeListeners.includes(listener)) {
                    myEventTypeListeners.push(listener);
                    returnVal = myEventTypeListeners.returnVal;
                }


            } else {
                myEventTypeListeners.push(listener);
                myEventTypeListeners.handler = eventHandler;
                returnVal = nativeAddEventListener.call(this, addToFilterList, eventHandler, ...args);
                myEventTypeListeners.returnVal = returnVal;
            }

        } else if (!isEstablishedEventType) {
            delete myListeners[eventType];
		}

        if (removeFromSystemList === true ? (removeFromSystemList = eventType) : removeFromSystemList)
            nativeRemoveEventListener.call(this, removeFromSystemList, listener, ...args);

        if (addToSystemList === true ? (addToSystemList = eventType) : addToSystemList)
            returnVal = nativeAddEventListener.call(this, addToSystemList, listener, ...args);

        return returnVal; //should always be undefined, but including here *just* in case

        function eventHandler(e) {
            let { event = e, listeners = myEventTypeListeners } = eventFilter.call(this, [...myEventTypeListeners], eventType, ...arguments);

            arguments[0] = event;
            for (let listener of listeners) {
                try {
                    if (typeof listener === "function") {
                        listener.apply(this, arguments);

                    } else if (typeof listener.handleEvent === "function") {
                        listener.handleEvent.apply(this, arguments);
                    }

                } catch (error) {
                    try { console.error(error); } catch (err2) { /*whelp!?*/}
                }
            }
		}
    }

    function removeEventListenerFiltered(eventType, listener, ...args) {
        let objIndex = objectsAffected.indexOf(this);
        let eventTypeListeners = objectListeners[objIndex]?.[eventType];
        let { removeFromFilterList = eventType, removeFromSystemList = eventType } = removeFilter.call(this, [...(eventTypeListeners ?? [])], eventType, listener, ...args)

        let returnVal;

        if (removeFromFilterList) {
            if (removeFromFilterList !== eventType) eventTypeListeners = objectListeners[objIndex][removeFromFilterList];
            if (eventTypeListeners) {
                let listenerIndex = eventTypeListeners.indexOf(listener);

                if (listenerIndex >= 0) {
                    eventTypeListeners.splice(listenerIndex, 1);

                    if (eventTypeListeners.length <= 0) { //array is empty.  remove from object's list of events
                        let handler = eventTypeListeners.handler;
                        delete objectListeners[objIndex][eventType];
                        returnVal = nativeRemoveEventListener.call(this, eventType, handler, ...args);

                        if (Object.keys(objectListeners[objIndex]).length <= 0) { //this object has no more event types left
                            objectListeners.splice(objIndex, 1);
                            objectsAffected.splice(objIndex, 1);
						}
                    }
                }
			}
		}

        if (removeFromSystemList) returnVal = nativeRemoveEventListener.call(this, removeFromSystemList, listener, ...args);

        return returnVal; //should generally be undefined, but you never know ;-P
    }

    function getAffectedObjects() {
        return [...objectsAffected];
    }

    function getListeners(object, eventType = undefined) {
        let objIndex = objectsAffected.indexOf(object);
        if (objIndex < 0) return undefined;

        let myListeners = objectListeners[objIndex];
        if (eventType) {
            if (eventType in myListeners) {
                return [...myListeners[eventType]];

            } else return undefined;
            
        } else {
            let myListenersCopy = {};
            for (eventType in myListeners) {
                myListenersCopy[eventType] = [...myListeners[eventType]];
			}
            return myListenersCopy;
		}
	}
}