"use strict";
var FS      = require("fs");
var Gulp    = require("gulp");
var Jshint  = require("gulp-jshint");
var Lab     = require("gulp-lab");
var Path    = require("path");
var Stylish = require("jshint-stylish");
var _       = require("lodash");

var JSHINTRC     = ".jshintrc";
var SOURCE_FILES = [ "*.js", "lib/**/*.js" ];
var TEST_FILES   = [ "test/helpers/*.js", "test/**/*_spec.js" ];

function runJshint (files, overrides) {
	var options = JSON.parse(FS.readFileSync(Path.join(__dirname, JSHINTRC)));

	if (overrides) {
		options = _.merge(options, JSON.parse(FS.readFileSync(overrides)));
	}

	return Gulp.src(files)
	.pipe(new Jshint(options))
	.pipe(Jshint.reporter(Stylish))
	.pipe(Jshint.reporter("fail"));
}

Gulp.task("coverage", function () {
	return Gulp.src(TEST_FILES)
	.pipe(new Lab("-p -r html -o coverage.html"));
});

Gulp.task("default", [ "test" ]);

Gulp.task("lint", [ "lint-src", "lint-test" ]);

Gulp.task("lint-src", function () {
	return runJshint(SOURCE_FILES);
});

Gulp.task("lint-test", function () {
	return runJshint(TEST_FILES, Path.join(__dirname, "test", JSHINTRC));
});

Gulp.task("test", [ "lint" ], function () {
	return Gulp.src(TEST_FILES)
	.pipe(new Lab({
		args : "-v -t 100",
		opts : {
			emitLabError : true
		}
	}));
});

// This is useful for CI systems.
Gulp.on("err", function (error) {
	console.error("%s: %s", error.message, error.err.message);
	console.error(error.err.stack);
	process.exit(1);
});
