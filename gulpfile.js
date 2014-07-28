"use strict";
var fs      = require("fs");
var gulp    = require("gulp");
var jshint  = require("gulp-jshint");
var lab     = require("gulp-lab");
var path    = require("path");
var stylish = require("jshint-stylish");
var _       = require("lodash");

var JSHINTRC     = ".jshintrc";
var SOURCE_FILES = [ "*.js", "lib/**/*.js" ];
var TEST_FILES   = [ "test/**/*_spec.js" ];

function runJshint (files, overrides) {
	var options = JSON.parse(fs.readFileSync(path.join(__dirname, JSHINTRC)));

	if (overrides) {
		options = _.merge(options, JSON.parse(fs.readFileSync(overrides)));
	}

	return gulp.src(files)
	.pipe(jshint(options))
	.pipe(jshint.reporter(stylish))
	.pipe(jshint.reporter("fail"));
}

gulp.task("coverage", function () {
	return gulp.src(TEST_FILES)
	.pipe(lab("-p -r html -o coverage.html"));
});

gulp.task("default", [ "test" ]);

gulp.task("lint", [ "lint-src", "lint-test" ]);

gulp.task("lint-src", function () {
	return runJshint(SOURCE_FILES);
});

gulp.task("lint-test", function () {
	return runJshint(TEST_FILES, path.join(__dirname, "test", JSHINTRC));
});

gulp.task("test", [ "lint" ], function () {
	return gulp.src(TEST_FILES)
	.pipe(lab({
		args : "-p -t 100",
		opts : {
			emitLabError : true
		}
	}));
});

// This is useful for CI systems.
gulp.on("err", function (error) {
	console.error("%s: %s", error.message, error.err.message);
	console.error(error.err.stack);
	process.exit(1);
});
