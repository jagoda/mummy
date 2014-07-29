mummy
=====

[![Build Status](https://travis-ci.org/jagoda/mummy.svg?branch=master)](https://travis-ci.org/jagoda/mummy)

> [Hapi][hapi] request mocking for [Zombie.js][zombie]

## Overview

`mummy` is a browser extension for the [Zombie.js][zombie] headless browser
testing framework that allows using `Browser` objects with [Hapi][hapi] servers
without having to start the server.

	npm install mummy

	var Browser = require("zombie");
	var mummy   = require("mummy");
	var browser;
	
	Browser.extend(mummy(server));
	browser = new Browser();

## Extending the Browser API

`zombie` provides an [extension API][zombie-ext] that allows all new `Browser`
objects to be augmented with additional functionality. Using this approach,
`mummy` will cause all `Browser` objects to direct their requests to the wrapped
`hapi` server.

	var Browser = require("zombie");
	var mummy   = require("mummy");
	var browser;
	
	Browser.extend(mummy(server));
	browser = new Browser();

## Wrapping a Single Browser

Alternatively, `mummy` can wrap a single `Browser` instance as follows:

	var Browser = require("zombie");
	var mummy   = require("mummy");

	var browser = new Browser();
	mummy.embalm(server, browser);

[hapi]: https://github.com/spumko/hapi "Hapi"
[zombie]: https://github.com/assaf/zombie "Zombie.js"
