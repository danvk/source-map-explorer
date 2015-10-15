#!/usr/bin/env node
var fs = require('fs'),
    path = require('path'),
    sourcemap = require('source-map'),
    convert = require('convert-source-map'),
    _ = require('underscore');

var sourcemapFile = process.argv[2],
    jsFile = process.argv[3];

var sourcemapData = fs.readFileSync(sourcemapFile).toString();
var jsData = fs.readFileSync(process.argv[3]).toString();

var sourcemap = new sourcemap.SourceMapConsumer(sourcemapData);
sourcemap.computeColumnSpans();

var lines = jsData.split('\n');
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
var sizes = _.mapObject(sourceExtrema, function(v) {
  return v.max - v.min + 1;
});

var html = fs.readFileSync(path.join(__dirname, 'tree-viz.html')).toString();

html = html.replace('INSERT TREE HERE', JSON.stringify(sizes, null, '  '));

console.log(html);
