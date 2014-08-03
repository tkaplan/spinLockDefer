var Spin = require('./index.js'),
	spin;

describe("Redis", function() {
	before(function(done) {
    spin = new Spin();
    done();
	});

	it("should set", function(done) {
    spin({keys:['a','b','c','d','e','f']}).then(
      function(value) {
        console.log('releasing lock 1');
        value();
        //done();
      },
      function(reason) {
        //done();
      }
    );

    spin({keys:['b','c','d','e','f','g']}).then(
      function(value) {
        console.log('releasing lock 2');
        value();
        //done();
      },
      function(reason) {
        //done();
      }
    );

    spin({keys:['b','c','d','n']}).then(
      function(value) {
        console.log('releasing lock 3');
        value();
        //done();
      },
      function(reason) {
        //done();
      }
    );

    spin({keys:['t','g']}).then(
      function(value) {
        console.log('releasing lock 4');
        value();
        //done();
      },
      function(reason) {
        //done();
      }
    );

    spin({keys:['z','x','y']}).then(
      function(value) {
        console.log('releasing lock 5');
        value();
        //done();
      },
      function(reason) {
        //done();
      }
    );
	});
});