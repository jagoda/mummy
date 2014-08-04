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
	var annonymousHttp;
	var annonymousHttps;
	var defaultHost;
	var explicitHost;
	var explicitPort;
	var remoteRequest;
	var remoteResponse;

	before(function (done) {
		var pack = utilities.createPack();
		var browser;

		nock.disableNetConnect();
		remoteRequest = nock("http://google.com").get("/").reply(200, "google");

		Browser.extend(mummy(pack));
		browser = new Browser();

		browser.http({ method : "GET", url : "/" })
		.then(function (result) {
			defaultHost = result;
			return browser.http({ method : "GET", url : "http://example.com" });
		})
		.then(function (result) {
			explicitHost = result;
			return browser.http({ method : "GET", url : "http://localhost:42" });
		})
		.then(function (result) {
			explicitPort = result;
			return browser.http({ method : "GET", url : "http://localhost:80/" });
		})
		.then(function (result) {
			annonymousHttp = result;
			return browser.http({ method : "GET", url : "https://localhost/" });
		})
		.then(function (result) {
			annonymousHttps = result;
			return browser.http({ method : "GET", url : "http://google.com" });
		})
		.then(function (result) {
			remoteResponse = result;
		})
		.nodeify(done);
	});

	after(function (done) {
		utilities.removeExtensions();
		nock.cleanAll();
		nock.enableNetConnect();
		done();
	});

	it("uses the first pack server as the default site", function (done) {
		expect(defaultHost.statusCode, "status").to.equal(200);
		expect(defaultHost.payload, "payload").to.equal("server 0");
		done();
	});

	it("injects local requests based on hostname and port", function (done) {
		expect(explicitHost.statusCode, "explicit host status").to.equal(200);
		expect(explicitHost.payload, "explicit host payload").to.equal("server 0");

		expect(explicitPort.statusCode, "explicit port status").to.equal(200);
		expect(explicitPort.payload, "explicit port payload").to.equal("server 1");

		expect(annonymousHttp.statusCode, "http status").to.equal(200);
		expect(annonymousHttp.payload, "http payload").to.equal("server 2");

		expect(annonymousHttps.statusCode, "https status").to.equal(200);
		expect(annonymousHttps.payload, "https payload").to.equal("server 3");

		done();
	});

	it("does not inject remote requests", function (done) {
		expect(remoteRequest.isDone(), "no remote request").to.be.true;
		expect(remoteResponse.statusCode, "status").to.equal(200);
		expect(remoteResponse.payload, "payload").to.equal("google");
		done();
	});
});
