#!/usr/bin/env node

var doc = [
'Analyze and debug space usage through source maps.',
'',
'Usage:',
'  source-map-explorer <script.js> [<script.js.map>]',
'  source-map-explorer [--json | --html | --tsv] <script.js> [<script.js.map>] [--replace=BEFORE --with=AFTER]... [--noroot]',
'  source-map-explorer -h | --help | --version',
'',
'If the script file has an inline source map, you may omit the map parameter.',
'',
'Options:',
'  -h --help  Show this screen.',
'  --version  Show version.',
'',
'     --json  Output JSON (on stdout) instead of generating HTML',
'             and opening the browser.',
'     --tsv   Output TSV (on stdout) instead of generating HTML',
'             and opening the browser.',
'     --html  Output HTML (on stdout) rather than opening a browser.',
'',
'   --noroot  To simplify the visualization, source-map-explorer',
'             will remove any prefix shared by all sources. If you',
'             wish to disable this behavior, set --noroot.',
'',
'  --replace=BEFORE  Apply a simple find/replace on source file',
'                    names. This can be used to fix some oddities',
'                    with paths which appear in the source map',
'                    generation process.  Accepts regular expressions.',
'      --with=AFTER  See --replace.',
].join('\n');

var fs = require('fs'),
    path = require('path'),
    sourcemap = require('source-map'),
    convert = require('convert-source-map'),
    temp = require('temp'),
    open = require('open'),
    _ = require('underscore'),
    docopt = require('docopt').docopt,
    fileURL = require('file-url'),
    btoa = require('btoa');

function computeGeneratedFileSizes(mapConsumer, generatedJs) {
  var lines = generatedJs.split('\n');
  var sourceExtrema = {};  // source -> {min: num, max: num}
  var numChars = 0;
  var lastSource = null;
  for (var line = 1; line <= lines.length; line++) {
    var lineText = lines[line - 1];
    var numCols = lineText.length;
    for (var column = 0; column < numCols; column++, numChars++) {
      var pos = mapConsumer.originalPositionFor({line:line, column:column});
      var source = pos.source;
      if (source == null) {
        // Often this is from the '// #sourceMap' comment itself.
        continue;
      }

      if (source != lastSource) {
        if (!(source in sourceExtrema)) {
          sourceExtrema[source] = {min: numChars};
          lastSource = source;
        } else {
          // source-map reports odd positions for bits between files.
        }
      } else {
        sourceExtrema[source].max = numChars;
      }
    }
  }
  return _.mapObject(sourceExtrema, function(v) {
    return v.max - v.min + 1
  });
}

var SOURCE_MAP_INFO_URL = 'https://github.com/danvk/source-map-explorer/blob/master/README.md#generating-source-maps';

function loadSourceMap(jsFile, mapFile) {
  var jsData = fs.readFileSync(jsFile).toString();

  var mapConsumer;
  if (mapFile) {
    var sourcemapData = fs.readFileSync(mapFile).toString();
    mapConsumer = new sourcemap.SourceMapConsumer(sourcemapData);
  } else {
    // Try to read a source map from a 'sourceMappingURL' comment.
    var converter = convert.fromSource(jsData);
    if (!converter) {
      converter = convert.fromMapFileSource(jsData, path.dirname(jsFile));
    }
    if (!converter) {
      console.error('Unable to find a source map.');
      console.error('See ', SOURCE_MAP_INFO_URL);
      return null;
    }
    mapConsumer = new sourcemap.SourceMapConsumer(converter.toJSON());
  }

  if (!mapConsumer) {
    console.error('Unable to find a source map.');
    console.error('See ', SOURCE_MAP_INFO_URL);
    return null;
  }

  return {
    mapConsumer: mapConsumer,
    jsData: jsData
  };
}

// See http://stackoverflow.com/a/1917041/388951
function commonPathPrefix(array){
  if (array.length == 0) return '';
  var A= array.concat().sort(),
  a1= A[0].split(/(\/)/), a2= A[A.length-1].split(/(\/)/), L= a1.length, i= 0;
  while(i<L && a1[i] === a2[i]) i++;
  return a1.slice(0, i).join('');
}

