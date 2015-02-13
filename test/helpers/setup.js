"use strict";
var Browser = require("zombie");

before(function (done) {
	Browser.default.silent = true;
	done();
});
