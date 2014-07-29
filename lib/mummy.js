"use strict";

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
		server.inject(request, transformResponse.bind(null, next, request));
	});
};

module.exports = mummy;
