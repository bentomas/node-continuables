// To run these tests you need the node-async-testing library which can be 
// found here: http://github.com/bentomas/node-async-testing


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


exports['Continuables suite'] = (new TestSuite())
  .addTests({
    "test simple": function(assert, finished) {
      this.numAssertionsExpected = 1;
      async_function(42)
        (function(val) {
          assert.equal(42, val);
          finished();
        });
    },
    "test chain": function(assert, finished) {
      this.numAssertionsExpected = 2;
      async_function(true)
        (function(val) {
          assert.ok(val);
          return 42;
         })
        (function(val) {
          assert.equal(42, val);
          finished();
         });
    },
    "test callback can return continuables": function(assert, finished) {
      this.numAssertionsExpected = 1;
      async_function(true)
        (function(val) {
          return async_function(43)(function(val) {
              return async_function(val-1);
            });
         })
        (function(val) {
          assert.equal(42, val);
          finished();
         });
    },
    "test callback can return Promises": function(assert, finished) {
      this.numAssertionsExpected = 3;
      async_function(true)
        (function(val) {
          var p = new events.Promise();
          process.nextTick(function() {
              p.emitSuccess(42);
            });
          return p;
         })
        (function(val) {
          assert.equal(42, val);

          var p = new events.Promise();
          process.nextTick(function() {
              p.emitError(new Error());
            });
          return p;
         })
        (function(val) {
          assert.ok(val instanceof Error);

          var p1 = new events.Promise();
          var p2 = new events.Promise();

          process.nextTick(function() {
              p1.emitSuccess(p2);
              p2.emitSuccess(42);
            });
          return p1;
         })
        (function(val) {
          assert.equal(42, val);
          finished();
         });
    },
    "test error is thrown if not handled": function(assert, finished, test) {
      this.numAssertionsExpected = 2;
 
      var err1 = new Error();
      async_function(err1);

      var err2 = new Error();
      async_function()
        (function() {
          return err2;
        });

      var countDone = 0;
      test.addListener('uncaughtException', function(err) {
          if( err == err1 || err == err2 ) {
            countDone++;
            assert.ok(true);
            if(countDone == 2) {
              finished();
            }
          }
          else {
            throw(err);
          }
        });

    },
    "test can't fulfill twice": function(assert) {
      this.numAssertionsExpected = 1;
      assert.throws(function() {
          sync_function(true).fulfill(false);
        });
    },
    "test different success errback callback with either": function(assert, finished) {
      this.numAssertionsExpected = 2;
      async_function(0)
        (continuables.either(function success(val) {
          assert.equal(0, val);
         },
         function error(val) {
          // should not be called
          assert.ok(false);
         }));

      var err = new Error();
      async_function(err)
        (continuables.either(function success(val) {
          // should not be called
          assert.ok(false);
         },
         function error(val) {
          assert.equal(err, val);
          // return something so the error isn't thrown
          return true;
         }))
        (function() {
          finished();
         });
    },
    "test chaining different success errback callbacks with either": function(assert, finished) {
      this.numAssertionsExpected = 5;
      async_function(0)
        (continuables.either(function success(val) {
          assert.equal(0, val);
          return 1;
         },
         function error(val) {
          // should not be called
          assert.ok(false);
         }))
        (continuables.either(function success(val) {
          assert.equal(1, val);
         },
         function error(val) {
          // should not be called
          assert.ok(false);
         }));

      var err = new Error();
      async_function(err)
        (continuables.either(function success(val) {
          // should not be called
          assert.ok(false);
         },
         function error(val) {
          assert.equal(err, val);
         }))
        (continuables.either(function success(val) {
          // should not be called
          assert.ok(false);
         },
         function error(val) {
          assert.equal(err, val);
          return 1;
         }))
        (continuables.either(function success(val) {
          assert.equal(1, val);
         },
         function error(val) {
          // should not be called
          assert.ok(false);
         }))
        (function() {
          finished();
         });
    },
  });

exports['Groups suite'] = (new TestSuite())
  .addTests({
    "test object": function(assert, finished) {
      this.numAssertionsExpected = 1;
      continuables.group({
          'one': async_function(1),
          'two': async_function(2),
          'three': async_function(3),
        })
        (function(result) {
          assert.deepEqual({one: 1, two: 2, three: 3}, result);
          finished();
         });
    },
    "test array": function(assert, finished) {
      this.numAssertionsExpected = 1;
      continuables.group([
          async_function(1),
          async_function(2),
          async_function(3),
        ])
        (function(result) {
          assert.deepEqual([1,2,3], result);
          finished();
         });
    },
    "test can take other objects": function(assert, finished) {
      this.numAssertionsExpected = 1;
      var two = function() { return 2; };
      var three = new events.Promise();
      continuables.group([
          1,
          two,
          three
        ])
        (function(result) {
          assert.deepEqual([1,two,3], result);
          finished();
         });

      three.emitSuccess(3);
    },
    "test group waits for all promise/continuable chains to finish": function(assert, finished) {
      this.numAssertionsExpected = 1;
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
          assert.deepEqual([true, true, true], result);
          finished();
         });

      p1.emitSuccess(new async_function(true));
      p2.emitSuccess(new async_function(true));
      p3.emitSuccess(p4);
      p4.emitSuccess(true);
    },
    "test fires if all synchronous": function(assert, finished) {
      this.numAssertionsExpected = 1;
      continuables.group([ 1, 2, 3 ])
        (function(result) {
          assert.deepEqual([1,2,3], result);
          finished();
         });
    },
    "test group with errors": function(assert, finished) {
      this.numAssertionsExpected = 4;
      var error1 = new Error();
      var error2 = new Error();
      var cont = continuables.create();
      continuables.group([ 1, error1, 3, cont ])
        (function(result) {
          assert.equal(1, result[0]);
          assert.equal(error1, result[1]);
          assert.equal(3, result[2]);
          assert.equal(error2, result[3]);
          finished();
          return true;
         });

     cont.fulfill(error2);
    },
  });

if (module === require.main) {
  require('async_testing').runSuites(exports);
}
