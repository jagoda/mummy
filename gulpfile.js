"use strict";
var CoverageEnforcer = require("gulp-istanbul-enforcer");
var FS               = require("fs");
var Gulp             = require("gulp");
var Istanbul         = require("gulp-istanbul");
var Jshint           = require("gulp-jshint");
var Mocha            = require("gulp-mocha");
var Path             = require("path");
var Stylish          = require("jshint-stylish");

var consume = require("stream-consume");
var _       = require("lodash");

var files = {
	jshintrc : ".jshintrc",
	source   : [ "*.js", "lib/**/*.js" ],
	test     : [ "test/helpers/*.js", "test/**/*_spec.js" ]
};

function runJshint (sourceFiles, overrides) {
	var options = JSON.parse(FS.readFileSync(Path.join(__dirname, files.jshintrc)));

	if (overrides) {
		options = _.merge(options, JSON.parse(FS.readFileSync(overrides)));
	}

	return Gulp.src(sourceFiles)
	.pipe(new Jshint(options))
	.pipe(Jshint.reporter(Stylish))
	.pipe(Jshint.reporter("fail"));
}

Gulp.task("coverage", [ "test" ], function () {
	var options = {
		coverageDirectory : "coverage",
		rootDirectory     : __dirname,

		thresholds : {
			branches   : 100,
			functions  : 100,
			lines      : 100,
			statements : 100
		}
	};

	return Gulp.src(".").pipe(new CoverageEnforcer(options));
});

Gulp.task("default", [ "coverage" ]);

Gulp.task("lint", [ "lint-src", "lint-test" ]);

Gulp.task("lint-src", function () {
	return runJshint(files.source);
});

Gulp.task("lint-test", function () {
	return runJshint(files.test, Path.join(__dirname, "test", files.jshintrc));
});

Gulp.task("test", [ "lint" ], function (done) {
	var stream = Gulp.src(files.source)
	.pipe(new Istanbul())
	.pipe(Istanbul.hookRequire())
	.on("finish", function () {
		var stream = Gulp.src(files.test)
		.pipe(new Mocha())
		.pipe(Istanbul.writeReports())
		.on("end", done);

		consume(stream);
	});

	consume(stream);
});

// This is useful for CI systems.
Gulp.on("err", function (error) {
	console.error("%s: %s", error.message, error.err.message);
	console.error(error.err.stack);
	process.exit(1);
});
