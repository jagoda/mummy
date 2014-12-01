"use strict";
var Browser     = require("zombie");
var Hapi        = require("hapi");
var Nock        = require("nock");
var Lab         = require("lab");
var Mummy       = require("..");
var Path        = require("path");
var Q           = require("q");
var Sinon       = require("sinon");
var Utilities   = require("./helpers/utilities");

var after    = Lab.after;
var before   = Lab.before;
var describe = Lab.describe;
var expect   = Lab.expect;
var it       = Lab.it;

describe("mummy", function () {

	before(function (done) {
		Nock.disableNetConnect();
		done();
	});

	after(function (done) {
		Nock.enableNetConnect();
		done();
	});

	describe("wrapping a Hapi server", function () {
		var browser;
		var localText;
		var remoteRequest;
		var remoteText;
		var server;

		before(function (done) {
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
			Nock.cleanAll();
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

		it("exposes the server on the browser object", function (done) {
			expect(browser, "server").to.have.property("server", server);
			done();
		});
	});

	describe("loaded as a browser extension", function () {
		var embalm;
		var server;

		before(function (done) {
			embalm = Sinon.stub(Mummy, "embalm");
			server = new Hapi.Server();

			Browser.extend(new Mummy(server));
			done();
		});

		after(function (done) {
			embalm.restore();
			Utilities.removeExtensions();
			done();
		});

		it("embalms all new browsers", function (done) {
			var browser = new Browser();

			expect(embalm.callCount, "not embalmed").to.equal(1);
			expect(embalm.calledWith(server, browser), "wrong arguments").to.be.true;
			done();
		});
	});

	describe("wrapping a multi-connection server", function () {
		var defaultText;
		var dnsText;
		var portText;
		var anonymousText1;
		var anonymousText2;

		before(function (done) {
			var server = Utilities.createServer();
			var browser;

			Browser.extend(new Mummy(server));
			browser = new Browser();

			browser.visit("/")
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
			})
			.nodeify(done);
		});

		after(function (done) {
			Utilities.removeExtensions();
			done();
		});

		it("uses the first connection on the server as the default site", function (done) {
			expect(defaultText, "default text").to.equal("server 0");
			done();
		});

		it("resolves connections using hostname and port", function (done) {
			expect(dnsText, "explicit hostname").to.equal("server 0");
			expect(portText, "explicit port").to.equal("server 1");
			expect(anonymousText1, "anonymous http").to.equal("server 2");
			expect(anonymousText2, "anonymous https").to.equal("server 3");
			done();
		});
	});

	describe("wrapping a server that leverages the start-up event", function () {
		var server;
		var spy;

		before(function (done) {
			var plugin = function (plugin, options, done) {
				plugin.on("start", spy);
				done();
			};

			plugin.attributes = { name : "plugin" };

			server = new Hapi.Server();
			spy    = Sinon.spy();

			server.connection();
			server.register({ register : plugin }, done);
		});

		it("simulates server start-up on first visit", function (done) {
			var browser = new Browser();

			Mummy.embalm(server, browser);
			expect(spy.called, "spy called before start").to.be.false;

			browser.visit("/", function () {
				expect(spy.called, "spy not called after start").to.be.true;
				done();
			});
		});

		it("only runs the start-up simulation once", function (done) {
			var browser1 = new Browser();
			var browser2 = new Browser();

			Mummy.embalm(server, browser1);
			Mummy.embalm(server, browser2);

			Q.all([ browser1.visit("/"), browser2.visit("/"), browser2.visit("/") ])
			.fail(function () { /* ignore errors */ })
			.then(function () {
				expect(spy.callCount, "multiple start events").to.equal(1);
			})
			.nodeify(done);
		});
	});

	describe("with user credentials", function () {
		var credentials = { id : "test" };

		var browser;
		var server;
		var inject;

		before(function (done) {
			browser = new Browser();
			server  = new Hapi.Server();

			server.connection();
			inject = Sinon.stub(server.connections[0], "inject");

			Mummy.embalm(server, browser);
			browser.credentials.set(credentials);
			done();
		});

		after(function (done) {
			inject.restore();
			done();
		});

		describe("performing a request", function () {

			before(function (done) {
				browser.visit("/").fin(done);
			});

			it("puts the credentials in the request", function (done) {
				var credentialsMatcher = Sinon.match.has("credentials", credentials);
				expect(inject.getCall(0).calledWith(credentialsMatcher, Sinon.match.func)).to.be.true;
				done();
			});
		});

		describe("that are cleared", function () {
			before(function (done) {
				browser.credentials.clear();
				done();
			});

			describe("performing a request", function () {
				before(function (done) {
					browser.visit("/").fin(done);
				});

				it("does not put the credentials in the request", function (done) {
					var credentialsMatcher = Sinon.match.has("credentials", credentials);
					expect(inject.getCall(1).calledWith(credentialsMatcher, Sinon.match.func)).to.be.false;
					done();
				});
			});
		});
	});

	describe("with cookies", function () {
		var browser;
		var server;
		var inject;

		before(function (done) {
			server  = new Hapi.Server();

			server.connection();
			inject  = Sinon.stub(server.connections[0], "inject");

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

			browser.visit("/").nodeify(done);
		});

		after(function (done) {
			inject.restore();
			done();
		});

		it("injects a cookie header", function (done) {
			expect(inject.firstCall.args[0].headers, "header").to.have.property("cookie");
			done();
		});

		it("injects the matching cookies", function (done) {
			var cookies = inject.firstCall.args[0].headers.cookie;

			expect(cookies, "matching cookie").to.include("matching=");
			done();
		});

		it("does not inject cookies headers that do not match the request", function (done) {
			var cookies = inject.firstCall.args[0].headers.cookie;

			expect(cookies, "domain cookie").to.not.include("domain=");
			expect(cookies, "path cookie").to.not.include("path=");
			done();
		});
	});
});
