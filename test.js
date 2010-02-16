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
      async_function(42)
        (function(val) {
          test.assert.equal(42, val);
          test.finish();
        });
    },
    "test late callbacks": function(test) {
      test.numAssertionsExpected = 1;
      var c = async_function(42);
      process.nextTick(function() {
          c(function(val) {
            test.assert.equal(42, val);
            test.finish();
          });
        });
    },
    "test chain": function(test) {
      test.numAssertionsExpected = 2;
      async_function(true)
        (function(val) {
          test.assert.ok(val);
          return 42;
         })
        (function(val) {
          test.assert.equal(42, val);
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
        (function(val) {
          test.assert.ok(val instanceof Error);

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
    "test error is thrown if not handled": function(test) {
      test.numAssertionsExpected = 2;
 
      var err1 = new Error();
      async_function(err1);

      var err2 = new Error();
      async_function()
        (function() {
          return err2;
        });

      process.addListener('uncaughtException', function(err) {
          if( err == err1 || err == err2 ) {
            test.assert.ok(true);
          }
          else {
            throw(err);
          }
        });

    },
    "test error is not thrown if not handled": function(test) {
      test.numAssertionsExpected = 0;
 
      async_function(new Error())(function() {
          return true;
        });

      var c = async_function(new Error('hi'));

      process.nextTick(function() {
          c(function() {
              return true;
            });
        });
    },
    "test can't fulfill twice": function(test) {
      test.numAssertionsExpected = 1;
      test.assert.throws(function() {
          sync_function(true).fulfill(false);
        });
    },
    "test different success errback callback with either": function(test) {
      test.numAssertionsExpected = 2;
      async_function(0)
        (continuables.either(function success(val) {
          test.assert.equal(0, val);
         },
         function error(val) {
          // should not be called
          test.assert.ok(false);
         }));

      var err = new Error();
      async_function(err)
        (continuables.either(function success(val) {
          // should not be called
          test.assert.ok(false);
         },
         function error(val) {
          test.assert.equal(err, val);
          // return something so the error isn't thrown
          return true;
         }));
    },
    "test chaining different success errback callbacks with either": function(test) {
      test.numAssertionsExpected = 5;
      async_function(0)
        (continuables.either(function success(val) {
          test.assert.equal(0, val);
          return 1;
         },
         function error(val) {
          // should not be called
          test.assert.ok(false);
         }))
        (continuables.either(function success(val) {
          test.assert.equal(1, val);
         },
         function error(val) {
          // should not be called
          test.assert.ok(false);
         }));

      var err = new Error();
      async_function(err)
        (continuables.either(function success(val) {
          // should not be called
          test.assert.ok(false);
         },
         function error(val) {
          test.assert.equal(err, val);
         }))
        (continuables.either(function success(val) {
          // should not be called
          test.assert.ok(false);
         },
         function error(val) {
          test.assert.equal(err, val);
          return 1;
         }))
        (continuables.either(function success(val) {
          test.assert.equal(1, val);
         },
         function error(val) {
          // should not be called
          test.assert.ok(false);
         }));
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
    "test fires if all synchronous": function(test) {
      test.numAssertionsExpected = 1;
      continuables.group([ 1, 2, 3 ])
        (function(result) {
          test.assert.deepEqual([1,2,3], result);
          test.finish();
         });
    },
    "test group with errors": function(test) {
      test.numAssertionsExpected = 4;
      var error1 = new Error();
      var error2 = new Error();
      var cont = continuables.create();
      continuables.group([ 1, error1, 3, cont ])
        (function(result) {
          test.assert.equal(1, result[0]);
          test.assert.equal(error1, result[1]);
          test.assert.equal(3, result[2]);
          test.assert.equal(error2, result[3]);
          test.finish();
          return true;
         });

     cont.fulfill(error2);
    },
  });
