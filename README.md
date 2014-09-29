mummy
=====

[![Build Status](https://travis-ci.org/jagoda/mummy.svg?branch=master)](https://travis-ci.org/jagoda/mummy)

> [Hapi][hapi] request mocking with [Zombie.js][zombie] and [Nipple][nipple].

	npm install mummy

## Overview

`mummy` is a browser extension for the [Zombie.js][zombie] headless browser
testing framework that allows using `Browser` objects with [Hapi][hapi] servers
without having to start the server.

	var Browser = require("zombie");
	var mummy   = require("mummy");
	var browser;
	
	Browser.extend(mummy(server));
	browser = new Browser();

## Extending the Browser API

`zombie` provides an [extension API][zombie-ext] that allows all new `Browser`
objects to be augmented with additional functionality. Using this approach,
`mummy` will cause all `Browser` objects to direct their requests to the wrapped
`hapi` server. Either a pack or individual server may be wrapped as follows:

	var Browser = require("zombie");
	var mummy   = require("mummy");
	var browser;
	
	Browser.extend(mummy(server));
	browser = new Browser();

Only requests with URLs matching the hostname and port of one of the servers
in the pack will be injected. All other requests will be processed normally.

## Wrapping a Full Application

`mummy` can construct a `pack` from a manifest and augment the `Browser` API
so that all `Browser` instances created in any test cases can make requests to
the pack as follows:

	var mummy = require("mummy");

	before(function (done) {
		mummy.extend(manifestPath, done);
	});

## Wrapping a Single Browser

Alternatively, `mummy` can wrap a single `Browser` instance as follows (passing
either a pack or server):

	var Browser = require("zombie");
	var mummy   = require("mummy");

	var browser = new Browser();
	mummy.embalm(server, browser);

## Raw HTTP Requests

`mummy` also provides the ability to make "raw" HTTP requests to wrapped packs.
This can be useful for testing REST APIs. For example:

	var browser = new Browser();

	browser.http({ method : "GET", url : "/" }).then(function (response) {
		expect(response.statusCode).to.equal(200);
	});

## API

### mummy(pack)

 + **pack** -- a `Pack` or `Server` instance to create a `Browser` extension
     for.

Returns a `Browser` extension suitable for passing to `Browser.extend()`.

### mummy.compose(manifest, [path], [callback])

 + **manifest** -- either a manifest object or a path to a manifest file.
 + **path** -- a path to load relative plugins from. Required if `manifest` is
     an object, but optional if it is a path. If a manifest path is provided
     without a plugin path, plugins will be loaded from the directory that the
     manifest is in.
 + **callback** -- _Optional_ a callback function receiving arguments of the
     form `(error, browser)` depending on if the pack was successfully created.
     If not provided, a promise is returned.

Create a `Browser` instance for a `pack` defined by the manifest.

### mummy.embalm(pack, browser)

 + **pack** -- a `Pack` or `Server` instance to inject requests into.
 + **browser** -- a `Browser` instance to augment with request redirection.

Returns the original `Browser` instance after it has been augmented to redirect
requests to the pack.

### mummy.extend(manifest, [path], [callback])

 + **manifest** -- either a manifest object or a path to a manifest file.
 + **path** -- a path to load relative plugins from. Required if `manifest` is
     an object, but optional if it is a path. If a manifest path is provided
     without a plugin path, plugins will be loaded from the directory that the
     manifest is in.
 + **callback** -- _Optional_ a callback function receiving arguments of the
     form `(error)` depending on if the pack was successfully created. If not
     provided, a promise is returned.

Creates and loads a `Browser` extension for the `pack` defined by the manifest.

### browser.credentials.set(credentials)

 + **credentials** -- an object containing simulated authentication information

Update the browser state to bypass the normal authentication strategies when
requests are sent to Hapi. See [the Hapi documentation][hapi-inject] for more
details.

### browser.credentials.clear()

Clear any browser credentials. This will cause normal authentication flows to
be used for requests sent to Hapi.

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
`Hapi` is used for requests to wrapped servers while [Nipple][nipple] is used
for requests to URLs not belonging to wrapped servers. Additional options are
supported for both (see the respective docs for details).

[hapi]: https://github.com/spumko/hapi "Hapi"
[hapi-inject]: https://github.com/hapijs/hapi/blob/master/docs/Reference.md#serverinjectoptions-callback "server.inject()"
[nipple]: https://github.com/hapijs/nipple "Nipple"
[zombie]: https://github.com/assaf/zombie "Zombie.js"
[zombie-ext]: https://github.com/assaf/zombie/tree/master/doc/new#extending-the-browser "Zombie Extensions"
