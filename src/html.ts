import btoa from 'btoa';
import ejs from 'ejs';
import fs from 'fs';
import path from 'path';
import escapeHtml from 'escape-html';

import { formatBytes, getCommonPathPrefix, getFileContent, formatPercent } from './helpers';
import { getColorByPercent } from './coverage';
import { ExploreOptions, ExploreBundleResult, FileData, FileDataMap } from './index';

/**
 * Generate HTML file content for specified files
 */
export function generateHtml(
  exploreResults: ExploreBundleResult[],
  options: ExploreOptions
): string {
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
    options,
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
  const files: FileDataMap = {};

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
    mappedBytes: 0,
    eolBytes: 0,
    sourceMapCommentBytes: 0,
    files,
  };
}

interface WebTreeMapNode {
  name: string;
  data: {
    $area: number;
    coveredSize?: number;
    backgroundColor?: string;
  };
  children?: WebTreeMapNode[];
}

/**
 * Convert file size map to webtreemap data
 */
function getWebTreeMapData(data: ExploreBundleResult): WebTreeMapNode {
  const files = data.files;
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

function setNodeData(node: WebTreeMapNode, fileData: FileData): void {
  const size = node.data['$area'] + fileData.size;

  if (fileData.coveredSize !== undefined) {
    const coveredSize = (node.data.coveredSize || 0) + fileData.coveredSize;

    node.data.coveredSize = coveredSize;
    node.data.backgroundColor = getColorByPercent(coveredSize / size);
  }

  node.data['$area'] = size;
}

function addNode(source: string, fileData: FileData, treeData: WebTreeMapNode): void {
  // No need to create nodes with zero size (e.g. '[unmapped]')
  if (fileData.size === 0) {
    return;
  }

  const parts = source.split('/');

  let node = treeData;

  setNodeData(node, fileData);

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

    setNodeData(child, fileData);
  });
}

function addSizeToTitle(node: WebTreeMapNode, total: number): void {
  const { $area: size, coveredSize } = node.data;

  const titleParts = [node.name, formatBytes(size), `${formatPercent(size, total, 1)}%`];

  // Add coverage label to leaf nodes only
  if (coveredSize !== undefined && node.children === undefined) {
    titleParts.push(`Coverage: ${formatPercent(coveredSize, size, 1)}%`);
  }

  node.name = titleParts.join(' • ');

  if (node.children) {
    node.children.forEach(child => {
      addSizeToTitle(child, total);
    });
  }
}
