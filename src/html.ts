import ejs from 'ejs';
import fs from 'fs';
import path from 'path';
import { Node } from 'webtreemap/build/webtreemap';

import { formatBytes, getCommonPathPrefix, getFileContent, formatPercent } from './helpers';
import { ExploreBundleResult, FileSizeMap } from './index';

/**
 * Generate HTML file content for specified files
 */
export function generateHtml(exploreResults: ExploreBundleResult[]): string {
  // Create a combined bundle if applicable
  if (exploreResults.length > 1) {
    exploreResults = [makeMergedBundle(exploreResults)].concat(exploreResults);
  }

  // Get bundles info to generate select element
  const bundles = exploreResults.map(data => ({
    name: normalizeBundleName(data.bundleName),
    size: formatBytes(data.totalBytes),
  }));

  // Get webtreemap data to update map on bundle select
  const webTreeDataMap = exploreResults.reduce<Record<string, Node>>((result, data) => {
    result[data.bundleName] = getWebTreeData(data.files);

    return result;
  }, {});

  const template = getFileContent(path.join(__dirname, 'tree-viz.ejs'));

  return ejs.render(template, {
    bundles,
    webTreeDataMap,
    webTreeMapJs: fs.readFileSync(require.resolve('../node_modules/webtreemap/dist/webtreemap.js')),
  });
}

/**
 * Create a combined result where each of the inputs is a separate node under the root
 */
function makeMergedBundle(exploreResults: ExploreBundleResult[]): ExploreBundleResult {
  let totalBytes = 0;
  const files: FileSizeMap = {};

  // Remove any common prefix to keep the visualization as simple as possible.
  const commonPrefix = getCommonPathPrefix(exploreResults.map(r => r.bundleName));

  for (const result of exploreResults) {
    totalBytes += result.totalBytes;

    const prefix = result.bundleName.slice(commonPrefix.length);
    Object.entries(result.files).forEach(([fileName, size]) => {
      files[`${prefix}/${fileName}`] = size;
    });
  }

  return {
    bundleName: '[combined]',
    totalBytes,
    unmappedBytes: 0,
    files,
  };
}
const ESCAPE_BACKSLASH_REGEX = /\\/g;

/** Replaces `\` by `\\` in Windows path so that string is escaped when inserted in template */
function normalizeBundleName(name: string): string {
  return name.replace(ESCAPE_BACKSLASH_REGEX, '\\\\');
}

/**
 * Covert file size map to webtreemap data
 */
function getWebTreeData(files: FileSizeMap): Node {
  const treeData = newNode('/');

  for (const source in files) {
    addNode(source, files[source], treeData);
  }

  addSizeToTitle(treeData, treeData.size);

  return treeData;
}

function newNode(id: string): Node {
  return {
    id,
    size: 0,
  };
}

function addNode(source: string, size: number, treeData: Node): void {
  const parts = source.split('/');
  let node = treeData;

  node.size += size;

  parts.forEach(part => {
    if (!node.children) {
      node.children = [];
    }

    let child = node.children.find(child => child.id === part);

    if (!child) {
      child = newNode(part);
      node.children.push(child);
    }

    node = child;
    node.size += size;
  });
}

function addSizeToTitle(node: Node, total: number): void {
  const size = node.size;

  node.id += ` • ${formatBytes(size)} • ${formatPercent(size, total, 1)}%`;

  if (node.children) {
    node.children.forEach(child => {
      addSizeToTitle(child, total);
    });
  }
}
