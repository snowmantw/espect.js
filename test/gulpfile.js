var gulp = require('gulp');
var mocha = require('gulp-mocha');

module.exports = function (gulp) {
  return function () {
    var paths = [__dirname + '/unit/**/*.js',
                __dirname + '/integration/**/*.js'];
    return gulp.src(paths, {read: false})
        .pipe(mocha({reporter: 'nyan'}));
  };
};

