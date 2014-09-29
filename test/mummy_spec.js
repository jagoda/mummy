"use strict";
var Browser   = require("zombie");
var Hapi      = require("hapi");
var nock      = require("nock");
var Lab       = require("lab");
var mummy     = require("..");
var path      = require("path");
var Q         = require("q");
var sinon     = require("sinon");
var utilities = require("./helpers/utilities");

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
		var browser;
		var localText;
		var remoteRequest;
		var remoteText;
		var server;

		before(function (done) {
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

		it("exposes the pack on the browser object", function (done) {
			expect(browser, "pack").to.have.property("pack", server.pack);
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
			utilities.removeExtensions();
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
			var pack = utilities.createPack();
			var browser;

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
			utilities.removeExtensions();
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

	describe("composing a pack from a manifest path and plugin directory", function () {
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

	describe("composing a pack from a manifest path", function () {
		var response;

		before(function (done) {
			var manifest = path.join(__dirname, "fixtures", "manifest.json");

			Q.ninvoke(mummy, "compose", manifest)
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

	describe("composing a pack without a callback", function () {
		var result;

		before(function (done) {
			result = mummy.compose(path.join(__dirname, "fixtures", "manifest.json"));
			done();
		});

		it("returns a promise for a browser", function (done) {
			expect(result.then, "not a promise").to.be.a("function");
			result.then(function (browser) {
				expect(browser, "not a browser").to.be.an.instanceOf(Browser);
				done();
			});
		});
	});

	describe("loading a browser extension from a manifest object", function () {
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

			Q.ninvoke(mummy, "extend", manifest, path.join(__dirname, "fixtures"))
			.then(function () {
				var browser = new Browser();

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

		after(function (done) {
			utilities.removeExtensions();
			done();
		});

		it("injects requests from all browsers into the pack", function (done) {
			expect(response, "wrong response").to.equal("test plugin");
			done();
		});
	});

	describe("loading a browser extension from a manifest file", function () {
		var response;

		before(function (done) {
			var manifest = path.join(__dirname, "fixtures", "manifest.json");

			Q.ninvoke(mummy, "extend", manifest)
			.then(function () {
				var browser = new Browser();

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

		after(function (done) {
			utilities.removeExtensions();
			done();
		});

		it("injects requests from all browsers into the pack", function (done) {
			expect(response, "wrong response").to.equal("test plugin");
			done();
		});
	});

	describe("loading a browser extension from a manifest without a callback", function () {
		var result;

		before(function (done) {
			result = mummy.extend(path.join(__dirname, "fixtures", "manifest.json"));
			done();
		});

		after(function (done) {
			utilities.removeExtensions();
			done();
		});

		it("returns a promise", function (done) {
			expect(result.then, "not a promise").to.be.a("function");
			done();
		});
	});

	describe("wrapping a pack with dependencies", function () {
		var pack;
		var spy;

		before(function (done) {
			var dependency = {
				name     : "test dependency",
				register : function (plugin, options, done) {
					done();
				}
			};

			var plugin = {
				name     : "test plugin",
				register : function (plugin, options, done) {

					plugin.dependency("test dependency", function (plugin, done) {
						spy();
						done();
					});

					done();
				}
			};

			pack = new Hapi.Pack();
			spy  = sinon.spy();

			pack.server();
			pack.register([ dependency, plugin ], done);
		});

		it("simulates server start-up on first visit", function (done) {
			var browser = new Browser();

			mummy.embalm(pack, browser);
			expect(spy.called, "spy called before start").to.be.false;

			browser.visit("/", function () {
				expect(spy.called, "spy not called after start").to.be.true;
				done();
			});
		});

		it("only starts the pack once", function (done) {
			var browser1 = new Browser();
			var browser2 = new Browser();

			mummy.embalm(pack, browser1);
			mummy.embalm(pack, browser2);

			Q.all([ browser1.visit("/"), browser2.visit("/"), browser2.visit("/") ])
			.fail(function () { /* ignore errors */ })
			.then(function () {
				expect(spy.callCount, "multiple starts").to.equal(1);
			})
			.nodeify(done);
		});
	});

	describe("wrapping a pack that leverages the start-up event", function () {
		var pack;
		var spy;

		before(function (done) {
			var plugin;

			pack = new Hapi.Pack();
			spy  = sinon.spy();

			plugin = {
				name     : "test plugin",
				register : function (plugin, options, done) {
					plugin.events.on("start", spy);
					done();
				}
			};

			pack.server();
			pack.register(plugin, done);
		});

		it("simulates server start-up on first visit", function (done) {
			var browser = new Browser();

			mummy.embalm(pack, browser);
			expect(spy.called, "spy called before start").to.be.false;

			browser.visit("/", function () {
				expect(spy.called, "spy not called after start").to.be.true;
				done();
			});
		});

		it("only runs the start-up simulation once", function (done) {
			var browser1 = new Browser();
			var browser2 = new Browser();

			mummy.embalm(pack, browser1);
			mummy.embalm(pack, browser2);

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
			server = new Hapi.Server();

			browser = new Browser();
			mummy.embalm(server, browser);

			inject = sinon.stub(server, "inject");

			browser.credentials.set(credentials);

			done();
		});

		after(function (done) {
			inject.restore();
			done();
		});

		describe("performing a request", function () {

			before(function (done) {
				browser.visit("/").nodeify(done);
			});

			it("puts the credentials in the request", function (done) {
				var credentialsMatcher = sinon.match.has("credentials", credentials);
				expect(inject.getCall(0).calledWith(credentialsMatcher, sinon.match.func)).to.be.true;
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
					browser.visit("/").nodeify(done);
				});

				it("does not put the credentials in the request", function (done) {
					var credentialsMatcher = sinon.match.has("credentials", credentials);
					expect(inject.getCall(1).calledWith(credentialsMatcher, sinon.match.func)).to.be.false;
					done();
				});
			});
		});
	});
});
