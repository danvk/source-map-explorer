#!/usr/bin/env node

const fs = require('fs'),
  fse = require('fs-extra'),
  os = require('os'),
  glob = require('glob'),
  path = require('path'),
  SourceMapConsumer = require('source-map').SourceMapConsumer,
  convert = require('convert-source-map'),
  temp = require('temp'),
  ejs = require('ejs'),
  open = require('opn'),
  docopt = require('docopt').docopt,
  btoa = require('btoa'),
  packageJson = require('./package.json');

const doc = [
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
  '  --json  Output JSON (on stdout) instead of generating HTML',
  '          and opening the browser.',
  '  --tsv   Output TSV (on stdout) instead of generating HTML',
  '          and opening the browser.',
  '  --html  Output HTML (on stdout) rather than opening a browser.',
  '',
  '  -m --only-mapped  Exclude "unmapped" bytes from the output.',
  '                    This will result in total counts less than the file size',
  '',
  '',
  '  --noroot  To simplify the visualization, source-map-explorer',
  '            will remove any prefix shared by all sources. If you',
  '            wish to disable this behavior, set --noroot.',
  '',
  '  --replace=BEFORE  Apply a simple find/replace on source file',
  '                    names. This can be used to fix some oddities',
  '                    with paths which appear in the source map',
  '                    generation process.  Accepts regular expressions.',
  '  --with=AFTER  See --replace.',
].join('\n');

/**
 * @typedef {Object} Args
 * @property {string} `<script.js>` - Path to code file or Glob matching bundle files
 * @property {(string|null)} `<script.js.map>` - Path to map file
 * @property {boolean} `--json`
 * @property {boolean} `--html`
 * @property {boolean} `--tsv`
 * @property {boolean}  `--only-mapped`
 * @property {boolean}  `-m`
 * @property {string[]} `--replace`
 * @property {string[]} `--with`
 * @property {boolean} `--noroot`
 */

/**
 * @typedef {Object.<string, number>} FileSizeMap
 */

const helpers = {
  /**
   * @param {(Buffer|string)} file Path to file or Buffer
   */
  getFileContent(file) {
    const buffer = Buffer.isBuffer(file) ? file : fs.readFileSync(file);

    return buffer.toString();
  },

  /**
   * Apply a transform to the keys of an object, leaving the values unaffected.
   * @param {Object} obj
   * @param {Function} fn
   */
  mapKeys(obj, fn) {
    return Object.keys(obj).reduce((result, key) => {
      const newKey = fn(key);
      result[newKey] = obj[key];

      return result;
    }, {});
  },

  // https://stackoverflow.com/a/18650828/388951
  formatBytes(bytes, decimals = 2) {
    if (bytes == 0) return '0 B';

    const k = 1000,
      dm = decimals,
      sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'],
      i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
  },
};

function computeSpans(mapConsumer, generatedJs) {
  var lines = generatedJs.split('\n');
  var spans = [];
  var numChars = 0;
  var lastSource = false; // not a string, not null.
  for (var line = 1; line <= lines.length; line++) {
    var lineText = lines[line - 1];
    var numCols = lineText.length;
    for (var column = 0; column < numCols; column++, numChars++) {
      var pos = mapConsumer.originalPositionFor({ line, column });
      var source = pos.source;

      if (source !== lastSource) {
        lastSource = source;
        spans.push({ source, numChars: 1 });
      } else {
        spans[spans.length - 1].numChars += 1;
      }
    }
  }

  return spans;
}

const UNMAPPED = '<unmapped>';

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
    files,
    unmappedBytes,
    totalBytes,
  };
}

const SOURCE_MAP_INFO_URL =
  'https://github.com/danvk/source-map-explorer/blob/master/README.md#generating-source-maps';

/**
 * Get source map
 * @param {(string|Buffer)} jsFile
 * @param {(string|Buffer)} mapFile
 */
function loadSourceMap(jsFile, mapFile) {
  const jsData = helpers.getFileContent(jsFile);

  var mapConsumer;
  if (mapFile) {
    const sourcemapData = helpers.getFileContent(mapFile);
    mapConsumer = new SourceMapConsumer(sourcemapData);
  } else {
    // Try to read a source map from a 'sourceMappingURL' comment.
    let converter = convert.fromSource(jsData);
    if (!converter && !Buffer.isBuffer(jsFile)) {
      converter = convert.fromMapFileSource(jsData, path.dirname(jsFile));
    }
    if (!converter) {
      throw new Error(`Unable to find a source map.${os.EOL}See ${SOURCE_MAP_INFO_URL}`);
    }
    mapConsumer = new SourceMapConsumer(converter.toJSON());
  }

  if (!mapConsumer) {
    throw new Error(`Unable to find a source map.${os.EOL}See ${SOURCE_MAP_INFO_URL}`);
  }

  return {
    mapConsumer,
    jsData,
  };
}

