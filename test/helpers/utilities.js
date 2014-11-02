"use strict";
var Browser = require("zombie");
var FS      = require("fs");
var Hapi    = require("hapi");
var Path    = require("path");
var _       = require("lodash");

module.exports = {

	createPack : function () {
		var pack    = new Hapi.Pack();

		pack.server("example.com");  // http://example.com:80
		pack.server(42);             // http://localhost:42
		pack.server();               // http://localhost:80
		pack.server({                // https://localhost:443
			tls : {
				cert : FS.readFileSync(Path.join(__dirname, "..", "fixtures", "cert.pem")),
				key  : FS.readFileSync(Path.join(__dirname, "..", "fixtures", "key.pem"))
			}
		});

		_.each(pack.connections, function (server, index) {
			server.route({
				method : "GET",
				path   : "/",

				handler : function (request, reply) {
					reply("server " + index);
				}
			});
		});

		return pack;
	},

	removeExtensions: function () {
		// Zombie does not expose a clean way to clear extensions.
		Browser._extensions = [];
	}

};
