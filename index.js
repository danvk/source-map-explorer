#!/usr/bin/env node

var doc = [
  'Analyze and debug space usage through source maps.',
  '',
  'Usage:',
  '  source-map-explorer <script.js> [<script.js.map>]',
  '  source-map-explorer [--json | --html | --tsv] [-m | --only-mapped] <script.js> [<script.js.map>] [--replace=BEFORE --with=AFTER]... [--noroot]',
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
  '  -m --only-mapped  Exclude "unmapped" bytes from the output.',
  '                    This will result in total counts less than the file size',
  '',
  '',
  '   --noroot  To simplify the visualization, source-map-explorer',
  '             will remove any prefix shared by all sources. If you',
  '             wish to disable this behavior, set --noroot.',
  '',
  '  --replace=BEFORE  Apply a simple find/replace on source file',
  '                    names. This can be used to fix some oddities',
  '                    with paths which appear in the source map',
  '                    generation process.  Accepts regular expressions.',
  '      --with=AFTER  See --replace.'
].join('\n');

var fs = require('fs'),
  glob = require('glob'),
  path = require('path'),
  sourcemap = require('source-map'),
  convert = require('convert-source-map'),
  temp = require('temp'),
  open = require('opn'),
  _ = require('underscore'),
  docopt = require('docopt').docopt,
  btoa = require('btoa');

function computeSpans(mapConsumer, generatedJs) {
  var lines = generatedJs.split('\n');
  var spans = [];
  var numChars = 0;
  var lastSource = false;  // not a string, not null.
  for (var line = 1; line <= lines.length; line++) {
    var lineText = lines[line - 1];
    var numCols = lineText.length;
    for (var column = 0; column < numCols; column++, numChars++) {
      var pos = mapConsumer.originalPositionFor({line:line, column:column});
      var source = pos.source;

      if (source !== lastSource) {
        lastSource = source;
        spans.push({source: source, numChars: 1});
      } else {
        spans[spans.length - 1].numChars += 1;
      }
    }
  }
  return spans;
}

var UNMAPPED = '<unmapped>';

/**
 * Calculate the number of bytes contributed by each source file.
 * @returns {
 *  files: {[sourceFile: string]: number},
 *  unmappedBytes: number,
 *  totalBytes: number
 * }
 */
function computeGeneratedFileSizes(mapConsumer, generatedJs) {
  var spans = computeSpans(mapConsumer, generatedJs);

  var unmappedBytes = 0;
  var files = {};
  var totalBytes = 0;
  for (var i = 0; i < spans.length; i++) {
    var span = spans[i];
    var numChars = span.numChars;
    totalBytes += numChars;
    if (span.source === null) {
      unmappedBytes += numChars;
    } else {
      files[span.source] = (files[span.source] || 0) + span.numChars;
    }
  }
  return {
    files: files,
    unmappedBytes: unmappedBytes,
    totalBytes: totalBytes
  };
}

var SOURCE_MAP_INFO_URL = 'https://github.com/danvk/source-map-explorer/blob/master/README.md#generating-source-maps';

