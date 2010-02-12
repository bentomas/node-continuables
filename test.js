var sys = require('sys'),
    events = require('events'),
    TestSuite = require('async_testing').TestSuite;

var continuables = require('./continuables');

var async_function = function(val) {
  var cont = continuables.create();

  process.nextTick(function() {
      cont.fulfill(val);
    });

  return cont;
};
var sync_function = function(val) {
  var cont = continuables.create();
  if( typeof val !== 'undefined' ) {
    cont.fulfill(val);
  }
  return cont;
};


(new TestSuite('Continuables suite'))
  .runTests({
    "test simple": function(test) {
      test.numAssertionsExpected = 1;
      async_function(true)
        (function(val) {
          test.assert.ok(val);
          test.finish();
        });
    },
    "test chain": function(test) {
      test.numAssertionsExpected = 2;
      async_function(true)
        (function(val) {
          test.assert.ok(val);
          return false;
         })
        (function(val) {
          test.assert.ok(!val);
          test.finish();
         });
    },
    "test callback can return continuables": function(test) {
      test.numAssertionsExpected = 1;
      async_function(true)
        (function(val) {
          return async_function(43)(function(val) {
              return async_function(val-1);
            });
         })
        (function(val) {
          test.assert.equal(42, val);
          test.finish();
         });
    },
    "test callback can return Promises": function(test) {
      test.numAssertionsExpected = 3;
      async_function(true)
        (function(val) {
          var p = new events.Promise();
          process.nextTick(function() {
              p.emitSuccess(42);
            });
          return p;
         })
        (function(val) {
          test.assert.equal(42, val);

          var p = new events.Promise();
          process.nextTick(function() {
              p.emitError(new Error());
            });
          return p;
         })
        (function(val, success) {
          test.assert.ok(!success);

          var p1 = new events.Promise();
          var p2 = new events.Promise();

          process.nextTick(function() {
              p1.emitSuccess(p2);
              p2.emitSuccess(42);
            });
          return p1;
         })
        (function(val) {
          test.assert.equal(42, val);
          test.finish();
         });
    },
    "test status parameter": function(test) {
      test.numAssertionsExpected = 2;
      async_function(new Error())
        (function(val, succeeded) {
          test.assert.ok(!succeeded);
          return true;
         })
        (function(val, succeeded) {
          test.assert.ok(succeeded);
          test.finish();
         })
    },
    "test error throws if not handled": function(test) {
      test.numAssertionsExpected = 2;

      test.assert.throws(function() {
          sync_function(new Error());
        });

      var continuable = sync_function()
        (function() {
          return new Error();
        });

      test.assert.throws(function() {
          continuable.fulfill();
        });
    },
    "test success status can be overridden by the original fulfillers": function(test) {
      test.numAssertionsExpected = 4;

      test.assert.throws(function() {
          var cont = async_function()
            (function(val, success) {
              test.assert.ok(val);
              test.assert.ok(!success);
            });
          cont.fulfill(true, false);
        });

      // but returning something can override status
      test.assert.doesNotThrow(function() {
        var cont = async_function()
          (function(val, success) {
            return 1;
          });
        cont.fulfill(true, false);
      });
    },
  });

(new TestSuite('Groups suite'))
  .runTests({
    "test object": function(test) {
      test.numAssertionsExpected = 1;
      continuables.group({
          'one': async_function(1),
          'two': async_function(2),
          'three': async_function(3),
        })
        (function(result) {
          test.assert.deepEqual({one: 1, two: 2, three: 3}, result);
          test.finish();
         });
    },
    "test array": function(test) {
      test.numAssertionsExpected = 1;
      continuables.group([
          async_function(1),
          async_function(2),
          async_function(3),
        ])
        (function(result) {
          test.assert.deepEqual([1,2,3], result);
          test.finish();
         });
    },
    "test can take other objects": function(test) {
      test.numAssertionsExpected = 1;
      var two = function() { return 2; };
      var three = new events.Promise();
      continuables.group([
          1,
          two,
          three
        ])
        (function(result) {
          test.assert.deepEqual([1,two,3], result);
          test.finish();
         });

      three.emitSuccess(3);
    },
    "test group waits for all promise/continuable chains to finish": function(test) {
      test.numAssertionsExpected = 1;
      var p1 = new events.Promise();
      var p2 = new events.Promise();
      var p3 = new events.Promise();
      var p4 = new events.Promise();
      continuables.group([
          p1,
          async_function(false)(function(val) { return p2; }),
          p3
        ])
        (function(result) {
          test.assert.deepEqual([true, true, true], result);
          test.finish();
         });

      p1.emitSuccess(new async_function(true));
      p2.emitSuccess(new async_function(true));
      p3.emitSuccess(p4);
      p4.emitSuccess(true);
    },
  });
