node-continuable
================

A module to aid in asynchronous code in Node.

Examples:
--------

    // write an asynchronous function that outputs whatever it is given
    var async_function = function(val) {
      var cont = continuable.create();  // This line creates the continuable for this function

      process.nextTick(function() {
          cont.fulfill(val);            // fulfill it
        });

      return cont;                      // return the continuable for people to use
    };

    // simple
    async_function(true)
      (function(val) {
        // val == true
      });

    // the second parameter indicates if there was an error or not
    async_function({hello: 'world'})
      (function(val, succeeded) {
        // val == {hello: 'world'}
        // succeeded == true
      });

    // uh oh!
    async_function(new Error())
      (function(val, succeeded) {
        // val == new Error
        // succeeded = false
      });

They can be chained:

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
    continuable.group({
        one: async_function(1),
        two: async_function(2),
        three: async_function(3)
      })
      (function(result) {
        // result == {one: 1, two: 2, three: 3}
      });

    // or an array
    continuable.group([
        async_function(1),
        async_function(2),
        async_function(3)
      ])
      (function(result) {
        // result == [1,2,3]
      });

Installing
----------

To install, just download the code and stick the `continuable.js` file in your `~/.node_libraries` folder, and you're good to go.
