var sys = require('sys');
var events = require('events');

exports.create = function() {
  var queue = [],
      queueIndex = 0,
      fulfilled = false;

  function handleVal(val, success) {
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
        var returned = queue[queueIndex++](success, val);
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

  function continuable(callback) {
    queue.push(callback);
    return continuable;
  };
  continuable.isContinuable = true;
  continuable.emitSuccess = function(val) {
    if( !fulfilled ) {
      fulfilled = true;
      handleVal(val, true);
    }
    else {
      throw new Error('this continuable has already been fulfilled');
    }
  };
  continuable.emitError = function(val) {
    if( !fulfilled ) {
      fulfilled = true;
      handleVal(val, false);
    }
    else {
      throw new Error('this continuable has already been fulfilled');
    }
  };

  return continuable;
};

exports.isContinuable = function(obj) {
  return !!(typeof obj === 'function' && obj.isContinuable && obj.emitSuccess && obj.emitError);
};

exports.either = function(success, error) {
  return function(successful, val) {
    if( successful ) {
      return success(val);
    }
    else {
      return error(val);
    }
  }
}

var groupCheckDone = function(state) {
  if( state.doneAdding && state.numPieces === state.numDone ) {
    if(state.error) {
      state.continuable.emitError(state.results);
    }
    else {
      state.continuable.emitSuccess(state.results);
    }
  };
};
var groupAdd = function(state, piece, key) {
  state.numPieces++;

  var handlePieceResult = function(successful, result) {
    if( exports.isContinuable(result) ) {
      result(handlePieceResult);
    }
    else if( result instanceof events.Promise ) {
      result.addCallback(function(result) { handlePieceResult(true, result); });
      result.addErrback(function(error) { handlePieceResult(false, error); });
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

  handlePieceResult( piece instanceof Error ? false : true, piece);
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
