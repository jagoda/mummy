mummy
=====

[![Build Status](https://travis-ci.org/jagoda/mummy.svg?branch=master)](https://travis-ci.org/jagoda/mummy)

> Tools for using [Zombie.js][zombie] with [Hapi][hapi].

	npm install mummy

## Overview

`mummy` is a browser extension for the [Zombie.js][zombie] headless browser
testing framework that allows automatic binding of `Browser` instances to
[Hapi][hapi] servers.

	var Browser = require("zombie");
	var Mummy   = require("mummy");
	var browser;
	
	Browser.extend(new Mummy(server));
	browser = new Browser();
	
	browser.visit("/")
	.then(function () {
		. . .
	});


## Extending the Browser API

[Zombie][zombie] provides an [extension API][zombie-ext] that allows all new
`Browser` objects to be augmented with additional functionality. Using this
approach, `mummy` will cause all `Browser` objects to direct their requests to
the wrapped [Hapi][hapi] server. Only requests with URLs matching the hostname
and port of one of the connections on the server will be injected. All other
requests will be processed normally.

## Wrapping a Single Browser

Alternatively, `mummy` can wrap a single `Browser` instance as follows:

	var Browser = require("zombie");
	var Mummy   = require("mummy");

	var browser = new Browser();
	Mummy.embalm(server, browser);

## Raw HTTP Requests

`mummy` also provides the ability to make "raw" HTTP requests to wrapped
servers. This can be useful for testing REST APIs. For example:

	var browser = new Browser();

	browser.http({ method : "GET", url : "/" }).then(function (response) {
		expect(response.statusCode).to.equal(200);
	});

## API

### Mummy(server)

 + **server** -- a [Hapi][hapi] `Server` instance to create a `Browser`
   extension for.

Returns a `Browser` extension suitable for passing to [Zombie's][zombie]
`Browser.extend()`.

### Mummy.embalm(server, browser)

 + **server** -- a [Hapi][hapi] `Server` instance to inject requests into.
 + **browser** -- a `Browser` instance to augment with request redirection.

Returns the original `Browser` instance after it has been augmented to redirect
requests to the server.

### browser.credentials.set(credentials)

 + **credentials** -- an object containing simulated authentication information

Update the browser state to bypass the normal authentication strategies when
requests are sent to [Hapi][hapi]. See [the Hapi documentation][hapi-inject]
for more details.

### browser.credentials.clear()

Clear any browser credentials. This will cause normal authentication flows to
be used for requests sent to [Hapi][hapi].

### browser.http(options, [callback])

 + **options** -- an object representing the request.
 + **callback** -- _Optional_ a callback function receiving arguments of the
   form `(error, response)` depending on if the response is successful. If not
   provided, a promise is returned.

The options hash can include the following:

 + **method** -- the HTTP request method. Defaults to `"GET"`.
 + **url** -- the path or URL to request. Defaults to `"/"`.
 + **headers** -- an object defining request headers.

Performs a "raw" HTTP request. The [server.inject()][hapi-inject] method from
[Hapi][hapi] is used for requests to wrapped servers while [Request][request] is
used for requests to URLs not belonging to wrapped servers. Additional options
are supported for both (see the respective docs for details).

[hapi]: https://github.com/hapijs/hapi "Hapi"
[hapi-inject]: https://github.com/hapijs/hapi/blob/master/API.md#serverinjectoptions-callback "server.inject()"
[request]: https://github.com/request/request "Request"
[zombie]: https://github.com/assaf/zombie "Zombie.js"
[zombie-ext]: https://github.com/assaf/zombie#extending-the-browser "Zombie Extensions"
