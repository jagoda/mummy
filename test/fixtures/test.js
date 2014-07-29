"use strict";

exports.register = function (plugin, options, done) {

	plugin.route({
		method : "GET",
		path   : "/",

		handler : function (request, reply) {
			reply("test plugin");
		}
	});

	done();
};

exports.register.attributes = {
	name : "test plugin"
};
