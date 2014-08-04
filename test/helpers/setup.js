"use strict";
var Browser = require("zombie");
var Lab     = require("lab");

var before = Lab.before;

before(function (done) {
	Browser.default.silent = true;
	done();
});