/**
 * Find common path prefix
 * @see http://stackoverflow.com/a/1917041/388951
 * @param {string[]} array List of filenames
 */
function commonPathPrefix(array) {
  if (array.length === 0) return '';

  const A = array.concat().sort(),
    a1 = A[0].split(/(\/)/),
    a2 = A[A.length - 1].split(/(\/)/),
    L = a1.length;

  let i = 0;

  while (i < L && a1[i] === a2[i]) i++;

  return a1.slice(0, i).join('');
}

function adjustSourcePaths(sizes, findRoot, replace) {
  if (findRoot) {
    var prefix = commonPathPrefix(Object.keys(sizes));
    var len = prefix.length;
    if (len) {
      sizes = helpers.mapKeys(sizes, function(source) {
        return source.slice(len);
      });
    }
  }

  if (!replace) {
    replace = {};
  }

  var finds = Object.keys(replace);

  for (var i = 0; i < finds.length; i++) {
    var before = new RegExp(finds[i]),
      after = replace[finds[i]];
    sizes = helpers.mapKeys(sizes, function(source) {
      return source.replace(before, after);
    });
  }

  return sizes;
}

/**
 * Validates CLI arguments
 * @param {Args} args
 */
function validateArgs(args) {
  if (args['--replace'].length !== args['--with'].length) {
    console.error('--replace flags must be paired with --with flags.');
    process.exit(1);
  }
}

/**
 * Covert file size map to webtreemap data
 * @param {FileSizeMap} files
 */
function getWebTreeMapData(files) {
  function newNode(name) {
    return {
      name: name,
      data: {
        $area: 0,
      },
      children: [],
    };
  }

  function addNode(path, size) {
    const parts = path.split('/');
    let node = treeData;

    node.data['$area'] += size;

    parts.forEach(part => {
      let child = node.children.find(child => child.name === part);

      if (!child) {
        child = newNode(part);
        node.children.push(child);
      }

      node = child;
      node.data['$area'] += size;
    });
  }

  function addSizeToTitle(node, total) {
    const size = node.data['$area'],
      pct = (100.0 * size) / total;

    node.name += ` • ${helpers.formatBytes(size)} • ${pct.toFixed(1)}%`;
    node.children.forEach(child => {
      addSizeToTitle(child, total);
    });
  }

  const treeData = newNode('/');

  for (const source in files) {
    addNode(source, files[source]);
  }
  addSizeToTitle(treeData, treeData.data['$area']);

  return treeData;
}

/**
 * @typedef {Object} ExploreBatchResult
 * @property {string} bundleName
 * @property {number} totalBytes
 * @property {FileSizeMap} files
 */

/**
 * Create a combined result where each of the inputs is a separate node under the root.
 * @param {ExploreBatchResult[]} exploreResults
 * @returns ExploreBatchResult
 */
function makeMergedBundle(exploreResults) {
  let totalBytes = 0;
  const files = {};

  // Remove any common prefix to keep the visualization as simple as possible.
  const commonPrefix = commonPathPrefix(exploreResults.map(r => r.bundleName));

  for (const result of exploreResults) {
    totalBytes += result.totalBytes;
    const prefix = result.bundleName.slice(commonPrefix.length);
    Object.keys(result.files).forEach(fileName => {
      const size = result.files[fileName];
      files[prefix + '/' + fileName] = size;
    });
  }

  return {
    bundleName: '[combined]',
    totalBytes,
    files,
  };
}

/**
 * Generate HTML file content for specified files
 * @param {ExploreBatchResult[]} exploreResults
 */
function generateHtml(exploreResults) {
  const assets = {
    webtreemapJs: btoa(fs.readFileSync(require.resolve('./vendor/webtreemap.js'))),
    webtreemapCss: btoa(fs.readFileSync(require.resolve('./vendor/webtreemap.css'))),
  };

  // Create a combined bundle if applicable
  if (exploreResults.length > 1) {
    exploreResults = [makeMergedBundle(exploreResults)].concat(exploreResults);
  }

  // Get bundles info to generate select
  const bundles = exploreResults.map(data => ({
    name: data.bundleName,
    size: helpers.formatBytes(data.totalBytes),
  }));

  // Get webtreemap data to update map on bundle select
  const treeDataMap = exploreResults.reduce((result, data) => {
    result[data.bundleName] = getWebTreeMapData(data.files);

    return result;
  }, {});

  const template = fs.readFileSync(path.join(__dirname, 'tree-viz.ejs')).toString();

  return ejs.render(template, {
    bundles,
    treeDataMap,
    webtreemapJs: assets.webtreemapJs,
    webtreemapCss: assets.webtreemapCss,
  });
}

