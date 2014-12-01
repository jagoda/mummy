"use strict";
var Browser = require("zombie");
var FS      = require("fs");
var Hapi    = require("hapi");
var Path    = require("path");
var _       = require("lodash");

module.exports = {

	createPack : function () {
		var server    = new Hapi.Server();

		var connections = [
			// http://example.com:80
			server.connection({ host : "example.com" }),
			// http://localhost:42
			server.connection({ port : 42 }),
			// http://localhost:80
			server.connection(),

			// https://localhost:443
			server.connection({
				tls : {
					cert : FS.readFileSync(Path.join(__dirname, "..", "fixtures", "cert.pem")),
					key  : FS.readFileSync(Path.join(__dirname, "..", "fixtures", "key.pem"))
				}
			})
		];

		_.each(connections, function (server, index) {
			server.route({
				method : "GET",
				path   : "/",

				handler : function (request, reply) {
					reply("server " + index);
				}
			});
		});

		return server;
	},

	removeExtensions: function () {
		// Zombie does not expose a clean way to clear extensions.
		Browser._extensions = [];
	}

};
