'use strict';

module.exports = function(espect) {
  espect
    .select(__dirname + '/dummybase.js *')
    .before(function(context) {
        var id = context.meta.id;
        var paths = context.meta.paths;
        // XXX: To assign a result variable to prevent return
        // be splited by comments, which now suffers from the incorrect loc.
        var strpaths = paths.map(function(path) {
          var merged = path.join('.'); return merged; });
        var file = context.meta.file;
        var filepath = file.replace(/\\/g,'/').replace( /.*\//, '' );
        var loc = context.meta.loc;
        // TODO: LOC is incorrect...
        console.log('dummyadvice,' + Date.now() + ',' +
          filepath + '#' + (id ? id : ('[' + strpaths.join(',') + ']')) +
          '@' + loc.start.line);
    })
    .done()
  .done();
};
