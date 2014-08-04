"use strict";
var Browser   = require("zombie");
var Lab       = require("lab");
var mummy     = require("..");
var nock      = require("nock");
var utilities = require("./helpers/utilities");

var after    = Lab.after;
var before   = Lab.before;
var describe = Lab.describe;
var expect   = Lab.expect;
var it       = Lab.it;

describe("The HTTP API extension", function () {
	var browser;

	before(function (done) {
		var pack = utilities.createPack();

		nock.disableNetConnect();

		Browser.extend(mummy(pack));
		browser = new Browser();
		done();
	});

	after(function (done) {
		utilities.removeExtensions();
		nock.enableNetConnect();
		done();
	});

	it("uses the first pack server as the default site", function (done) {
		browser.http({ method : "GET", url : "/" })
		.then(function (response) {
			expect(response.statusCode, "status").to.equal(200);
			expect(response.payload, "payload").to.equal("server 0");
		})
		.nodeify(done);
	});

	it("injects local requests to an explicit hostname", function (done) {
		browser.http({ method : "GET", url : "http://example.com" })
		.then(function (response) {
			expect(response.statusCode, "status").to.equal(200);
			expect(response.payload, "payload").to.equal("server 0");
		})
		.nodeify(done);
	});

	it("injects local requests to an explicit port", function (done) {
		browser.http({ method : "GET", url : "http://localhost:42" })
		.then(function (response) {
			expect(response.statusCode, "status").to.equal(200);
			expect(response.payload, "payload").to.equal("server 1");
		})
		.nodeify(done);
	});

	it("uses port 80 as the default HTTP port", function (done) {
		browser.http({ method : "GET", url : "http://localhost/" })
		.then(function (response) {
			expect(response.statusCode, "status").to.equal(200);
			expect(response.payload, "payload").to.equal("server 2");
		})
		.nodeify(done);
	});

	it("uses port 443 as the default HTTPS port", function (done) {
		browser.http({ method : "GET", url : "https://localhost/" })
		.then(function (response) {
			expect(response.statusCode, "https status").to.equal(200);
			expect(response.payload, "https payload").to.equal("server 3");
		})
		.nodeify(done);
	});

	it("does not inject remote requests", function (done) {
		var request = nock("http://google.com").get("/").reply(200, "google");

		browser.http({ method : "GET", url : "http://google.com" })
		.then(function (response) {
			expect(request.isDone(), "no remote request").to.be.true;
			expect(response.statusCode, "status").to.equal(200);
			expect(response.payload, "payload").to.equal("google");
		})
		.fin(function () {
			nock.cleanAll();
		})
		.nodeify(done);
	});
});
