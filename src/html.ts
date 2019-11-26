import btoa from 'btoa';
import ejs from 'ejs';
import fs from 'fs';
import path from 'path';
import escapeHtml from 'escape-html';

import { formatBytes, getCommonPathPrefix, getFileContent, formatPercent } from './helpers';
import { ExploreBundleResult, FileSizeMap, FileCoverageMap } from './index';

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
    name: data.bundleName,
    size: formatBytes(data.totalBytes),
  }));

  // Get webtreemap data to update map on bundle select
  const treeDataMap = exploreResults.reduce<Record<string, { name: string; data: WebTreeMapNode }>>(
    (result, data, index) => {
      result[index] = {
        name: data.bundleName,
        data: getWebTreeMapData(data),
      };

      return result;
    },
    {}
  );
  const template = getFileContent(path.join(__dirname, 'tree-viz.ejs'));

  return ejs.render(template, {
    bundles,
    treeDataMap,
    webtreemapJs: assets.webtreemapJs,
    webtreemapCss: assets.webtreemapCss,
  });
}

/**
 * Create a combined result where each of the inputs is a separate node under the root
 */
function makeMergedBundle(exploreResults: ExploreBundleResult[]): ExploreBundleResult {
  let totalBytes = 0;
  const files: FileSizeMap = {};
  const filesCoverage: FileSizeMap = {};

  // Remove any common prefix to keep the visualization as simple as possible.
  const commonPrefix = getCommonPathPrefix(exploreResults.map(r => r.bundleName));

  for (const result of exploreResults) {
    totalBytes += result.totalBytes;

    const prefix = result.bundleName.slice(commonPrefix.length);
    Object.entries(result.files).forEach(([fileName, size]) => {
      files[`${prefix}/${fileName}`] = size;
    });
    if (result.filesCoverage) {
      Object.entries(result.filesCoverage).forEach(([fileName, size]) => {
        filesCoverage[`${prefix}/${fileName}`] = size;
      });
    }
  }

  return {
    bundleName: '[combined]',
    totalBytes,
    unmappedBytes: 0,
    eolBytes: 0,
    sourceMapCommentBytes: 0,
    files,
    filesCoverage,
  };
}

interface WebTreeMapNode {
  name: string;
  data: {
    $area: number;
    coveredSize?: number;
  };
  children?: WebTreeMapNode[];
}

/**
 * Covert file size map to webtreemap data
 */
function getWebTreeMapData(data: ExploreBundleResult): WebTreeMapNode {
  const files = data.files;
  const filesCoverage = data.filesCoverage;
  const treeData = newNode('/');

  for (const source in files) {
    const coveredSize = filesCoverage ? filesCoverage[source] : undefined;
    addNode(source, files[source], coveredSize, treeData);
  }

  addSizeToTitle(treeData, treeData.data['$area']);

  return treeData;
}

function newNode(name: string): WebTreeMapNode {
  return {
    name: escapeHtml(name),
    data: {
      $area: 0,
      coveredSize: undefined,
    },
  };
}

function addNode(
  source: string,
  size: number,
  coveredSize: number | undefined,
  treeData: WebTreeMapNode
): void {
  const parts = source.split('/');
  let node = treeData;

  node.data['$area'] += size;
  if (coveredSize !== undefined) {
    if (node.data.coveredSize === undefined) {
      node.data['coveredSize'] = 0;
    }
    node.data.coveredSize += coveredSize;
  }

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
    if (undefined !== coveredSize) {
      if (node.data.coveredSize === undefined) {
        node.data['coveredSize'] = 0;
      }
      node.data.coveredSize += coveredSize;
    }
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
