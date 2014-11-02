"use strict";
var Browser = require("zombie");
var FS      = require("fs");
var Hapi    = require("hapi");
var Path    = require("path");
var Q       = require("q");
var URL     = require("url");
var Util    = require("util");
var Wreck   = require("wreck");
var _       = require("lodash");

function mummy (pack) {
	return mummy.embalm.bind(null, pack);
}

// Taken from Hapi CL (see https://github.com/hapijs/hapi/blob/master/lib/cli.js#L111-131).
function parseEnv (manifest) {
	if (!manifest || "object" !== typeof manifest) {
		return;
	}

	Object.keys(manifest).forEach(function (key) {
		var value = manifest[key];

		if ("string" === typeof value && 0 === value.indexOf("$env.")) {
			manifest[key] = process.env[value.slice(5)] || "";
		}
		else {
			parseEnv(value);
		}
	});
}

function compose (manifest, relativeTo) {
	if ("string" === typeof manifest || manifest instanceof String) {
		if (!relativeTo) {
			relativeTo = Path.dirname(manifest);
		}

		return Q.ninvoke(FS, "readFile", manifest, { encoding : "utf8" })
		.then(function (contents) {
			contents = JSON.parse(contents);
			parseEnv(contents);

			return compose(contents, relativeTo);
		});
	}

	return Q.ninvoke(Hapi.Pack, "compose", manifest, { relativeTo : relativeTo });
}

function serverHost (server) {
	return Util.format("%s:%s", (server.info.host === "0.0.0.0" ? "localhost" : server.info.host), server.info.port);
}

function serverUri (server) {
	return Util.format("%s://%s", server.info.protocol, serverHost(server));
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

	function prepareRequest (request) {
		if (credentials) {
			request.credentials = credentials;
		}

		return request;
	}

	function start () {
		if (!pack._start) {
			_.each(servers, function (server) {
				server._start = function (next) {
					this._started = true;
					next();
				};
			});

			pack._start = Q.ninvoke(pack, "start");
		}
		return pack._start;
	}

	// If argument is a server instead of a pack.
	if (pack.pack) {
		return embalm(pack.pack, browser);
	}

	servers      = pack.connections;
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
			server.inject(prepareRequest(request), transformResponse.bind(null, next, request));
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
				server.inject(prepareRequest(options), deferred.resolve.bind(deferred));
			}
			else {
				Wreck[options.method.toLowerCase()](options.url, options, deferred.makeNodeResolver());
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
