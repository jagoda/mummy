"use strict";
var Browser = require("zombie");
var fs      = require("fs");
var Hapi    = require("hapi");
var path    = require("path");
var _       = require("lodash");

module.exports = {

	createPack : function () {
		var pack    = new Hapi.Pack();

		pack.server("example.com");  // http://example.com:80
		pack.server(42);             // http://localhost:42
		pack.server();               // http://localhost:80
		pack.server({                // https://localhost:443
			tls : {
				cert : fs.readFileSync(path.join(__dirname, "..", "fixtures", "cert.pem")),
				key  : fs.readFileSync(path.join(__dirname, "..", "fixtures", "key.pem"))
			}
		});

		// FIXME: depending on `_servers` is a little hackish...
		_.each(pack._servers, function (server, index) {
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
