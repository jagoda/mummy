"use strict";
var URL = require("url");

function mummy (server) {
	return mummy.embalm.bind(null, server);
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

mummy.embalm = function (server, browser) {
	browser.site = "http://localhost";

	browser.resources.addHandler(function (request, next) {
		var parsed = URL.parse(request.url);

		if (parsed.hostname === "localhost") {
			server.inject(request, transformResponse.bind(null, next, request));
			return;
		}
		else {
			next();
			return;
		}
	});
};

module.exports = mummy;
