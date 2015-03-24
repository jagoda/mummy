"use strict";
var Bluebird  = require("bluebird");
var Browser   = require("zombie");
var Hapi      = require("hapi");
var Mummy     = require("..");
var Nock      = require("nock");
var Sinon     = require("sinon");
var Utilities = require("./helpers/utilities");

var expect = require("chai").expect;

describe("The HTTP API extension", function () {
	describe("making requests", function () {
		var browser;

		before(function (done) {
			var server = Utilities.createServer();

			Nock.disableNetConnect();

			Browser.extend(new Mummy(server));
			browser = new Browser();
			done();
		});

		after(function (done) {
			Utilities.removeExtensions();
			Nock.enableNetConnect();
			done();
		});

		it("uses the first server connection as the default site", function (done) {
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
			var request = new Nock("http://google.com").get("/").reply(200, "google");

			browser.http({ method : "GET", url : "http://google.com" })
			.then(function (response) {
				expect(request.isDone(), "no remote request").to.be.true;
				expect(response.statusCode, "status").to.equal(200);
				expect(response.payload, "payload").to.equal("google");
			})
			.finally(function () {
				Nock.cleanAll();
			})
			.nodeify(done);
		});

		it("defaults to the GET method", function (done) {
			var request = new Nock("http://google.com").get("/").reply(200, "google");

			Bluebird.join(
				browser.http({ url : "/" }),
				browser.http({ url : "http://google.com" }),
				function (local, remote) {
					expect(local.statusCode, "local status").to.equal(200);
					expect(local.payload, "local payload").to.equal("server 0");

					expect(request.isDone(), "no remote request").to.be.true;
					expect(remote.statusCode, "remote status").to.equal(200);
					expect(remote.payload, "remote payload").to.equal("google");
				}
			)
			.finally(function () {
				Nock.cleanAll();
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

	describe("on an authenticated browser", function () {
		var response;

		before(function (done) {
			var browser = new Browser();
			var server  = new Hapi.Server();

			server.connection();

			server.route({
				method : "GET",
				path   : "/",

				handler : function (request, reply) {
					reply(request.headers);
				}
			});

			Nock.disableNetConnect();

			browser = Mummy.embalm(server, browser);
			browser.on("authenticate", function (authentication) {
				authentication.username = "user";
				authentication.password = "pass";
			});

			browser.http({})
			.then(function (_response_) {
				response = _response_;
			})
			.nodeify(done);
		});

		after(function (done) {
			Nock.enableNetConnect();
			done();
		});

		it("includes an 'Authorization' header on the request", function (done) {
			expect(response.result, "header").to.have.property("authorization");
			done();
		});

		it("includes an authorization scheme", function (done) {
			expect(response.result.authorization.split(" ")[0], "scheme").to.equal("Basic");
			done();
		});

		it("includes the credentials with requests", function (done) {
			var decoded = response.result.authorization.split(" ")[1];

			decoded = (new Buffer(decoded, "base64")).toString("utf8");
			expect(decoded, "payload").to.equal("user:pass");
			done();
		});
	});

	describe("with custom credentials", function () {
		var credentials = { id : "test" };

		var browser;

		before(function (done) {
			var server  = new Hapi.Server();

			server.connection();

			server.route({
				method : "GET",
				path   : "/",

				handler : function (request, reply) {
					reply(request.auth.credentials);
				}
			});

			browser = new Browser();
			Mummy.embalm(server, browser);

			browser.credentials.set(credentials);
			done();
		});

		describe("performing a request", function () {
			var result;

			before(function (done) {
				browser.http({
					method : "GET",
					url    : "/"
				})
				.then(function (response) {
					result = JSON.parse(response.payload);
				})
				.nodeify(done);
			});

			it("puts the credentials in the request", function (done) {
				expect(result, "credentials").to.deep.equal(credentials);
				done();
			});

			describe("then clearing the credentials", function () {
				before(function (done) {
					browser.credentials.clear();
					done();
				});

				describe("and performing a request", function () {
					var result;

					before(function (done) {
						browser.http({
							method : "GET",
							path   : "/"
						})
						.then(function (response) {
							result = response.payload;
						})
						.nodeify(done);
					});

					it("does not put the credentials in the request", function (done) {
						expect(result, "credentials").to.equal("");
						done();
					});
				});
			});
		});
	});

	describe("simulating server start-up", function () {
		var loaded;
		var request;
		var started;

		before(function (done) {
			var server = new Hapi.Server();
			var browser;

			var plugin1 = function (plugin, options, done) {
				done();
			};

			var plugin2 = function (plugin, options, done) {
				plugin.dependency("plugin1", function (plugin, done) {
					loaded();
					done();
				});
				done();
			};

			plugin1.attributes = {
				name : "plugin1"
			};

			plugin2.attributes = {
				name : "plugin2"
			};

			server.connection();

			// Anonymous functions cause function names to be used for test
			// output.
			loaded  = Sinon.spy(function loaded () {});
			request = Sinon.spy(function request () {});
			started = Sinon.spy(function started () {});
			browser = Mummy.embalm(server, new Browser());

			server.once("start", started);

			Bluebird.fromNode(function (callback) {
				server.register(
					[
						{
							register : plugin1
						},
						{
							register : plugin2
						}
					],
					callback
				);
			})
			.then(function () {
				return new Bluebird(function (resolve) {
					browser.http({}, function () {
						request();
						resolve();
					});
				});
			})
			.nodeify(done);
		});

		it("starts the server before processing requests", function (done) {
			Sinon.assert.callOrder(loaded, started, request);
			done();
		});
	});
});
