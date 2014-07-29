"use strict";
var Browser = require("zombie");
var fs      = require("fs");
var Hapi    = require("hapi");
var nock    = require("nock");
var Lab     = require("lab");
var mummy   = require("..");
var path    = require("path");
var Q       = require("q");
var sinon   = require("sinon");
var _       = require("lodash");

var after    = Lab.after;
var before   = Lab.before;
var describe = Lab.describe;
var expect   = Lab.expect;
var it       = Lab.it;

describe("mummy", function () {

	function removeExtension () {
		// Zombie does not expose a clean way to clear extensions.
		Browser._extensions = _.without(Browser._extensions, mummy);
	}

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
			removeExtension();
			done();
		});

		it("embalms all new browsers", function (done) {
			var browser = new Browser();

			expect(embalm.callCount, "not embalmed").to.equal(1);
			expect(embalm.calledWith(server, browser), "wrong arguments").to.be.true;
			done();
		});
	});

	describe("wrapping a pack of servers", function () {
		var defaultText;
		var dnsText;
		var portText;
		var anonymousText1;
		var anonymousText2;

		before(function (done) {
			var pack    = new Hapi.Pack();
			var browser;

			pack.server("example.com");  // http://example.com:80
			pack.server(42);             // http://localhost:42
			pack.server();               // http://localhost:80
			pack.server({                // https://localhost:443
				tls : {
					cert : fs.readFileSync(path.join(__dirname, "fixtures", "cert.pem")),
					key  : fs.readFileSync(path.join(__dirname, "fixtures", "key.pem"))
				}
			});

			// FIXME: depending on `_servers` is a little hackish...
			_.each(pack._servers, function (server, index) {
				server.route({
					method : "GET",
					path   : "/",

					handler : function (request, reply) {
						reply("server " + index);
					}
				});
			});

			Browser.extend(mummy(pack));
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
			removeExtension();
			done();
		});

		it("uses the first server in the pack as the default site", function (done) {
			expect(defaultText, "default text").to.equal("server 0");
			done();
		});

		it("resolves servers using hostname and port", function (done) {
			expect(dnsText, "explicit hostname").to.equal("server 0");
			expect(portText, "explicit port").to.equal("server 1");
			expect(anonymousText1, "anonymous http").to.equal("server 2");
			expect(anonymousText2, "anonymous https").to.equal("server 3");
			done();
		});
	});

	describe("composing a pack from a manifest object", function () {
		var response;

		before(function (done) {
			var manifest = {
				plugins : {
					"./test" : {}
				},
				servers : [
					{ port : "$env.PORT" }
				]
			};

			Q.ninvoke(mummy, "compose", manifest, path.join(__dirname, "fixtures"))
			.then(function (browser) {
				return browser.visit("/")
				.then(function () {
					return browser;
				});
			})
			.then(function (browser) {
				response = browser.text("body");
			})
			.nodeify(done);
		});

		it("injects requests into the pack servers", function (done) {
			expect(response, "response").to.equal("test plugin");
			done();
		});
	});

	describe("composing a pack from a manifest path", function () {
		var response;

		before(function (done) {
			var manifest = path.join(__dirname, "fixtures", "manifest.json");
			var plugins  = path.join(__dirname, "fixtures");

			Q.ninvoke(mummy, "compose", manifest, plugins)
			.then(function (browser) {
				return browser.visit("/")
				.then(function () {
					return browser;
				});
			})
			.then(function (browser) {
				response = browser.text("body");
			})
			.nodeify(done);
		});

		it("injects requests into the pack servers", function (done) {
			expect(response, "response").to.equal("test plugin");
			done();
		});
	});
});
