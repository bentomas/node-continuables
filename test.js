var continuable = require('./continuable');
var TestSuite = require('async_testing').TestSuite;

var async_function = function(val) {
  var cont = continuable.create();

  process.nextTick(function() {
      cont.fulfill(val);
    });

  return cont;
};


(new TestSuite('Continuables suite'))
  .runTests({
    "test simple": function(test) {
      async_function(true)
        (function(val) {
          test.assert.ok(val);
          test.finish();
        });
    },
    "test chain": function(test) {
      async_function(true)
        (function(val) {
          test.assert.ok(val);
          return false;
         });
        (function(val) {
          test.assert.ok(!val);
          test.finish();
         });
    },
    "test status parameter": function(test) {
      async_function(true)
        (function(val, succeeded) {
          test.assert.ok(succeeded);
          return new Error();
         });
        (function(val, succeeded) {
          test.assert.ok(!succeeded);
          test.finish();
         });
    },
  });

(new TestSuite('Groups suite'))
  .runTests({
    "test object": function(test) {
      continuable.group({
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
      continuable.group([
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
      continuable.group([
          async_function(1),
          function() { return 2; },
          3
        ])
        (function(result) {
          test.assert.deepEqual([1,2,3], result);
          test.finish();
         });
    },
  });
