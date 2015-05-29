/**
 * eventq.js - A Simple Event Queue (for javascript client)
 *
 *  Add a simple event queue to non-dom objects (without heavy plugins like jQuery).
 *  Can be used as a standalone event handler object, or attached to any other object.
 *
 * Author: Dave Z <zimmed@zimmed.io>
 * Created: 28 May 15
 * License: MIT
 *
 * Example Usage (with parent):
 *  var MyClass = function (initData) {
 *      // Instantiate new event queue
 *      this._q = new SimpleEventQ({
 *          // Define default behavior
 *          chat: function (e) {
 *              console.log('New chat message: ' + e.data.message);
 *          },
 *          'some.crazy-evt': function (e) {
 *              breakEverything();
 *          }
 *      }, this);
 *      this.data = initData;
 *  };
 *  var myObj = new MyClass('Neato');
 *  myObj.on('some.crazy-evt', function (e) {
 *      e.preventDefault(); // Will no longer breakEverything();
 *      console.log(this.data); // Will log myObj.data to the console.
 *      // Same as:
 *      // console.log(e.target.data);
 *  });
 *  myObj.on('chat', function (e) { this.data = e.data.message; });
 *  // This trigger will first set myObj.data <- "Hello, world!", and then
 *  //  log "New chat message: Hello, world!" to the console:
 *  myObj.trigger('chat', {message: 'Hello, world!'});
 *  // The .off method will only remove non-default listeners.
 *  myObj.off('chat').trigger('chat', {message: 'Yo!'});
 *  // The previous trigger only logged the message; myObj.data is unchanged.
 *  // The next trigger will only log the passed data, and will not call
 *  //  breakEverything():
 *  myObj.trigger('some.crazy-evt', 'data');
 *
 * Example Usage (without parent):
 *  var myQ = new SimpleEventQ({
 *      logMessage: function (e) {
 *          console.log(e.data.msg);
 *      }
 *  });
 *  myQ.on('logMessage', function (e) {
 *      var xhr = new XMLHTTPRequest();
 *      xhr('GET', '/serverlogger/?message=' + e.data.msg, true).send();
 *      e.data.msg = 'Sent message to server: ' + e.data.msg;
 *      this.trigger('alertMessage', {msg: e.data.msg}); // this <- myQ
 *  });
 *  myQ.on('alertMessage', function (e) { alert(e.data.msg); });
 *  document.getElementById('input').onkeypress = function (e) {
 *      if (e.which === 13) {
 *          myQ.trigger('logMessage', {msg: this.value});
 *          // First the message is sent in an HTTP request, then displayed to
 *          //  the user via `alert`, and finally logged to the console.
 *          this.value = "";
 *      }
 *  };
 *
 * Note: Methods .on .off and .trigger can be chained.
 *
 */

(function (exportModule) {
    'use strict';
    
    if (!exportModule || typeof(exportModule) !== 'object') {
        throw new Error('eventQ: Must be initialized with valid export module.');
    }
    
    /**
     * Event - The event object passed to handler functions.
     *  @property {String} name - The event name triggered.
     *  @property {Object} target - The object on which the event was triggered.
     *  @property {Object?} data - The data passed into the event.
     *  @method preventDefault() - Prevent the default behavior.
     *  @method halt() - Prevent any other listeners in the tree from being fired.
     */
    var Event = (function () {
        var prevent = false, halt = false;
        
        E.prototype.constructor = function (event, obj, data) {
            this.name = event;
            this.target = obj;
            this.data = data;
        };
        E.prototype.preventDefault = function () {
            prevent = true;
        };
        E.prototype.isPrevented = function () {
            return prevent;
        };
        E.prototype.halt = function () {
            halt = true;
        };
        E.prototype.isHalted = function () {
            return halt;
        };
        
        function E () {
            return this.constructor.apply(this, arguments);
        }
    }());
    
    /**
     * SimpleEventQ - An event queue with simple synchronous listeners.
     * @constructor
     *  @param {Object} defaults - Default listeners
     *  @param {Object?} listenTo - Optional object to attach to.
     *      If undefined, the event queue will listen to itself.
     * @method {Object} getParent - Returns the attached object.
     * @method parent.on - Add event listener to parent object.
     *  @param {String} event - The event name to listen for.
     *  @param {Function} listener (e:Event) - The callback function.
     * @method parent.off - Remove all event listeners from the parent.
     *  @param {String} event - The event name to stop listening for.
     * @method parent.trigger - Fire an event by name.
     *  @param {String} event - The event to activate.
     *  @param {Object?} data - Event data to pass to listener.
     */
    exportModule.SimpleEventQ = (function () {
        
        var listeners = {},
            defListeners = {},
            object = null,
            fireEvent = function (event, data) {
                var e = new Event(event, object, data);
                if (listeners.hasOwnProperty(event) &&
                    Array.isArray(listeners[event]) &&
                    listeners[event].length > 0) {
                    listeners[event][listeners.length - 1](e);
                }
                if (!e.isPrevented() && !e.isHalted() &&
                    defListeners.hasOwnProperty(event)) {
                    defListeners[event](e);
                }
            },
            removeListeners = function (event) {
                if (!event) listeners = {};
                else if (listeners.hasOwnProperty(event)) {
                    delete listeners[event];
                }
            },
            addListener = function (event, listener) {
                var q, next;
                if (!listeners.hasOwnProperty(event)) {
                    q = listeners[event] = [];
                }
                next = (q.length) ? q[q.length - 1] : false;
                q.push(function (e) {
                    listener.apply(object, [e]);
                    if (!e.isHalted() && next) next.apply(object, [e]);
                });
            },
            addDefault = function (event, listener) {
                defListeners[event] = function (e) {
                    listener.apply(object, [e]);
                };
            };
        
        SimpleEventQ.prototype.constructor = function (defaults, listenTo) {
            object = listenTo || this;
            object.on = function (event, listener) {
                addListener(event, listener, listeners);
                return this;
            };
            object.off = function (event) {
                removeListeners(event);
                return this;
            };
            object.trigger = function (event, data) {
                fireEvent(event, data);
                return this;
            };
            for (var prop in defaults) {
                if (defaults.hasOwnProperty(prop)) {
                    addDefault(prop, defaults);
                }
            }
        };
        SimpleEventQ.prototype.getParent = function () { return object; };
    
        return SimpleEventQ;
        
        function SimpleEventQ () {
            return this.constructor.apply(this, arguments);
        }
    }());
    
}(window));