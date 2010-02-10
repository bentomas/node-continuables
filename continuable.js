exports.isContinuable = function(obj) {
  return !!(typeof obj === 'function' && obj.isContinuable && obj.fulfill);
};

// TODO Allow Node events.Promise objects as well as continuables for async code

exports.create = function() {
  var queue = [],
      queueIndex = 0;

  var continuable = function continuable(func) {
    queue.push(func);

    return continuable;
  };

  continuable.isContinuable = true;

  continuable.fulfill = function fulfill(val) {
    if( queueIndex < queue.length ) {
      // check the return type from the val
      if( val instanceof Error ) {
        var error = true;
      } 
      else {
        var error = false;
      }

      var returned = queue[queueIndex++](val, !error);
      if( exports.isContinuable(returned) ) {
        // need to queue up our function in the continuable
        returned(function(val, succeeded) {
            continuable.fulfill(val);
          });
      }
      else {
        continuable.fulfill(returned || val);
      }
    }
  };

  return continuable;
};

var groupCheckDone = function(state) {
  if( state.numPieces === state.numDone ) {
    state.continuable.fulfill(state.results);
  };
};
var groupAdd = function(state, piece, key) {
  state.numPieces++;

  if( exports.isContinuable(piece) ) {
    piece(function(r) {
        state.results[key] = r;
        state.numDone++;
        groupCheckDone(state);
      });
  }
  else if( typeof piece === 'function' ) { // it's a function
    process.nextTick(function() {
        state.results[key] = piece();
        state.numDone++;
        groupCheckDone(state);
      });
  }
  else { // it's just a regular old object
    state.results[key] = piece;
    state.numDone++;
    groupCheckDone(state);
  }
};

exports.group = function(obj) {
  var state = {
    numPieces: 0,
    numDone: 0,
    continuable: exports.create()
  };

  if( obj instanceof Array ) {
    state.results = [];
    for(var i = 0; i < obj.length; i++) {
      state.results.push(null);
      groupAdd(state, obj[i], i);
    }
  }
  else {
    state.results = {};
    for( var key in obj ) {
      groupAdd(state, obj[key], key);
    }
  }

  return state.continuable;
};
