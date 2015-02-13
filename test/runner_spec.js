"use strict";
var Browser = require("zombie");
var Hapi    = require("hapi");
var Mummy   = require("..");
var Path    = require("path");

var expect = require("chai").expect;

describe("The browser runner", function () {
	var htmlFile = Path.join("file://", __dirname, "fixtures", "timeout.html");

	var browser;

	before(function () {
		var server = new Hapi.Server();

		server.connection();

		browser = new Browser();
		Mummy.embalm(server, browser);
	});

	describe("when not started", function () {
		before(function () {
			return browser.visit(htmlFile)
			.then(function () {
				browser.window.start();
			});
		});

		it("does not run the event loop", function () {
			// Run the initial iteration but don't process timeouts.
			expect(browser.window.count, "count").to.equal(1);
		});
	});

	describe("when started", function () {
		// Real timeouts need to process...
		this.timeout(10000);

		before(function (done) {
			return browser.visit(htmlFile)
			.then(function () {
				browser.window.done = done;
				browser.runner.start();
				browser.window.start();
			});
		});

		after(function () {
			browser.runner.stop();
		});

		it("runs the event loop until stopped", function () {
			expect(browser.window.count, "count").to.equal(6);
		});
	});

	describe("when stopping", function () {
		before(function () {
			return browser.visit(htmlFile)
			.then(function () {
				var finished = browser.runner.start();

				browser.window.start();
				browser.runner.stop();
				return finished;
			});
		});

		it("aborts execution", function () {
			expect(browser.window.count, "count").to.equal(1);
		});
	});
});
