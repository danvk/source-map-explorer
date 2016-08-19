[![Build Status](https://travis-ci.org/danvk/source-map-explorer.svg?branch=v1.1.0)](https://travis-ci.org/danvk/source-map-explorer) [![NPM version](http://img.shields.io/npm/v/source-map-explorer.svg)](https://www.npmjs.org/package/source-map-explorer)
# source-map-explorer
Analyze and debug JavaScript code bloat through source maps.

The source map explorer determines which file each byte in your minified JS came from. It shows you a [treemap][] visualization to help you debug where all the code is coming from.

Install:

    npm install -g source-map-explorer

Use:

    source-map-explorer bundle.min.js
    source-map-explorer bundle.min.js bundle.min.js.map

This will open up a visualization of how the space is used in your minified bundle:

<img src="screenshot.png">

Here's a [demo][] with a more complex bundle.

Here's [another demo][] where you can see a bug: there are two copies of React
in the bundle (perhaps because of out-of-date dependencies).

## Options

* `--json`: output JSON instead of displaying a visualization:

    ```
    source-map-explorer --json foo.min.js
    {
      "node_modules/browserify/node_modules/browser-pack/_prelude.js": 463,
      "bar.js": 62,
      "foo.js": 137
    }
    ```

* `--tsv`: output tab-delimited values instead of displaying a visualization:

    ```
    source-map-explorer --tsv foo.min.js
    Source	Size
    dist/bar.js	62
    dist/foo.js	137
    ```

    If you just want a list of files, you can do `source-map-explorer --tsv foo.min.js | sed 1d | cut -f1`.

* `--html`: output HTML to stdout. By default, source-map-explorer writes HTML to a temporary file and opens it in your default browser. If you want to save the output (e.g. to share), pipe it to a file:

    ```
    source-map-explorer --html foo.min.js > tree.html
    ```

* `--replace`, `--with`: The paths in source maps sometimes have artifacts that are difficult to get rid of. These flags let you do simple find & replaces on the paths. For example:

    ```
    source-map-explorer foo.min.js --replace 'dist/' --with ''
    ```

    You can specify these flags multiple times. Be aware that the find/replace is done _after_ eliminating shared prefixes between paths.

    These are regular expressions.

* `--noroot`: By default, source-map-explorer finds common prefixes between all source files and eliminates them, since they add complexity to the visualization with no real benefit. But if you want to disable this behavior, set the `--noroot` flag.

## Generating source maps

For source-map-explorer to be useful, you need to generate a source map which
maps positions in your minified file all the way back to the files from which
they came.

If you use [browserify][], you can generate a JavaScript file with an [inline
source map][inline] using the `--debug` flag:

    browserify -r .:foo --debug -o foo.bundle.js
    source-map-explorer foo.bundle.js

If you subsequently minify your JavaScript, you'll need to ensure that the
final source map goes all the way back to the original files. For example,
using browserify, [uglify][] and [exorcist][]:

```bash
browserify -r .:foo --debug -o foo.bundle.js
# foo.bundle.js has an inline source map
cat foo.bundle.js | exorcist foo.bundle.js.map > /dev/null
# foo.bundle.js.map is an external source map for foo.bundle.js
uglifyjs -c -m \
  --in-source-map foo.bundle.js.map \
  --source-map foo.min.js.map \
  -o foo.min.js \
  foo.bundle.js
# foo.min.js has an external source map in foo.min.js.map
source-map-explorer foo.min.js
```

## Types of source maps

There are two types of source maps: inline and external.

If your JS file has an inline source map, then its last line will look
something like this:

```
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJm...
```

This encodes the sourcemap as a base64 data URL. If your file has an inline
source map, the source-map-explorer should have no trouble understanding it.

If your last line instead looks like this:

```
//# sourceMappingURL=foo.min.js.map
```

Then the source map lives in an external `.map` file. The source-map-explorer
will try to find this file, but this often fails because it's unclear what the
URL is relative to.

If this happens, just pass in the source map explicitly, e.g. (in bash or zsh):

```
source-map-explorer path/to/foo.min.js{,.map}
```


[demo]: https://cdn.rawgit.com/danvk/source-map-explorer/08b0e130cb9345f9061760bf8a8d9136ea60b457/demo.html
[another demo]: https://cdn.rawgit.com/danvk/source-map-explorer/08b0e130cb9345f9061760bf8a8d9136ea60b457/demo-bug.html
[browserify]: http://browserify.org/
[uglify]: https://github.com/mishoo/UglifyJS2
[exorcist]: https://github.com/thlorenz/exorcist
[inline]: /README.md#types-of-source-maps
[treemap]: https://github.com/martine/webtreemap
