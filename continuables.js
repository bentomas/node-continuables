var sys = require('sys'),
    events = require('events');

exports.create = function() {
  var queue = [],
      queueIndex = 0;

  function handleVal(val) {
    if( continuable.fulfill == arguments.callee ) {
      continuable.fulfill = function() {
        throw new Error('this continuable has already been fulfilled');
      }
    }

    if( exports.isContinuable(val) ) {
      // need to queue up our function in the continuable
      val(handleVal);
    }
    else if( val instanceof events.Promise ) {
      val.addCallback(handleVal);
      val.addErrback(handleVal);
    }
    else if( queueIndex < queue.length ) {
      var returned = queue[queueIndex++](val);
      handleVal(typeof returned === 'undefined' ? val : returned);
    }
    else if(val instanceof Error) {
        throw val;
      }
  };

  function continuable(callback) {
    queue.push(callback);
    return continuable;
  };
  continuable.isContinuable = true;
  continuable.fulfill = handleVal;

  return continuable;
};

exports.isContinuable = function(obj) {
  return !!(typeof obj === 'function' && obj.isContinuable && obj.fulfill);
};

exports.either = function(success, error) {
  return function(val) {
    if( val instanceof Error ) {
      return error(val);
    }
    else {
      return success(val);
    }
  }
}

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

      // in case a continuable returned an error we have to tell it not
      // to throw it
      return true;
    }
  };

  handlePieceResult(piece);
};

exports.group = function(obj) {
  var state = {
    numPieces: 0,
    numDone: 0,
    continuable: exports.create(),
    doneAdding: false,
  };

  if( obj instanceof Array ) {
    state.results = new Array(obj.length);
    for(var i = 0; i < obj.length; i++) {
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
    // this case only happens if everything added to the group is actually
    // synchronous, so they have all already finished
    // we have to do this in the nextTick so we can give people a chance to add
    // some callbacks
    process.nextTick(function() {
        groupCheckDone(state);
      });
  }

  return state.continuable;
};
