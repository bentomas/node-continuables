var sys = require('sys'),
    events = require('events');

exports.isContinuable = function(obj) {
  return !!(typeof obj === 'function' && obj.isContinuable && obj.fulfill);
};

// TODO Allow Node events.Promise objects as well as continuables for async code

exports.create = function() {
  var queue = [],
      queueIndex = 0,
      lastValError = false;

  var continuable = function continuable(func) {
    queue.push(func);

    return continuable;
  };

  continuable.isContinuable = true;

  continuable.fulfill = function fulfill(val) {
    if( exports.isContinuable(val) ) {
      // need to queue up our function in the continuable
      val(continuable.fulfill);
    }
    else if( val instanceof events.Promise ) {
      val.addCallback(continuable.fulfill);
      val.addErrback(continuable.fulfill);
    }
    else {
      if( queueIndex < queue.length ) {
        // check the return type from the val
        if( val instanceof Error ) {
          var error = true;
        } 
        else {
          var error = false;
        }

        var returned = queue[queueIndex++](val, !error);
        continuable.fulfill(typeof returned === 'undefined' || returned === null ? val : returned);
      }
      else {
        if( val instanceof Error ) {
          throw val;
        }
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
