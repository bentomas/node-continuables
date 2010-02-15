var sys = require('sys');
var events = require('events');

exports.isContinuable = function(obj) {
  return !!(typeof obj === 'function' && obj.isContinuable && obj.fulfill);
};

exports.create = function() {
  var queue = [],
      queueIndex = 0,
      fulfilled = false;

  var handleVal = function handleVal(val, success) {
    if( exports.isContinuable(val) ) {
      // need to queue up our function in the continuable
      val(handleVal);
    }
    else if( val instanceof events.Promise ) {
      val.addCallback(handleVal);
      val.addErrback(function(error) { handleVal(error, false); });
    }
    else {
      if( typeof success === 'undefined' || success === null ) {
          if( val instanceof Error ) {
            success = false;
          }
          else {
            success = true;
          }
      }

      if( queueIndex < queue.length ) {
        var func = queue[queueIndex+(success ? 0 : 1)];
        queueIndex += 2;
        if( !func ) {
          return handleVal(val, success);
        }
        var returned = func(val, success);
        if( typeof returned === 'undefined' || returned === null ) {
          handleVal(val, success);
        }
        else {
          handleVal(returned);
        }
      }
      else if(!success) {
        throw val;
      }
    }
  };

  var continuable = function continuable(success, failure) {
    if( typeof failure === 'undefined' ) {
      failure = success;
    }
    queue.push(success);
    queue.push(failure);
    return continuable;
  };
  continuable.isContinuable = true;
  continuable.fulfill = function(val, success) {
    if( !fulfilled ) {
      fulfilled = true;
      handleVal(val, success);
    }
    else {
      throw new Error('this continuable has already been fulfilled');
    }
  };

  return continuable;
};

var groupCheckDone = function(state) {
  if( state.doneAdding && state.numPieces === state.numDone ) {
    state.continuable.fulfill(state.results, !state.error);
  };
};
var groupAdd = function(state, piece, key) {
  state.numPieces++;

  var handlePieceResult = function(result, successful) {
    if( exports.isContinuable(result) ) {
      result(handlePieceResult);
    }
    else if( result instanceof events.Promise ) {
      result.addCallback(handlePieceResult);
      result.addErrback(function(error) { handlePieceResult(error, false); });
    }
    else {
      if(typeof successful === 'undefined') {
        if( result instanceof Error ) {
          state.error = true;
        }
      }
      else if(successful === false) {
        state.error = true;
      }

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
    error: false
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
