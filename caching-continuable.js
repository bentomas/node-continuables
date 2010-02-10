//
//
// I'm not sure if the overhead of caching the results for other continuables
// is worth it. It's easy to do though!
//
//
exports.create = function() {
  var queue = [],
      queueIndex = 0;

  // I don't know if we want to save state, but it is easy to implement.
  // I am just worried about overhead
  var cachedValue = null;

  var continuable = function continuable(func) {
    queue.push(func);

    if( cachedValue !== null ) {
      fulfill(cachedValue);
    }

    return continuable;
  };

  continuable.isContinuable = true; // the one hack. so you can know if a returned
                                // value is itself another continuable

  var continuable.fulfill = function fulfill(val) {
    if( queueIndex < queue.length ) {
      // check the return type from the val
      if( val instanceof Error ) {
        var error = true;
      } 
      else {
        var error = false;
      }

      // in case this was a delayed response, set the cachedValue to null
      cachedValue = null;

      var returned = queue[queueIndex++](val, !error);
      if( typeof returned === 'function' && returned.isContinuable ) {
        // need to queue up our function in the continuable
        returned(function(val, succeeded) {
            continuable.fulfill(val);
          });
      }
      // should we make a check for Promises?
      else {
        continuable.fulfill(returned || val);
      }
    }
    else {
      cachedValue = val;
    }
  };

  return continuable;
};
