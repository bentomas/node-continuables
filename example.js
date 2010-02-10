var continuable = require('./continuable'),
    sys = require('sys');

var async_function = function(val) {
  var cont = continuable.create();

  process.nextTick(function() {
      cont.fulfill(val);
    });

  return cont;
};

function loadConfig(startVal) {
  return async_function(startVal) // uses what you pass in to load config so you can 
    (function(val, succeeded) {
      return succeeded ? val : async_function('{"hello": "world"}');
    })
    (function(val, succeeded) {
      return succeeded ? JSON.parse(val) : val;
    });
};

loadConfig(new Error())( function(obj, succeeded) { sys.p(obj) } );
loadConfig('{"hi":"there"}')( function(obj, succeeded) { sys.p(obj) } );
