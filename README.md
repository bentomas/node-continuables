node-continuables
================

A module to aid in asynchronous code in Node.

An implementation of an idea suggested by [Felix](http://github.com/felixge)
on [the Node mailing list](http://groups.google.com/group/nodejs/msg/44fdc68c6e344505)

This is really intended for people writing asynchronous libraries for Node.  It makes creating
and managing continuables really easy.

Examples:
--------

    var continuables = require('continuables');

    // let's say you have an asynchronous function that outputs whatever it is given.
    // let's make it use the continuables module
    var async_function = function(val) {
      // This line creates a continuable for this function
      var continuable = continuables.create();

      process.nextTick(function() {
          // fulfill it
          if(val instanceof Error) {
            continuable.emitError(val);
          }
          else {
            continuable.emitSuccess(val);
          }
        });

      // return the continuable for people to use
      return continuable;
    };

    // simple
    async_function(true)
      (function(val) {
        // val == true
      });

    // if there was an error, the second parameter will tell you
    async_function({hello: 'world'})
      (function(val, successful) {
        // val == {hello: 'world'}
        // successful == true
      });

    async_function(new Error())
      (function(val, successful) {
        // val == new Error()
        // successful == false
      });

    // this last example will throw because the code didn't 'handle' the error
    // here is an example that doesn't

    async_function(new Error())
      (function(val, successful) {
        // val == new Error()
        // successful == false

        // return something that isn't an error, indicating it has been handled
        return true;
      });

continuables can be chained:

    async_function(true)
      (function(val) {
        // val == true
        return false
      })
      (function(val) {
        // val == false
      })

The module also comes with a group function, for doing many asynchronous calls at once:
  
    // it can take an object
    continuables.group({
        one: async_function(1),
        two: async_function(2),
        three: async_function(3)
      })
      (function(result) {
        // result == {one: 1, two: 2, three: 3}
      });

    // or an array
    continuables.group([
        async_function(1),
        async_function(2),
        async_function(3)
      ])
      (function(result) {
        // result == [1,2,3]
      });

This also works great with Node's Promise objects.

Installing
----------

To install, just download the code and stick the `continuables.js` file in your `~/.node_libraries` folder, and you're good to go.
