"use strict";
var Browser = require("zombie");
var fs      = require("fs");
var Hapi    = require("hapi");
var Nipple  = require("nipple");
var path    = require("path");
var Q       = require("q");
var URL     = require("url");
var util    = require("util");
var _       = require("lodash");

function mummy (pack) {
	return mummy.embalm.bind(null, pack);
}

function compose (manifest, relativeTo) {
	if ("string" === typeof manifest || manifest instanceof String) {
		if (!relativeTo) {
			relativeTo = path.dirname(manifest);
		}

		return Q.ninvoke(fs, "readFile", manifest, { encoding : "utf8" })
		.then(function (contents) {
			return compose(JSON.parse(contents), relativeTo);
		});
	}

	return Q.ninvoke(Hapi.Pack, "compose", manifest, { relativeTo : relativeTo });
}

function serverHost (server) {
	var host = server.info.host;

	if (0 === host.indexOf("$env.")) {
		host = process.env[host.substring(5)];
	}

	return util.format("%s:%s", (host === "0.0.0.0" ? "localhost" : host), server.info.port);
}

function serverUri (server) {
	return util.format("%s://%s", server.info.protocol, serverHost(server));
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

	return util.format("%s:%s", parsed.hostname, port);
}

mummy.compose = function (manifest, relativeTo, callback) {
	if ("function" === typeof relativeTo) {
		callback   = relativeTo;
		relativeTo = undefined;
	}

	return compose(manifest, relativeTo)
	.then(function (pack) {
		return mummy.embalm(pack, new Browser());
	})
	// Nodeify returns a promise when callback is not a function.
	// See https://github.com/kriskowal/q/wiki/API-Reference#promisenodeifycallback
	.nodeify(callback);
};

mummy.embalm = function embalm (pack, browser) {
	var credentials = null;
	var visit       = browser.visit;

	var map;
	var servers;

	function getServer (url) {
		url = URL.resolve(serverUri(servers[0]), url);
		return map[urlHost(url)];
	}

	function start () {
		// Trigger plugin dependency handlers (assumes pack is fully composed).
		// FIXME: it's a little hackish to rely on `_invoke`...
		if (!pack._start) {
			pack._start = Q.ninvoke(pack, "_invoke", "onPreStart")
			.then(function () {
				pack._events.emit("start");
			});
		}

		return pack._start;
	}

	if (pack instanceof Hapi.Server) {
		return embalm(pack.pack, browser);
	}

	// FIXME: it's a little hackish to rely on `_servers`...
	servers      = pack._servers;
	browser.pack = pack;
	browser.site = serverUri(servers[0]);

	map = _.reduce(
		servers,
		function (map, server) {
			map[serverHost(server)] = server;
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
		var server = getServer(request.url);

		if (server) {
			if (credentials) {
				request.credentials = credentials;
			}

			server.inject(request, transformResponse.bind(null, next, request));
			return;
		}
		else {
			next();
			return;
		}
	});

	browser.http = function (options, callback) {
		var server;

		options.method = options.method || "GET";
		options.url    = options.url    || "/";
		server         = getServer(options.url);

		// Get headers for browser state.
		Browser.Resources.mergeHeaders.call(this, options, function () {});

		return start()
		.then(function () {
			var deferred = Q.defer();
			var result   = deferred.promise;

			if (server) {
				server.inject(options, deferred.resolve.bind(deferred));
			}
			else {
				Nipple[options.method.toLowerCase()](options.url, options, deferred.makeNodeResolver());
				result = result.spread(function (response, payload) {
					response.payload = payload;
					return response;
				});
			}

			return result;
		})
		// Nodeify returns a promise when callback is not a function.
		// See https://github.com/kriskowal/q/wiki/API-Reference#promisenodeifycallback
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

mummy.extend = function (manifest, relativeTo, callback) {
	if ("function" === typeof relativeTo) {
		callback   = relativeTo;
		relativeTo = undefined;
	}

	return compose(manifest, relativeTo)
	.then(function (pack) {
		Browser.extend(mummy(pack));
	})
	// Nodeify returns a promise when callback is not a function.
	// See https://github.com/kriskowal/q/wiki/API-Reference#promisenodeifycallback
	.nodeify(callback);
};

module.exports = mummy;
