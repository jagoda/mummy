mummy
=====

[![Build Status](https://travis-ci.org/jagoda/mummy.svg?branch=master)](https://travis-ci.org/jagoda/mummy)

> [Hapi][hapi] request mocking for [Zombie.js][zombie]

## Overview

	npm install mummy

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

## Wrapping a Single Browser

Alternatively, `mummy` can wrap a single `Browser` instance as follows (passing
either a pack or server):

	var Browser = require("zombie");
	var mummy   = require("mummy");

	var browser = new Browser();
	mummy.embalm(server, browser);

## API

### mummy(pack)

 + **pack** -- a `Pack` or `Server` instance to create a `Browser` extension
     for.

Returns a `Browser` extension suitable for passing to `Browser.extend()`.

### mummy.compose(manifest, [ path ], callback)

 + **manifest** -- either a manifest object or a path to a manifest file.
 + **path** -- a path to load relative plugins from. Required if `manifest` is
     an object, but optional if it is a path. If a manifest path is provided
     without a plugin path, plugins will be loaded from the directory that the
     manifest is in.
 + **callback** -- a callback function receiving arguments of the form
     `(error, browser)` depending on if the pack was successfully created.

Create a `Browser` instance for a `pack` defined by the manifest.

### mummy.embalm(pack, browser)

 + **pack** -- a `Pack` or `Server` instance to inject requests into.
 + **browser** -- a `Browser` instance to augment with request redirection.

Returns the original `Browser` instance after it has been augmented to redirect
requests to the pack.

[hapi]: https://github.com/spumko/hapi "Hapi"
[zombie]: https://github.com/assaf/zombie "Zombie.js"
[zombie-ext]: https://github.com/assaf/zombie/tree/master/doc/new#extending-the-browser "Zombie Extensions"
