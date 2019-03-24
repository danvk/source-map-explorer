const path = require('path');
const fs = require('fs');
const fse = require('fs-extra');
const os = require('os');
const SourceMapConsumer = require('source-map').SourceMapConsumer;
const convert = require('convert-source-map');

const { reportUnmappedBytes, generateHtml, getBundles, UNMAPPED } = require('./common');
const { getFileContent, mapKeys, commonPathPrefix } = require('./helpers');

const SOURCE_MAP_INFO_URL =
  'https://github.com/danvk/source-map-explorer/blob/master/README.md#generating-source-maps';

/**
 * Get source map
 * @param {(string|Buffer)} jsFile
 * @param {(string|Buffer)} mapFile
 */
function loadSourceMap(jsFile, mapFile) {
  const jsData = getFileContent(jsFile);

  var mapConsumer;
  if (mapFile) {
    const sourcemapData = getFileContent(mapFile);
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

function adjustSourcePaths(sizes, findRoot, replace) {
  if (findRoot) {
    var prefix = commonPathPrefix(Object.keys(sizes));
    var len = prefix.length;
    if (len) {
      sizes = mapKeys(sizes, source => {
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
    sizes = mapKeys(sizes, source => {
      return source.replace(before, after);
    });
  }

  return sizes;
}

/**
 * @typedef {Object.<string, number>} FileSizeMap
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

module.exports = {
  explore,
  exploreBundlesAndWriteHtml,
  // Exports below for tests only
  adjustSourcePaths,
};
