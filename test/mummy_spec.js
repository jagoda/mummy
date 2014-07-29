"use strict";
var Browser = require("zombie");
var Hapi    = require("hapi");
var Lab     = require("lab");
var mummy   = require("..");
var path    = require("path");
var sinon   = require("sinon");
var _       = require("lodash");

var after    = Lab.after;
var before   = Lab.before;
var describe = Lab.describe;
var expect   = Lab.expect;
var it       = Lab.it;

describe("mummy", function () {

	describe("wrapping a Hapi server", function () {
		var browser;
		var server;

		before(function (done) {
			server = new Hapi.Server();

			server.route({
				method : "GET",
				path   : "/",

				handler : { file : path.join(__dirname, "fixtures", "test.html") }
			});

			browser = new Browser();
			mummy.embalm(server, browser);

			browser.visit("/", done);
		});

		it("injects requests", function (done) {
			expect(browser.text("title"), "wrong title").to.equal("test page");
			done();
		});
	});

	describe("loaded as a browser extension", function () {
		var embalm;
		var server;

		before(function (done) {
			embalm = sinon.stub(mummy, "embalm");
			server = new Hapi.Server();

			Browser.extend(mummy(server));
			done();
		});

		after(function (done) {
			embalm.restore();
			// Zombie does not expose a clean way to clear extensions.
			Browser._extensions = _.without(Browser._extensions, mummy);
			done();
		});

		it("embalms all new browsers", function (done) {
			var browser = new Browser();

			expect(embalm.callCount, "not embalmed").to.equal(1);
			expect(embalm.calledWith(server, browser), "wrong arguments").to.be.true;
			done();
		});
	});
});
