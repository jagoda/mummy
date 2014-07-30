"use strict";
var Browser = require("zombie");
var fs      = require("fs");
var Hapi    = require("hapi");
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
	return util.format(
		"%s:%s",
		(server.info.host === "0.0.0.0" ? "localhost" : server.info.host),
		server.info.port
	);
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
	var map;
	var servers;

	if (pack instanceof Hapi.Server) {
		return embalm(pack.pack, browser);
	}

	// FIXME: it's a little hackish to rely on `_servers`...
	servers      = pack._servers;
	browser.site = serverUri(servers[0]);

	map = _.reduce(
		servers,
		function (map, server) {
			map[serverHost(server)] = server;
			return map;
		},
		Object.create(null)
	);

	browser.resources.addHandler(function (request, next) {
		var server = map[urlHost(request.url)];

		if (server) {
			server.inject(request, transformResponse.bind(null, next, request));
			return;
		}
		else {
			next();
			return;
		}
	});

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
