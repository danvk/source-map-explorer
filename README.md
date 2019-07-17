[![Build Status](https://travis-ci.org/danvk/source-map-explorer.svg?branch=v1.1.0)](https://travis-ci.org/danvk/source-map-explorer) [![NPM version](http://img.shields.io/npm/v/source-map-explorer.svg)](https://www.npmjs.org/package/source-map-explorer)
[![Coverage Status](https://coveralls.io/repos/github/danvk/source-map-explorer/badge.svg)](https://coveralls.io/github/danvk/source-map-explorer)
# source-map-explorer
Analyze and debug JavaScript (or Sass or LESS) code bloat through source maps.

The source map explorer determines which file each byte in your minified code came from. It shows you a [treemap][] visualization to help you debug where all the code is coming from. Check out this [Chrome Developer video][video] (3:25) for a demo of the tool in action.

Install:

    npm install -g source-map-explorer

Use (you can specify filenames or use [glob](https://github.com/isaacs/node-glob) pattern):

    source-map-explorer bundle.min.js
    source-map-explorer bundle.min.js bundle.min.js.map
    source-map-explorer bundle.min.js*
    source-map-explorer *.js

This will open up a visualization of how the space is used in your minified bundle:

<img src="screenshot.png">

Here's a [demo][] with a more complex bundle.

Here's [another demo][] where you can see a bug: there are two copies of React
in the bundle (perhaps because of out-of-date dependencies).

## Requirements

- Node 10 or later

## Options

### Default behavior - write HTML to a temp file and open it in your browser
```
source-map-explorer foo.min.js
```

### Write output in specific formats to stdout
```
source-map-explorer foo.min.js --html
source-map-explorer foo.min.js --json
source-map-explorer foo.min.js --tsv
```

### Write output in specific formats to a file
```
source-map-explorer foo.min.js --html result.html
source-map-explorer foo.min.js --json result.json
source-map-explorer foo.min.js --tsv result.tsv
```

* `--json`: output JSON instead of displaying a visualization:

    ```
    source-map-explorer foo.min.js --json
    {
      "results": [
        {
          "bundleName": "tests/data/foo.min.js",
          "totalBytes": 697,
          "unmappedBytes": 0,
          "files": {
            "node_modules/browserify/node_modules/browser-pack/_prelude.js": 463,
            "dist/bar.js": 97,
            "dist/foo.js": 137,
            "<unmapped>": 0
          }
        }
      ]
    }
    ```

* `--tsv`: output tab-delimited values instead of displaying a visualization:

    ```
    source-map-explorer foo.min.js --tsv
    Source  Size
    node_modules/browserify/node_modules/browser-pack/_prelude.js  463
    dist/foo.js  137
    dist/bar.js  97
    <unmapped>  0
    ```

    If you just want a list of files, you can do `source-map-explorer foo.min.js --tsv | sed 1d | cut -f1`.

* `--html`: output HTML to stdout. If you want to save the output (e.g. to share), specify filename after `--html`:

    ```
    source-map-explorer foo.min.js --html tree.html
    ```

* `-m`, `--only-mapped`: exclude "unmapped" bytes from the output. This will result in total counts less than the file size.

* `--replace`, `--with`: The paths in source maps sometimes have artifacts that are difficult to get rid of. These flags let you do simple find & replaces on the paths. For example:

    ```
    source-map-explorer foo.min.js --replace 'dist/' --with ''
    ```

    You can specify these flags multiple times. Be aware that the find/replace is done _after_ eliminating shared prefixes between paths.

    These are regular expressions.

* `--no-root`: By default, source-map-explorer finds common prefixes between all source files and eliminates them, since they add complexity to the visualization with no real benefit. But if you want to disable this behavior, set the `--no-root` flag.

See more at [wiki page][cli wiki]

## API
### `explore(bundlesAndFileTokens, [options])`
`bundlesAndFileTokens`:
* Glob: `dist/js/*.*`
* Filename: `dist/js/chunk.1.js`
* Bundle: `{ code: 'dist/js/chunk.1.js', map: 'dist/js/chunk.1.js.map' }` or `{ code: fs.readFileSync('dist/js/chunk.2.js') }`
* Array of globs, filenames and bundles:
   ```
   [
     'dist/js/chunk.2.*',
     'dist/js/chunk.1.js', 'dist/js/chunk.1.js.map',
     { code: 'dist/js/chunk.3.js', map: 'dist/js/chunk.3.js.map' }
   ]
   ```  
`options`:
* `onlyMapped`: [boolean] (default `false`) - Exclude "unmapped" bytes from the output. This will result in total counts less than the file size
* `output`: [Object] - Output options
    * `format`: [string] - `'json'`, `'tsv'` or `'html'`
    * `filename`: [string] - Filename to save output to
* `noRoot`: [boolean] (default `false`) - See `--no-root` option above for details
* `replaceMap`: <[Object]<{ [from: [string]]: [string] }>> - Mapping for replacement, see `--replace`, `--with` options above for details.

Example:
```javascript
import { explore } from 'source-map-explorer'
// or import explore from 'source-map-explorer'

explore('tests/data/foo.min.js', { output: { format: 'html' } }).then()

// Returns
{
  bundles: [{
    bundleName: 'tests/data/foo.min.js',
    totalBytes: 697,
    unmappedBytes: 0,
    files: {
      'node_modules/browserify/node_modules/browser-pack/_prelude.js': 463,
      'dist/bar.js': 97,
      'dist/foo.js': 137,
      '<unmapped>': 0
    }
  }],
  output: '<!doctype html>...',
  errors: []
}
```

See more at [wiki page][api wiki]

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
[video]: https://www.youtube.com/watch?v=7aY9BoMEpG8
[boolean]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Boolean_type "Boolean"
[Buffer]: https://nodejs.org/api/buffer.html#buffer_class_buffer "Buffer"
[Object]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object "Object"
[string]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#String_type "String"
[number]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Number_type "Number"
[cli wiki]: https://github.com/danvk/source-map-explorer/wiki/CLI
[api wiki]: https://github.com/danvk/source-map-explorer/wiki/Node.js-API
