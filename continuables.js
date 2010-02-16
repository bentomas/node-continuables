var sys = require('sys');
var events = require('events');

exports.create = function() {
  var queue = [],
      queueIndex = 0,
      fulfilled = false;

  function handleVal(val) {
    // this is a little bit of a hack.  basically if handleVal is called with 
    // 2 arguments, it is as the callback to another continuable or promise
    // we flip the order of the arguments, so we can run the returned object
    // against our tests (for continuables and Promises)
    if( arguments.length === 2 ) {
      var success = val;
      val = arguments[1];
    }

    if( exports.isContinuable(val) ) {
      // need to queue up our function in the continuable
      val(handleVal);
    }
    else if( val instanceof events.Promise ) {
      val.addCallback(function(result) { handleVal(true, result); });
      val.addErrback(function(error) { handleVal(false, error); });
    }
    else {
      // handleVal was processed as the callback to a continuable or Promise.
      // if it got here, then it wasn't an asynchronous response, so we convert
      // the arguments to an array [successBoolean, value] that we pass to the 
      // next callback in the chain
      if( arguments.length === 2 ) {
        val = [success, arguments[1]];
      }
      else if( val.constructor != Array ) {
        throw "Callbacks to continuables must return an array";
      }

      if( queueIndex < queue.length ) {
        var returned = queue[queueIndex++].apply(null, val);
        if( typeof returned === 'undefined' || returned === null ) {
          handleVal(val);
        }
        else {
          handleVal(returned);
        }
      }
      else if(!val[0]) {
        throw val[1];
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
      handleVal([true, val]);
    }
    else {
      throw new Error('this continuable has already been fulfilled');
    }
  };
  continuable.emitError = function(val) {
    if( !fulfilled ) {
      fulfilled = true;
      handleVal([false, val]);
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
      return [true];
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
