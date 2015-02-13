"use strict";
var Bluebird = require("bluebird");
var Browser  = require("zombie");
var OS       = require("os");
var URL      = require("url");
var Util     = require("util");

var debug   = require("debug")("mummy");
var request = Bluebird.promisify(require("request"));
var _       = require("lodash");

function mummy (server) {
	return mummy.embalm.bind(null, server);
}

function connectionPort (connection) {
	return Number(connection.info.port) ? connection.info.port :
	connection.info.protocol === "https" ? 443 :
	80;
}

function connectionHost (connection) {
	return Util.format(
		"%s:%s",
		(connection.info.host === OS.hostname() ? "localhost" : connection.info.host),
		connectionPort(connection)
	);
}

function connectionUri (connection) {
	return Util.format("%s://%s", connection.info.protocol, connectionHost(connection));
}

function transformResponse (next, request, response) {
	return next(
		null,
		{
			body       : response.payload,
			headers    : response.headers,
			statusCode : response.statusCode,
			url        : request.url
		}
	);
}

function urlHost (url) {
	var parsed = URL.parse(url);
	var port   = parsed.port || (parsed.protocol === "https:" ? 443 : 80);

	return Util.format("%s:%s", parsed.hostname, port);
}

mummy.embalm = function embalm (server, browser) {
	var credentials = null;
	var visit       = browser.visit;

	var map;
	var connections;

	function getConnection (url) {
		var host;

		url  = URL.resolve(connectionUri(connections[0]), url);
		host = urlHost(url);

		debug("getting connection for '%s' from %j", host, Object.keys(map));
		return map[urlHost(url)];
	}

	function prepareRequest (request) {
		if (credentials) {
			request.credentials = credentials;
		}

		return request;
	}

	function start () {
		if (!server._start) {
			_.each(connections, function (connection) {
				connection._start = function (next) {
					this._started = true;
					next();
				};
			});

			server._start = Bluebird.fromNode(function (callback) {
				server.start(callback);
			});
		}
		return server._start;
	}

	connections    = server.connections;
	browser.server = server;
	browser.site   = connectionUri(connections[0]);

	map = _.reduce(
		connections,
		function (map, connection) {
			map[connectionHost(connection)] = connection;
			return map;
		},
		Object.create(null)
	);

	browser.credentials = {
		set : function (creds) {
			credentials = creds;
		},
		clear : function () {
			credentials = null;
		}
	};

	browser.resources.addHandler(function (request, next) {
		var connection = getConnection(request.url);
		var url        = URL.parse(request.url);

		if (connection) {
			request.headers.cookie = browser.cookies.serialize(url.hostname, url.pathname);
			connection.inject(prepareRequest(request), transformResponse.bind(null, next, request));
			return;
		}
		else {
			next();
			return;
		}
	});

	browser.http = function (options, callback) {
		var connection;

		options.method = options.method || "GET";
		options.url    = options.url    || "/";
		connection     = getConnection(options.url);

		// Get headers for browser state.
		Browser.Resources.mergeHeaders.call(this, options, function () {});

		return start()
		.then(function () {
			var result;

			if (connection) {
				result = new Bluebird(function (resolve) {
					connection.inject(prepareRequest(options), resolve);
				});
			}
			else {
				result = request(options)
				.spread(function (response, payload) {
					response.payload = payload;
					return response;
				});
			}

			return result;
		})
		// Nodeify returns a promise when callback is not a function.
		// See http://bit.ly/1DNDq25
		.nodeify(callback);
	};

	browser.visit = function (url, options, callback) {
		if ("function" === typeof options) {
			callback = options;
			options  = undefined;
		}

		return start()
		.then(function () {
			return visit.call(browser, url, options);
		})
		.nodeify(callback);
	};

	return browser;
};

module.exports = mummy;
