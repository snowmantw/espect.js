var gulp = require('gulp');

gulp.task('test', require('./test/gulpfile.js')(gulp));
gulp.task('watch', ['test'], function () {
    gulp.watch('test/**/*.js', ['test']);
});
