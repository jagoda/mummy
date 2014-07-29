"use strict";
var Browser = require("zombie");
var fs      = require("fs");
var Hapi    = require("hapi");
var Q       = require("q");
var URL     = require("url");
var util    = require("util");
var _       = require("lodash");

function mummy (pack) {
	return mummy.embalm.bind(null, pack);
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

mummy.compose = function compose (manifest, relativeTo, callback) {
	if ("string" === typeof manifest || manifest instanceof String) {
		return Q.ninvoke(fs, "readFile", manifest, { encoding : "utf8" })
		.then(function (contents) {
			return Q.nfcall(compose, JSON.parse(contents), relativeTo);
		})
		.nodeify(callback);
	}

	return Q.ninvoke(Hapi.Pack, "compose", manifest, { relativeTo : relativeTo })
	.then(function (pack) {
		return mummy.embalm(pack, new Browser());
	})
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

module.exports = mummy;
