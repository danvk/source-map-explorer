const path = require('path');
const fs = require('fs');
const glob = require('glob');
const ejs = require('ejs');
const btoa = require('btoa');

const { formatBytes, commonPathPrefix } = require('./helpers');

const UNMAPPED = '<unmapped>';

/**
 * @typedef {Object} ExploreResult
 * @property {number} totalBytes
 * @property {number} unmappedBytes
 * @property {FileSizeMap} files
 * @property {string} [html]
 */

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
 * @typedef {Object} ExploreBatchResult
 * @property {string} bundleName
 * @property {number} totalBytes
 * @property {FileSizeMap} files
 */

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

    node.name += ` • ${formatBytes(size)} • ${pct.toFixed(1)}%`;
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
 * Generate HTML file content for specified files
 * @param {ExploreBatchResult[]} exploreResults
 */
function generateHtml(exploreResults) {
  const assets = {
    webtreemapJs: btoa(fs.readFileSync(require.resolve('../vendor/webtreemap.js'))),
    webtreemapCss: btoa(fs.readFileSync(require.resolve('../vendor/webtreemap.css'))),
  };

  // Create a combined bundle if applicable
  if (exploreResults.length > 1) {
    exploreResults = [makeMergedBundle(exploreResults)].concat(exploreResults);
  }

  // Get bundles info to generate select
  const bundles = exploreResults.map(data => ({
    name: data.bundleName,
    size: formatBytes(data.totalBytes),
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

module.exports = {
  UNMAPPED,
  reportUnmappedBytes,
  generateHtml,
  getBundles,
};