// Apply a transform to the keys of an object, leaving the values unaffected.
function mapKeys(obj, fn) {
  return _.object(_.map(obj, function(v, k) { return [fn(k), v]; }));
}

function adjustSourcePaths(sizes, findRoot, finds, replaces) {
  if (findRoot) {
    var prefix = commonPathPrefix(_.keys(sizes));
    var len = prefix.length;
    if (len) {
      sizes = mapKeys(sizes, function(source) { return source.slice(len); })
    }
  }

  for (var i = 0; i < finds.length; i++) {
    var before = new RegExp(finds[i]),
        after = replaces[i];
    sizes = mapKeys(sizes, function(source) {
      return source.replace(before, after);
    });
  }

  return sizes;
}

function validateArgs(args) {
  if (args['--replace'].length != args['--with'].length) {
    console.error('--replace flags must be paired with --with flags.');
    process.exit(1);
  }
}


if (require.main === module) {

var args = docopt(doc, {version: '1.3.3'});
validateArgs(args);
var data = loadSourceMap(args['<script.js>'], args['<script.js.map>']);
if (!data) {
  process.exit(1);
}
var mapConsumer = data.mapConsumer,
    jsData = data.jsData;

var sizes = computeGeneratedFileSizes(mapConsumer, jsData);

if (_.size(sizes) == 1) {
  console.error('Your source map only contains one source (',
                _.keys(sizes)[0], ')');
  console.error("This typically means that your source map doesn't map all the way back to the original sources.");
  console.error("This can happen if you use browserify+uglifyjs, for example, and don't set the --in-source-map flag to uglify.");
  console.error('See ', SOURCE_MAP_INFO_URL);
  process.exit(1);
}

sizes = adjustSourcePaths(sizes, !args['--noroot'], args['--replace'], args['--with']);

if (args['--json']) {
  console.log(JSON.stringify(sizes, null, '  '));
  process.exit(0);
}

if (args['--tsv']) {
  console.log('Source\tSize');
  _.each(sizes, function(source, size) { console.log(size + '\t' + source); })
  process.exit(0);
}

var assets = {
  underscoreJs: btoa(fs.readFileSync(require.resolve('underscore'))),
  prettyBytesJs: btoa(fs.readFileSync(require.resolve('./vendor/prettybytes.js'))),
  webtreemapJs: btoa(fs.readFileSync(require.resolve('./vendor/webtreemap.js'))),
  webtreemapCss: btoa(fs.readFileSync(require.resolve('./vendor/webtreemap.css'))),
};

var html = fs.readFileSync(path.join(__dirname, 'tree-viz.html')).toString();

html = html.replace('INSERT TREE HERE', JSON.stringify(sizes, null, '  '))
           .replace('INSERT TITLE HERE', args['<script.js>'])
           .replace('INSERT underscore.js HERE', 'data:application/javascript;base64,' + assets.underscoreJs)
           .replace('INSERT prettybytes.js HERE', 'data:application/javascript;base64,' + assets.prettyBytesJs)
           .replace('INSERT webtreemap.js HERE', 'data:application/javascript;base64,' + assets.webtreemapJs)
           .replace('INSERT webtreemap.css HERE', 'data:text/css;base64,' + assets.webtreemapCss);

if (args['--html']) {
  console.log(html);
  process.exit(0);
}

var tempName = temp.path({suffix: '.html'});
fs.writeFileSync(tempName, html);
open(tempName, function(error) {
  if (!error) return;
  console.error('Unable to open web browser.');
  console.error('Either run with --html, --json or --tsv, or view HTML for the visualization at:');
  console.error(tempName);
});

}

// Exports are here mostly for testing.
module.exports = {
  loadSourceMap: loadSourceMap,
  computeGeneratedFileSizes: computeGeneratedFileSizes,
  adjustSourcePaths: adjustSourcePaths,
  mapKeys: mapKeys,
  commonPathPrefix: commonPathPrefix
};
