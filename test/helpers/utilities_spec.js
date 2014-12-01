"use strict";
var Browser   = require("zombie");
var Hapi      = require("hapi");
var Lab       = require("lab");
var Mummy     = require("../..");
var Utilities = require("./utilities");

var describe = Lab.describe;
var expect   = Lab.expect;
var it       = Lab.it;

describe("The helper utilities", function () {

	it("can create a pack of servers", function (done) {
		var pack = Utilities.createPack();

		expect(pack, "wrong type").to.be.an.instanceOf(Hapi.Server);
		expect(pack.connections, "incorrect number of servers").to.have.length(4);
		done();
	});

	it("can clear the loaded browser extensions", function (done) {
		Browser.extend(new Mummy(new Hapi.Server()));
		expect(Browser._extensions, "no extensions").not.to.have.length(0);
		Utilities.removeExtensions();
		expect(Browser._extensions, "found extensions").to.have.length(0);
		done();
	});
});
