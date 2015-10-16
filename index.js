#!/usr/bin/env node --harmony

var doc = `
Usage:
  source-map-explorer [--json] <script.js> [<script.js.map>]

  If the script file has an inline source map, you may omit the map parameter.

Options:
  --json     Output JSON (on stdout) instead of generating HTML
             and opening the browser.
  -h --help  Show this screen.
  --version  Show version.
`;


var fs = require('fs'),
    path = require('path'),
    sourcemap = require('source-map'),
    convert = require('convert-source-map'),
    temp = require('temp'),
    open = require('open'),
    _ = require('underscore'),
    docopt = require('docopt').docopt;

function computeGeneratedFileSizes(sourcemap, generatedJs) {
  var lines = generatedJs.split('\n');
  var sourceExtrema = {};  // source -> {min: num, max: num}
  var numChars = 0;
  var lastSource = null;
  for (var line = 1; line <= lines.length; line++) {
    var lineText = lines[line - 1];
    var numCols = lineText.length;
    for (var column = 0; column < numCols; column++, numChars++) {
      var pos = sourcemap.originalPositionFor({line:line, column:column});
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
  return _.mapObject(sourceExtrema, v => v.max - v.min + 1);
}

function loadSourceMap(jsFile, mapFile) {
  var sourcemapData = fs.readFileSync(mapFile).toString();
  var jsData = fs.readFileSync(jsFile).toString();

  var mapConsumer = new sourcemap.SourceMapConsumer(sourcemapData);

  return {mapConsumer, jsData};
}

var args = docopt(doc, {version: '0.1'});
var data = loadSourceMap(args['<script.js>'], args['<script.js.map>']),
    mapConsumer = data.mapConsumer,
    jsData = data.jsData;

var sizes = computeGeneratedFileSizes(mapConsumer, jsData);

if (args['--json']) {
  console.log(JSON.stringify(sizes, null, '  '));
  process.exit(0);
}

var html = fs.readFileSync(path.join(__dirname, 'tree-viz.html')).toString();

html = html.replace('INSERT TREE HERE', JSON.stringify(sizes, null, '  '));

var tempName = temp.path({suffix: '.html'});
fs.writeFileSync(tempName, html);
open(tempName);
