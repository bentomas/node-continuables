var events = require('events');

exports.isContinuable = function(obj) {
  return !!(typeof obj === 'function' && obj.isContinuable && obj.fulfill);
};

exports.create = function() {
  var queue = [],
      queueIndex = 0,
      fulfilled = false;

  var handleVal = function handleVal(val, error) {
    if( exports.isContinuable(val) ) {
      // need to queue up our function in the continuable
      val(handleVal);
    }
    else if( val instanceof events.Promise ) {
      val.addCallback(handleVal);
      val.addErrback(function(error) { handleVal(undefined, error); });
    }
    else {
      if( (typeof error === 'undefined' || error === null) && val instanceof Error ) {
          error = val;
          val = undefined;
      }

      if( queueIndex < queue.length ) {
        var returned = queue[queueIndex++](val, error);
        if( typeof returned === 'undefined' || returned === null ) {
          handleVal(val, error);
        }
        else {
          handleVal(returned);
        }
      }
      else if(error) {
        throw val;
      }
    }
  };

  var continuable = function continuable(func) {
    queue.push(func);
    return continuable;
  };
  continuable.isContinuable = true;
  continuable.fulfill = function(val, error) {
    if( !fulfilled ) {
      fulfilled = true;
      handleVal(val, error);
    }
    else {
      throw new Error('this continuable has already been fulfilled');
    }
  };

  return continuable;
};

var groupCheckDone = function(state) {
  if( state.doneAdding && state.numPieces === state.numDone ) {
    state.continuable.fulfill(state.results);
  };
};
var groupAdd = function(state, piece, key) {
  state.numPieces++;

  var handlePieceResult = function(result) {
    if( exports.isContinuable(result) ) {
      result(handlePieceResult);
    }
    else if( result instanceof events.Promise ) {
      result.addCallback(handlePieceResult);
      result.addErrback(handlePieceResult);
    }
    else {
      state.results[key] = result;
      state.numDone++;
      groupCheckDone(state);
    }
  };

  handlePieceResult(piece);
};

exports.group = function(obj) {
  var state = {
    numPieces: 0,
    numDone: 0,
    continuable: exports.create(),
    doneAdding: false
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

  state.doneAdding = true;

  if( state.numPieces === state.numDone ) {
    // we have to do this in the nextTick so we can give people a chance to add
    // some callbacks
    // this case only happens if everything added to the group is actually
    // synchronous, so they have all already finished
    process.nextTick(function() {
        groupCheckDone(state);
      });
  }

  return state.continuable;
};
