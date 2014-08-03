'use strict';

var redis = require('redis'),
    _ = require('lodash'),
    Q = require('q');

module.exports = function(config) {
  var client = redis.createClient(config);

  /**
   * params {
   * timeout (ms): #,
   * waitBetweenRetries: #,
   * allowedAttempts: #,
   * keys: [],
   **/
  return function(params) {
    var startTime = (new Date()).getTime(),
        attempts = 0,
        multi = [];

    params.expire = params.expire ? params.expire : 15;
    params.waitBetweenRetries = params.waitBetweenRetries ? params.waitBetweenRetries : 100;

    if(!(params.keys instanceof Array))
      throw new Error('Keys must be an array');

    for(var i = 0; i < params.keys.length; i++) {
      multi.push([
        'SET',
        params.keys[i],
        '1',
        'EX',
        params.expire,
        'NX'
      ]);
    }

    return Q.Promise(function(resolve, reject, notify) {
      function loop() {
        client.multi(multi)
        .exec(function(err, replies) {
          if(err) {
            if(stopCondition()) {
              reject(new Error('Allowed attempts or timeout reached.'));
            } else {
              attempts ++;
              // ms to wait between retries
              setTimeout(loop, params.waitBetweenRetries);
            }
          } else {

              // If we did not acquire all the keys then
              // we must release partially obtained keys
              if(_.contains(replies,null)) {

                // We want to unset our keys since there
                // isn't a way for us to use them. We cannot
                // complete our transaction without having
                // all the keys.
                unsetKeys(parseKeysToDelete(replies)).then(
                  function() {
                    
                    // Retry getting all the necessary locks
                    attempts ++;
                    setTimeout(loop, params.waitBetweenRetries);
                  },
                  function(reason) {
                    reject(reason);
                  }
                );
              } else {

                // When we are successful at acquiring the lock
                // the program using the spin lock will be responsible
                // for releasing the lock. They must call the function
                // bellow to release those keys.
                resolve(function() {
                  // Unset the keys we don't need anymore
                  return unsetKeys(parseKeysToDelete(replies));
                });
              }
          }
        });
      }

      function unsetKeys(unset) {
        return Q.Promise(function(_resolve, _reject, _notify) {
          client.multi(unset)
          .exec(function(err, replies) {
            if(err) {
              if(stopCondition()) {
                _reject(new Error('Allowed attempts or timeout reached.'));
              } else {
                // We failed, so we must retry getting
                // those keys
                unsetKeys(unset);
              }
            } else {
              // We succeeded in unlocking our keys
              _resolve();
            }
          });
        });
      }

      function parseKeysToDelete(replies) {
        // Delete whatever keys cause issues
        var i = 0,
            key,
            unset = [];
        _.forEach(replies, function(reply) {
          if(reply) {
            unset.push(['DEL', multi[i][1]]);
          }
          i ++;
        });
        return unset;
      }

      function stopCondition() {
        return (params.timeout && (new Date).getTime - startTime > params.timeout) ||
               (params.allowedAttempts && params.allowedAttempts < attempts);
      }

      loop();
    });
  };
}