/**
 * @typedef {Object} ExploreResult
 * @property {number} totalBytes
 * @property {number} unmappedBytes
 * @property {FileSizeMap} files
 * @property {string} [html]
 */

/**
 * Analyze bundle
 * @param {(string|Buffer)} code
 * @param {(string|Buffer)} [map]
 * @param {ExploreOptions} [options]
 * @returns {ExploreResult[]}
 */
function explore(code, map, options) {
  if (typeof options === 'undefined') {
    if (typeof map === 'object' && !Buffer.isBuffer(map)) {
      options = map;
      map = undefined;
    }
  }

  if (!options) {
    options = {};
  }

  const data = loadSourceMap(code, map);
  if (!data) {
    throw new Error('Failed to load script and sourcemap');
  }

  const { mapConsumer, jsData } = data;

  const sizes = computeGeneratedFileSizes(mapConsumer, jsData);
  let files = sizes.files;

  const filenames = Object.keys(files);
  if (filenames.length === 1) {
    const errorMessage = [
      `Your source map only contains one source (${filenames[0]})`,
      "This can happen if you use browserify+uglifyjs, for example, and don't set the --in-source-map flag to uglify.",
      `See ${SOURCE_MAP_INFO_URL}`,
    ].join(os.EOL);

    throw new Error(errorMessage);
  }

  files = adjustSourcePaths(files, !options.noRoot, options.replace);

  const { totalBytes, unmappedBytes } = sizes;

  if (!options.onlyMapped) {
    files[UNMAPPED] = unmappedBytes;
  }

  const result = {
    totalBytes,
    unmappedBytes,
    files,
  };

  if (options.html) {
    const title = Buffer.isBuffer(code) ? 'Buffer' : code;
    result.html = generateHtml([
      {
        files,
        totalBytes,
        bundleName: title,
      },
    ]);
  }

  return result;
}

/**
 * Wrap `explore` with Promise
 * @param {Bundle} bundle
 * @returns {Promise<ExploreBatchResult>}
 */
function explorePromisified({ codePath, mapPath }) {
  return new Promise(resolve => {
    const result = explore(codePath, mapPath);

    resolve({
      ...result,
      bundleName: codePath,
    });
  });
}

/**
 * @typedef {Object} Bundle
 * @property {string} codePath Path to code file
 * @property {string} mapPath Path to map file
 */

/**
 * Expand codePath and mapPath into a list of { codePath, mapPath } pairs
 * @see https://github.com/danvk/source-map-explorer/issues/52
 * @param {string} codePath Path to bundle file or glob matching bundle files
 * @param {string} [mapPath] Path to bundle map file
 * @returns {Bundle[]}
 */
function getBundles(codePath, mapPath) {
  if (codePath && mapPath) {
    return [
      {
        codePath,
        mapPath,
      },
    ];
  }

  const filenames = glob.sync(codePath);

  const mapFilenames = glob.sync(codePath + '.map');

  return filenames
    .filter(filename => !filename.endsWith('.map'))
    .map(filename => ({
      codePath: filename,
      mapPath: mapFilenames.find(mapFilename => mapFilename === `${filename}.map`),
    }));
}

/**
 * @typedef {Object} ExploreOptions
 * @property {boolean} onlyMapped
 * @property {boolean} html
 * @property {boolean} noRoot
 * @property {Object.<string, string>} replace
 */

/**
 * Create options object for `explore` method
 * @param {Args} args CLI arguments
 * @returns {ExploreOptions}
 */
function getExploreOptions(args) {
  let html = true;
  if (args['--json'] || args['--tsv']) {
    html = false;
  }

  const replace = {};
  const argsReplace = args['--replace'];
  const argsWith = args['--with'];
  if (argsReplace && argsWith) {
    for (let replaceIndex = 0; replaceIndex < argsReplace.length; replaceIndex += 1) {
      replace[argsReplace[replaceIndex]] = argsWith[replaceIndex];
    }
  }

  return {
    onlyMapped: args['--only-mapped'] || args['-m'],
    html,
    noRoot: args['--noroot'],
    replace,
  };
}

/**
 * Handle error during multiple bundles processing
 * @param {Bundle} bundleInfo
 * @param {Error} err
 */
function onExploreError(bundleInfo, err) {
  if (err.code === 'ENOENT') {
    console.error(`[${bundleInfo.codePath}] File not found! -- ${err.message}`);
  } else {
    console.error(`[${bundleInfo.codePath}]`, err.message);
  }
}

