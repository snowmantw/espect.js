'use strict';

/**
 * It's just a controller to execute the commands from shell.
 * Don't write these in the shell script is because it may
 * grow up while the options become more complicated.
 */
(function() {
  var fs = require('fs');
  var path = require('path');
  var Espect = require(__dirname + '/espect.js');
  var minimist = require('minimist');
  var App = function() {};

  App.prototype.execute = function() {
    var args = minimist(process.argv.slice(2), { boolean: true });
    var advicepath = args._[0];
    var outputpath = args._[1];
    if (advicepath) {
      advicepath = path.resolve(advicepath);
    }
    if (outputpath) {
      outputpath = path.resolve(outputpath);
    }
    var advices = require(advicepath);
    var extractedargs = {
      'output': outputpath,
      'dry': !!args.dry,
      'silent': !!args.silent
    };
    var options = this.createOptions(extractedargs);
    var espect = new Espect(options);
    advices(espect);
  };

  /**
   * Extend this if it need to generate different options for advices.
   */
  App.prototype.createOptions = function(args) {
    var writer;
    if (args.dry && args.silent) {
      writer = this.createSilentWriter();
      return { 'writer': writer };
    }
    if (args.dry && !args.silent) {
      writer = this.createDryWriter();
      return { 'writer': writer };
    }
    if (args.output) {
      writer = this.createWriter(args.output);
      return { 'writer': writer };
    }
  };

  App.prototype.createWriter = function(outputpath) {
    return {
      write: function(adviced) {
        var code = adviced.code;
        fs.writeFile(outputpath, code);
      }
    };
  };

  App.prototype.createDryWriter = function() {
    return {
      write: function(adviced) {
        var code = adviced.code;
        console.log(code);
       }
    };
  };

  App.prototype.createSilentWriter = function() {
    return { write: function() {} };
  };
  module.exports = App;
})();

