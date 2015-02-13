"use strict";
var Bluebird  = require("bluebird");
var Browser   = require("zombie");
var Hapi      = require("hapi");
var Nock      = require("nock");
var Mummy     = require("..");
var Path      = require("path");
var Sinon     = require("sinon");
var Utilities = require("./helpers/utilities");

var expect = require("chai").expect;

describe("mummy", function () {
	before(function () {
		Nock.disableNetConnect();
	});

	after(function () {
		Nock.enableNetConnect();
	});

	describe("wrapping a Hapi server", function () {
		var browser;
		var localText;
		var remoteRequest;
		var remoteText;
		var server;

		before(function () {
			server = new Hapi.Server();

			server.connection();

			server.route({
				method : "GET",
				path   : "/",

				handler : { file : Path.join(__dirname, "fixtures", "test.html") }
			});

			remoteRequest = new Nock("http://example.com")
			.get("/")
			.reply(200, "boo!");

			browser = new Browser();
			Mummy.embalm(server, browser);

			return browser.visit("/")
			.then(function () {
				localText = browser.text("title");
				return browser.visit("http://example.com");
			})
			.then(function () {
				remoteText = browser.text("body");
			});
		});

		after(function () {
			Nock.cleanAll();
		});

		it("injects local requests", function () {
			expect(localText, "wrong title").to.equal("test page");
		});

		it("does not inject remote requests", function () {
			expect(remoteRequest.isDone(), "no remote request").to.be.true;
			expect(remoteText, "wrong body").to.equal("boo!");
		});

		it("exposes the server on the browser object", function () {
			expect(browser, "server").to.have.property("server", server);
		});

		describe("visiting with a callback", function () {
			it("succeeds", function (done) {
				browser.visit("/", done);
			});
		});
	});

	describe("loaded as a browser extension", function () {
		var embalm;
		var server;

		before(function () {
			embalm = Sinon.stub(Mummy, "embalm");
			server = new Hapi.Server();

			Browser.extend(new Mummy(server));
		});

		after(function () {
			embalm.restore();
			Utilities.removeExtensions();
		});

		it("embalms all new browsers", function () {
			var browser = new Browser();

			expect(embalm.callCount, "not embalmed").to.equal(1);
			expect(embalm.calledWith(server, browser), "wrong arguments").to.be.true;
		});
	});

	describe("wrapping a multi-connection server", function () {
		var defaultText;
		var dnsText;
		var portText;
		var anonymousText1;
		var anonymousText2;

		before(function () {
			var server = Utilities.createServer();
			var browser;

			Browser.extend(new Mummy(server));
			browser = new Browser();

			return browser.visit("/")
			.then(function () {
				defaultText = browser.text("body");
				return browser.visit("http://example.com");
			})
			.then(function () {
				dnsText = browser.text("body");
				return browser.visit("http://localhost:42");
			})
			.then(function () {
				portText = browser.text("body");
				return browser.visit("http://localhost:80");
			})
			.then(function () {
				anonymousText1 = browser.text("body");
				return browser.visit("https://localhost");
			})
			.then(function () {
				anonymousText2 = browser.text("body");
			});
		});

		after(function () {
			Utilities.removeExtensions();
		});

		it("uses the first connection on the server as the default site", function () {
			expect(defaultText, "default text").to.equal("server 0");
		});

		it("resolves connections using hostname and port", function () {
			expect(dnsText, "explicit hostname").to.equal("server 0");
			expect(portText, "explicit port").to.equal("server 1");
			expect(anonymousText1, "anonymous http").to.equal("server 2");
			expect(anonymousText2, "anonymous https").to.equal("server 3");
		});
	});

	describe("wrapping a server that leverages the start-up event", function () {
		var server;
		var spy;

		before(function () {
			var plugin = function (server, options, done) {
				server.on("start", spy);

				server.route({
					method : "get",
					path   : "/",

					handler : function (request, reply) {
						reply();
					}
				});

				done();
			};

			plugin.attributes = { name : "plugin" };

			server = new Hapi.Server();
			spy    = Sinon.spy();

			server.connection();

			return Bluebird.fromNode(function (callback) {
				server.register({ register : plugin }, callback);
			});
		});

		it("simulates server start-up on first visit", function () {
			var browser = new Browser();

			Mummy.embalm(server, browser);
			expect(spy.called, "spy called before start").to.be.false;

			return browser.visit("/")
			.then(function () {
				expect(spy.called, "spy not called after start").to.be.true;
			});
		});

		it("only runs the start-up simulation once", function () {
			var browser1 = new Browser();
			var browser2 = new Browser();

			Mummy.embalm(server, browser1);
			Mummy.embalm(server, browser2);

			return Bluebird.all([ browser1.visit("/"), browser2.visit("/"), browser2.visit("/") ])
			.catch(function () { /* ignore errors */ })
			.then(function () {
				expect(spy.callCount, "multiple start events").to.equal(1);
			});
		});
	});

	describe("with user credentials", function () {
		var credentials = { id : "test" };

		var browser;
		var server;
		var inject;

		before(function () {
			browser = new Browser();
			server  = new Hapi.Server();

			server.connection();

			server.route({
				method : "get",
				path   : "/",

				handler : function (request, reply) {
					reply();
				}
			});

			inject = Sinon.spy(server.connections[0], "inject");

			Mummy.embalm(server, browser);
			browser.credentials.set(credentials);
		});

		after(function () {
			inject.restore();
		});

		describe("performing a request", function () {
			before(function () {
				return browser.visit("/");
			});

			it("puts the credentials in the request", function () {
				var credentialsMatcher = Sinon.match.has("credentials", credentials);
				expect(inject.getCall(0).calledWith(credentialsMatcher, Sinon.match.func)).to.be.true;
			});
		});

		describe("that are cleared", function () {
			before(function () {
				browser.credentials.clear();
			});

			describe("performing a request", function () {
				before(function () {
					return browser.visit("/");
				});

				it("does not put the credentials in the request", function () {
					var credentialsMatcher = Sinon.match.has("credentials", credentials);
					expect(inject.getCall(1).calledWith(credentialsMatcher, Sinon.match.func)).to.be.false;
				});
			});
		});
	});

	describe("with cookies", function () {
		var browser;
		var server;
		var inject;

		before(function () {
			server  = new Hapi.Server();

			server.connection();

			server.route({
				method : "get",
				path   : "/",

				handler : function (request, reply) {
					reply();
				}
			});

			inject  = Sinon.spy(server.connections[0], "inject");

			browser = Mummy.embalm(server, new Browser());

			browser.setCookie({
				name   : "matching",
				domain : "localhost",
				path   : "/"
			});

			browser.setCookie({
				name   : "domain",
				domain : "example.com",
				path   : "/"
			});

			browser.setCookie({
				name   : "path",
				domain : "localhost",
				path   : "/path"
			});

			return browser.visit("/");
		});

		after(function () {
			inject.restore();
		});

		it("injects a cookie header", function () {
			expect(inject.firstCall.args[0].headers, "header").to.have.property("cookie");
		});

		it("injects the matching cookies", function () {
			var cookies = inject.firstCall.args[0].headers.cookie;

			expect(cookies, "matching cookie").to.include("matching=");
		});

		it("does not inject cookies headers that do not match the request", function () {
			var cookies = inject.firstCall.args[0].headers.cookie;

			expect(cookies, "domain cookie").to.not.include("domain=");
			expect(cookies, "path cookie").to.not.include("path=");
		});
	});
});
