"use strict";
var Browser = require("zombie");
var Hapi    = require("hapi");
var nock    = require("nock");
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

	before(function (done) {
		nock.disableNetConnect();
		done();
	});

	after(function (done) {
		nock.enableNetConnect();
		done();
	});

	describe("wrapping a Hapi server", function () {
		var localText;
		var remoteRequest;
		var remoteText;
		var server;

		before(function (done) {
			var browser;

			server = new Hapi.Server();

			server.route({
				method : "GET",
				path   : "/",

				handler : { file : path.join(__dirname, "fixtures", "test.html") }
			});

			remoteRequest = nock("http://example.com")
			.get("/")
			.reply(200, "boo!");

			browser = new Browser();
			mummy.embalm(server, browser);

			browser.visit("/")
			.then(function () {
				localText = browser.text("title");
				return browser.visit("http://example.com");
			})
			.then(function () {
				remoteText = browser.text("body");
			})
			.nodeify(done);
		});

		after(function (done) {
			nock.cleanAll();
			done();
		});

		it("injects local requests", function (done) {
			expect(localText, "wrong title").to.equal("test page");
			done();
		});

		it("does not inject remote requests", function (done) {
			expect(remoteRequest.isDone(), "no remote request").to.be.true;
			expect(remoteText, "wrong body").to.equal("boo!");
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
