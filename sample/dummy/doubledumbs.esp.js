'use strict';

module.exports = function(espect) {
  espect
    .select(__dirname + '/dummybase.js a.b.c')
    .before(function(context) {
      console.log('the first dumb');
    })
    .done()
    .select(__dirname + '/dummybase.js a.b')
    .before(function(context) {
      console.log('the second dumb');
    })
    .done()
  .done();
};
