"use strict";
var Lab   = require("lab");
var Mummy = require("..");

var describe = Lab.describe;
var expect   = Lab.expect;
var it       = Lab.it;

describe("mummy", function () {
	it("does some stuff", function (done) {
		var mummy = new Mummy();

		expect(mummy).to.be.ok;
		done();
	});
});