function reportUnmappedBytes(data) {
  const unmappedBytes = data.files[UNMAPPED];
  if (unmappedBytes) {
    const totalBytes = data.totalBytes;
    const pct = (100 * unmappedBytes) / totalBytes;

    const bytesString = pct.toFixed(2);

    console.warn(
      `[${data.bundleName}] Unable to map ${unmappedBytes}/${totalBytes} bytes (${bytesString}%)`
    );
  }
}

/**
 * Write HTML content to a temporary file and open the file in a browser
 * @param {string} html
 */
function writeToHtml(html) {
  const tempName = temp.path({ suffix: '.html' });

  fs.writeFileSync(tempName, html);

  open(tempName, { wait: false }).catch(error => {
    console.error('Unable to open web browser. ' + error);
    console.error(
      'Either run with --html, --json or --tsv, or view HTML for the visualization at:'
    );
    console.error(tempName);
  });
}

/**
 * Explore multiple bundles and write html output to file.
 *
 * @param {Bundle[]} bundles Bundles to explore
 * @returns {Promise<Promise<ExploreBatchResult[]>}
 */
function exploreBundlesAndFilterErroneous(bundles) {
  return Promise.all(
    bundles.map(bundle => explorePromisified(bundle).catch(err => onExploreError(bundle, err)))
  ).then(results => results.filter(data => data));
}

/**
 * @typedef {Object} WriteConfig
 * @property {string} [path] Path to write
 * @property {string} fileName File name to write
 */

/**
 * Explore multiple bundles and write html output to file.
 *
 * @param {WriteConfig} writeConfig
 * @param {string} codePath Path to bundle file or glob matching bundle files
 * @param {string} [mapPath] Path to bundle map file
 * @returns {Bundle[]}
 */
function exploreBundlesAndWriteHtml(writeConfig, codePath, mapPath) {
  const bundles = getBundles(codePath, mapPath);

  return exploreBundlesAndFilterErroneous(bundles).then(results => {
    if (results.length === 0) {
      throw new Error('There were errors');
    }

    results.forEach(reportUnmappedBytes);

    const html = generateHtml(results);

    if (writeConfig.path !== undefined) {
      // Use fse to support older node versions
      fse.ensureDirSync(writeConfig.path);
    }

    const relPath =
      writeConfig.path !== undefined
        ? `${writeConfig.path}/${writeConfig.fileName}`
        : writeConfig.fileName;

    return fs.writeFileSync(relPath, html);
  });
}

if (require.main === module) {
  /** @type {Args} */
  const args = docopt(doc, { version: packageJson.version });

  validateArgs(args);

  const bundles = getBundles(args['<script.js>'], args['<script.js.map>']);

  if (bundles.length === 0) {
    throw new Error('No file(s) found');
  }

  const exploreOptions = getExploreOptions(args);

  if (bundles.length === 1) {
    let data;

    try {
      const { codePath, mapPath } = bundles[0];
      data = explore(codePath, mapPath, exploreOptions);
    } catch (err) {
      if (err.code === 'ENOENT') {
        console.error(`File not found! -- ${err.message}`);
        process.exit(1);
      } else {
        console.error(err.message);
        process.exit(1);
      }
    }

    reportUnmappedBytes(data);

    if (args['--json']) {
      console.log(JSON.stringify(data.files, null, '  '));
      process.exit(0);
    } else if (args['--tsv']) {
      console.log('Source\tSize');
      Object.keys(data.files).forEach(source => {
        const size = data.files[source];
        console.log(`${size}\t${source}`);
      });
      process.exit(0);
    } else if (args['--html']) {
      console.log(data.html);
      process.exit(0);
    }

    writeToHtml(data.html);
  } else {
    exploreBundlesAndFilterErroneous(bundles).then(results => {
      if (results.length === 0) {
        throw new Error('There were errors');
      }

      results.forEach(reportUnmappedBytes);

      const html = generateHtml(results);

      // Check args instead of exploreOptions.html because it always true
      if (args['--html']) {
        console.log(html);
      } else {
        writeToHtml(html);
      }
    });
  }
}

module.exports = explore;
module.exports.generateHtml = generateHtml;
module.exports.exploreBundlesAndWriteHtml = exploreBundlesAndWriteHtml;

// Exports are here mostly for testing.
module.exports.loadSourceMap = loadSourceMap;
module.exports.computeGeneratedFileSizes = computeGeneratedFileSizes;
module.exports.adjustSourcePaths = adjustSourcePaths;
module.exports.mapKeys = helpers.mapKeys;
module.exports.commonPathPrefix = commonPathPrefix;
module.exports.getBundles = getBundles;
