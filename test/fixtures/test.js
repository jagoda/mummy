"use strict";

exports.register = function (plugin, options, done) {

	plugin.route({
		method : "GET",
		path   : "/",

		handler : function (request, reply) {
			reply("test plugin -- " + plugin.servers[0].info.host + " -- " + options.env);
		}
	});

	done();
};

exports.register.attributes = {
	name : "test plugin"
};
