'use strict';

var advicesName = 'dummyadvices.esp.js'
var sourceName = 'dummybase.js';
var sourceDir = __dirname + '/../../sample/dummy/';
var advicesPath = sourceDir + advicesName;
var targetDir = require('os').tmpdir() + '/' + Date.now() + '/';
var targetFile = targetDir + sourceName;
var cliPath = __dirname + '/../../cli.js';
var cmdCompile = 'node ' + cliPath + ' ' + advicesPath + ' ' + targetFile;
var cmdApply = 'node ' + targetFile;
var fs = require('fs');
fs.mkdirSync(targetDir);
var createTest = function(done) {
  return function(e, se) {
    if (e) {
      throw e;
    }
    var content = se.split('\n');
    content.forEach(function(line) {
      if ('' === line) {
        return;
      }
      var matched = line.match(
        /(dummyadvice),(\d+),([\w.]+)#([\[\]\w.]+)@(\d+)/);
      // TODO: How to 'should' these?
      if (!matched) {
        throw new Error('No matched log: ' + line);
      } else {
        var tag = matched[1];
        var date = matched[2];
        var filename = matched[3];
        var idpath = matched[4];
        var ln = matched[5];
        if ('dummyadvice' !== tag) {
          throw new Error('No matched tag: ' + tag);
        }
        if(isNaN(date)) {
          throw new Error('Invalid date: ' + date);
        }
        if(sourceName !== filename) {
          throw new Error('Wrong file:' + filename);
        }
        if(!idpath) {
          throw new Error('No function id or path');
        } else {
          switch(idpath) {
            case '[]':
            case '[]':
            case '[a.b]':
            case '[a.b.c]':
            case 'd':
            case 'e':
            case 'f':
              break;
            default:
              throw new Error('Unexpected function id or path: ' + idpath);
          }
        }
        if (!ln) {
          throw new Error('Invalid line number: ' + ln);
        } else {
          switch(ln) {
            case '1':
            case '2':
            case '3':
            case '4':
            case '5':
            case '6':
            case '7':
              break;
            default:
              throw new Error('Unexpected line number: ' + ln);
          }
        }
      }
    }); // forEach.
    fs.unlinkSync(targetFile);
    fs.rmdirSync(targetDir);
    done();
  };
};

it('should execute the command and do integration test', function(done) {
  require('child_process').exec(cmdCompile,
  function (error) {
    if (error) {
      throw error;
    } else {
      require('child_process').exec(cmdApply, createTest(done));
    }
  });
});

