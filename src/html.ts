import btoa from 'btoa';
import ejs from 'ejs';
import fs from 'fs';
import path from 'path';
import escapeHtml from 'escape-html';

import { formatBytes, getCommonPathPrefix, getFileContent, formatPercent } from './helpers';
import { ExploreBundleResult, FileSizeMap } from './index';

/**
 * Generate HTML file content for specified files
 */
export function generateHtml(exploreResults: ExploreBundleResult[]): string {
  const assets = {
    webtreemapJs: btoa(fs.readFileSync(require.resolve('./vendor/webtreemap.js'))),
    webtreemapCss: btoa(fs.readFileSync(require.resolve('./vendor/webtreemap.css'))),
  };

  // Create a combined bundle if applicable
  if (exploreResults.length > 1) {
    exploreResults = [makeMergedBundle(exploreResults)].concat(exploreResults);
  }

  // Get bundles info to generate select element
  const bundles = exploreResults.map(data => ({
    name: normalizeBundleName(data.bundleName),
    sizes: { gzip: formatBytes(data.totalBytes.gzip), stat: formatBytes(data.totalBytes.stat) },
  }));

  const treeDataMaps = {
    gzip: exploreResults.reduce<Record<string, WebTreeMapNode>>((result, data) => {
      result[data.bundleName] = getWebTreeMapData(data.gzipFiles);

      return result;
    }, {}),
    stat: exploreResults.reduce<Record<string, WebTreeMapNode>>((result, data) => {
      result[data.bundleName] = getWebTreeMapData(data.statFiles);

      return result;
    }, {}),
  };

  const template = getFileContent(path.join(__dirname, 'tree-viz.ejs'));

  return ejs.render(template, {
    bundles,
    treeDataMaps,
    webtreemapJs: assets.webtreemapJs,
    webtreemapCss: assets.webtreemapCss,
  });
}

/**
 * Create a combined result where each of the inputs is a separate node under the root
 */
function makeMergedBundle(exploreResults: ExploreBundleResult[]): ExploreBundleResult {
  const totalBytes = { gzip: 0, stat: 0 };
  const statFiles: FileSizeMap = {};
  const gzipFiles: FileSizeMap = {};

  // Remove any common prefix to keep the visualization as simple as possible.
  const commonPrefix = getCommonPathPrefix(exploreResults.map(r => r.bundleName));

  for (const result of exploreResults) {
    totalBytes.gzip += result.totalBytes.gzip;
    totalBytes.stat += result.totalBytes.stat;

    const prefix = result.bundleName.slice(commonPrefix.length);
    Object.entries(result.gzipFiles).forEach(([fileName, size]) => {
      gzipFiles[`${prefix}/${fileName}`] = size;
    });
    Object.entries(result.statFiles).forEach(([fileName, size]) => {
      statFiles[`${prefix}/${fileName}`] = size;
    });
  }

  return {
    bundleName: '[combined]',
    totalBytes,
    unmappedBytes: { gzip: 0, stat: 0 },
    statFiles,
    gzipFiles,
  };
}
const ESCAPE_BACKSLASH_REGEX = /\\/g;

/** Replaces `\` by `\\` in Windows path so that string is escaped when inserted in template */
function normalizeBundleName(name: string): string {
  return name.replace(ESCAPE_BACKSLASH_REGEX, '\\\\');
}

interface WebTreeMapNode {
  name: string;
  data: {
    $area: number;
  };
  children?: WebTreeMapNode[];
}

/**
 * Covert file size map to webtreemap data
 */
function getWebTreeMapData(files: FileSizeMap): WebTreeMapNode {
  const treeData = newNode('/');

  for (const source in files) {
    addNode(source, files[source], treeData);
  }

  addSizeToTitle(treeData, treeData.data['$area']);

  return treeData;
}

function newNode(name: string): WebTreeMapNode {
  return {
    name: escapeHtml(name),
    data: {
      $area: 0,
    },
  };
}

function addNode(source: string, size: number, treeData: WebTreeMapNode): void {
  const parts = source.split('/');
  let node = treeData;

  node.data['$area'] += size;

  parts.forEach(part => {
    if (!node.children) {
      node.children = [];
    }

    let child = node.children.find(child => child.name === part);

    if (!child) {
      child = newNode(part);
      node.children.push(child);
    }

    node = child;
    node.data['$area'] += size;
  });
}

function addSizeToTitle(node: WebTreeMapNode, total: number): void {
  const size = node.data['$area'];

  node.name += ` • ${formatBytes(size)} • ${formatPercent(size, total, 1)}%`;

  if (node.children) {
    node.children.forEach(child => {
      addSizeToTitle(child, total);
    });
  }
}