function loadSourceMap(jsFile, mapFile) {
  var jsData;
  if(Buffer.isBuffer(jsFile)) {
    jsData = jsFile.toString();
  } else {
    jsData = fs.readFileSync(jsFile).toString();
  }

  var mapConsumer;
  if (mapFile) {
    var sourcemapData;
    if(Buffer.isBuffer(mapFile)) {
      sourcemapData = mapFile.toString();
    } else {
      sourcemapData = fs.readFileSync(mapFile).toString();
    }
    mapConsumer = new sourcemap.SourceMapConsumer(sourcemapData);
  } else {
    // Try to read a source map from a 'sourceMappingURL' comment.
    var converter = convert.fromSource(jsData);
    if (!converter && !Buffer.isBuffer(jsFile)) {
      converter = convert.fromMapFileSource(jsData, path.dirname(jsFile));
    }
    if (!converter) {
      throw new Error('Unable to find a source map.\nSee ' + SOURCE_MAP_INFO_URL);
    }
    mapConsumer = new sourcemap.SourceMapConsumer(converter.toJSON());
  }

  if (!mapConsumer) {
    throw new Error('Unable to find a source map.\nSee ' + SOURCE_MAP_INFO_URL);
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

function adjustSourcePaths(sizes, findRoot, replace) {
  if (findRoot) {
    var prefix = commonPathPrefix(_.keys(sizes));
    var len = prefix.length;
    if (len) {
      sizes = mapKeys(sizes, function(source) { return source.slice(len); });
    }
  }

  if(!replace) {
    replace = {};
  }

  var finds = Object.keys(replace);

  for (var i = 0; i < finds.length; i++) {
    var before = new RegExp(finds[i]),
      after = replace[finds[i]];
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

// On Windows, it's helpful if source-map-explorer can expand globs itself.
// See https://github.com/danvk/source-map-explorer/issues/52
function expandGlob(args) {
  var arg1 = args['<script.js>'];
  var arg2 = args['<script.js.map>'];
  if (arg1 && !arg2) {
    var files = glob.sync(arg1);
    if (files.length > 2) {
      throw new Error(
        'Glob should match exactly 2 files but matched ' + files.length + ' ' + arg1);
    } else if (files.length === 2) {
      // allow the JS and source map file to match in either order.
      if (files[0].indexOf('.map') >= 0) {
        var tmp = files[0];
        files[0] = files[1];
        files[1] = tmp;
      }
      args['<script.js>'] = files[0];
      args['<script.js.map>'] = files[1];
    }
  }
  return args;
}

function generateHtml(files, title) {
  var assets = {
    underscoreJs: btoa(fs.readFileSync(require.resolve('underscore'))),
    webtreemapJs: btoa(fs.readFileSync(require.resolve('./vendor/webtreemap.js'))),
    webtreemapCss: btoa(fs.readFileSync(require.resolve('./vendor/webtreemap.css')))
  };

  var html = fs.readFileSync(path.join(__dirname, 'tree-viz.html')).toString();

  html = html.replace('INSERT TREE HERE', JSON.stringify(files, null, '  '))
    .replace('INSERT TITLE HERE', title || '')
    .replace('INSERT underscore.js HERE', 'data:application/javascript;base64,' + assets.underscoreJs)
    .replace('INSERT webtreemap.js HERE', 'data:application/javascript;base64,' + assets.webtreemapJs)
    .replace('INSERT webtreemap.css HERE', 'data:text/css;base64,' + assets.webtreemapCss);

  return html;
}

function explore(code, map, options) {
  if(typeof options === 'undefined') {
    if(typeof map === 'object' && !Buffer.isBuffer(map)) {
      options = map;
      map = undefined;
    }
  }

  if(!options) {
    options = {};
  }

  var data = loadSourceMap(code, map);
  if (!data) {
    throw new Error('Failed to load script and sourcemap');
  }

  var mapConsumer = data.mapConsumer,
    jsData = data.jsData;

  var sizes = computeGeneratedFileSizes(mapConsumer, jsData);
  var files = sizes.files;

  if (_.size(files) == 1) {
    var error = 'Your source map only contains one source (' + _.keys(files)[0] + ')\n';
    error += 'This typically means that your source map doesn\'t map all the way back to the original sources.\n';
    error += 'This can happen if you use browserify+uglifyjs, for example, and don\'t set the --in-source-map flag to uglify.\n';
    error += 'See ' + SOURCE_MAP_INFO_URL;
    throw new Error(error);
  }

  files = adjustSourcePaths(files, !options.noRoot, options.replace);

  var onlyMapped = options.onlyMapped;
  var unmappedBytes = sizes.unmappedBytes;
  if (!onlyMapped) {
    files[UNMAPPED] = unmappedBytes;
  }

  if(!options.html) {
    return {
      totalBytes: sizes.totalBytes,
      unmappedBytes: unmappedBytes,
      files: files,
    };
  }

  var title = Buffer.isBuffer(code) ? 'Buffer' : code;

  return {
    totalBytes: sizes.totalBytes,
    unmappedBytes: unmappedBytes,
    files: files,
    html: generateHtml(files, title),
  };
}

if (require.main === module) {
  var args = docopt(doc, {version: '1.6.0'});
  expandGlob(args);
  validateArgs(args);

  var html = true;

  if(args['--json'] || args['--tsv']) {
    html = false;
  }

  var replace = {};
  var argsReplace = args['--replace'];
  var argsWith = args['--with'];
  if(argsReplace && argsWith) {
    for(var replaceIndex = 0; replaceIndex < argsReplace.length; replaceIndex += 1) {
      replace[argsReplace[replaceIndex]] = argsWith[replaceIndex];
    }
  }

  try {
    var data = explore(
      args['<script.js>'],
      args['<script.js.map>'],
      {
        onlyMapped: args['--only-mapped'] || args['-m'],
        html: html,
        noRoot: args['--noroot'],
        replace: replace,
      }
    );
  } catch(err) {
    if(err.code === 'ENOENT') {
      console.error('File not found! -- ', err.message);
      process.exit(1);
    } else {
      console.error(err.message);
      process.exit(1);
    }
  }

  var unmappedBytes = data.files[UNMAPPED];
  if (unmappedBytes) {
    var totalBytes = data.totalBytes;
    var pct = 100 * unmappedBytes / totalBytes;
    console.warn(
      'Unable to map', unmappedBytes, '/', totalBytes,
      'bytes (' + pct.toFixed(2) + '%)');
  }


  if(args['--json']) {
    console.log(JSON.stringify(data.files, null, '  '));
    process.exit(0);
  }

  if(args['--tsv']) {
    console.log('Source\tSize');
    _.each(data.files, function(source, size) { console.log(size + '\t' + source); });
    process.exit(0);
  }

  if (args['--html']) {
    console.log(data.html);
    process.exit(0);
  }

  var tempName = temp.path({suffix: '.html'});
  fs.writeFileSync(tempName, data.html);
  open(tempName, function(error) {
    if (!error) return;
    console.error('Unable to open web browser.');
    console.error('Either run with --html, --json or --tsv, or view HTML for the visualization at:');
    console.error(tempName);
  });
}

module.exports = explore;
module.exports.generateHtml = generateHtml;

// Exports are here mostly for testing.
module.exports.loadSourceMap = loadSourceMap;
module.exports.computeGeneratedFileSizes = computeGeneratedFileSizes;
module.exports.adjustSourcePaths = adjustSourcePaths;
module.exports.mapKeys = mapKeys;
module.exports.commonPathPrefix = commonPathPrefix;
module.exports.expandGlob = expandGlob;