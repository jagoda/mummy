"use strict";
var Browser   = require("zombie");
var Hapi      = require("hapi");
var Lab       = require("lab");
var mummy     = require("..");
var nock      = require("nock");
var Q         = require("q");
var sinon     = require("sinon");
var utilities = require("./helpers/utilities");

var after    = Lab.after;
var before   = Lab.before;
var describe = Lab.describe;
var expect   = Lab.expect;
var it       = Lab.it;

describe("The HTTP API extension", function () {

	describe("making requests", function () {
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

		it("defaults to the GET method", function (done) {
			var request = nock("http://google.com").get("/").reply(200, "google");

			Q.all([
				browser.http({ url : "/" }),
				browser.http({ url : "http://google.com" })
			])
			.spread(function (local, remote) {
				expect(local.statusCode, "local status").to.equal(200);
				expect(local.payload, "local payload").to.equal("server 0");

				expect(request.isDone(), "no remote request").to.be.true;
				expect(remote.statusCode, "remote status").to.equal(200);
				expect(remote.payload, "remote payload").to.equal("google");
			})
			.fin(function () {
				nock.cleanAll();
			})
			.nodeify(done);
		});

		it("defaults to the root path", function (done) {
			browser.http({ method : "GET" })
			.then(function (response) {
				expect(response.statusCode, "status").to.equal(200);
				expect(response.payload, "payload").to.equal("server 0");
			})
			.nodeify(done);
		});
	});

	describe("simulating pack start-up", function () {
		var loaded;
		var request;
		var started;

		before(function (done) {
			var server = new Hapi.Server();
			var browser;

			// Anonymous functions cause function names to be used for test
			// output.
			loaded  = sinon.spy(function loaded () {});
			request = sinon.spy(function request () {});
			started = sinon.spy(function started () {});
			browser = mummy.embalm(server, new Browser());

			server.pack.events.once("start", started);

			Q.ninvoke(server.pack, "register", [
				{
					name     : "plugin1",
					register : function (plugin, options, done) {
						done();
					}
				},
				{
					name     : "plugin2",
					register : function (plugin, options, done) {
						plugin.dependency("plugin1", function (plugin, done) {
							loaded();
							done();
						});
						done();
					}
				}
			])
			.then(function () {
				var deferred = Q.defer();

				browser.http({}, function () {
					request();
					deferred.resolve();
				});

				return deferred.promise;
			})
			.nodeify(done);
		});

		it("starts the pack before processing requests", function (done) {
			sinon.assert.callOrder(loaded, started, request);
			done();
		});
	});
});
