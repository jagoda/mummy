"use strict";
var Browser = require("zombie");

before(function (done) {
	Browser.silent = true;
	done();
});
