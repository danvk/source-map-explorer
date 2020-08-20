import btoa from 'btoa';
import ejs from 'ejs';
import fs from 'fs';
import path from 'path';
import escapeHtml from 'escape-html';
import { cloneDeep } from 'lodash';

import { formatBytes, getCommonPathPrefix, getFileContent, formatPercent } from './helpers';
import { getColorByPercent } from './coverage';

import type { ExploreOptions, ExploreBundleResult, FileData, FileDataMap } from './types';

const COMBINED_BUNDLE_NAME = '[combined]';

/**
 * Get webtreemap data to update map on bundle select
 */
function getTreeDataMap(exploreResults: ExploreBundleResult[]): { [id: number]: WebTreeData } {
  let treeData = exploreResults.map<WebTreeData>((data) => ({
    name: data.bundleName,
    data: getWebTreeMapData(data.files),
  }));

  if (treeData.length > 1) {
    treeData = [makeMergedTreeDataMap(cloneDeep(treeData)), ...treeData];
  }

  for (const webTreeData of treeData) {
    addSizeToTitle(webTreeData.data, webTreeData.data.data['$area']);
  }

  return { ...treeData };
}

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

  const treeDataMap = getTreeDataMap(exploreResults);

  // Get bundles info to generate select element
  const bundles = exploreResults.map((data) => ({
    name: data.bundleName,
    size: formatBytes(data.totalBytes),
  }));

  // Create a combined bundle if applicable
  if (exploreResults.length > 1) {
    bundles.unshift({
      name: COMBINED_BUNDLE_NAME,
      size: formatBytes(exploreResults.reduce((total, result) => total + result.totalBytes, 0)),
    });
  }

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
 * Create a combined tree data where each of the inputs is a separate node under the root
 */
export function makeMergedTreeDataMap(treeData: WebTreeData[]): WebTreeData {
  const data: WebTreeMapNode = newNode('/');

  data.children = [];

  for (const result of treeData) {
    const childTree = result.data;

    childTree.name = result.name;

    data.data['$area'] += childTree.data['$area'];
    data.children.push(childTree);
  }

  const commonPrefix = getCommonPathPrefix(data.children.map((node) => node.name));
  const commonPrefixLength = commonPrefix.length;

  if (commonPrefixLength > 0) {
    for (const node of data.children) {
      node.name = node.name.slice(commonPrefixLength);
    }
  }

  return {
    name: COMBINED_BUNDLE_NAME,
    data,
  };
}

type TreeNodesMap = { [source: string]: string[] };

function getNodePath(parts: string[], depthIndex: number): string {
  return parts.slice(0, depthIndex + 1).join('/');
}

const WEBPACK_FILENAME_PREFIX = 'webpack:///';
const WEBPACK_FILENAME_PREFIX_LENGTH = WEBPACK_FILENAME_PREFIX.length;

function splitFilename(file: string): string[] {
  const webpackPrefixIndex = file.indexOf(WEBPACK_FILENAME_PREFIX);

  // Treat webpack file prefix as a filename part
  if (webpackPrefixIndex !== -1) {
    return [
      ...file.substring(0, webpackPrefixIndex).split('/'),
      WEBPACK_FILENAME_PREFIX,
      ...file.substring(webpackPrefixIndex + WEBPACK_FILENAME_PREFIX_LENGTH).split('/'),
    ].filter(Boolean);
  }

  return file.split('/');
}

function getTreeNodesMap(fileDataMap: FileDataMap): TreeNodesMap {
  let partsSourceTuples = Object.keys(fileDataMap).map<[string[], string]>((file) => [
    splitFilename(file),
    file,
  ]);

  const maxDepth = Math.max(...partsSourceTuples.map(([parts]) => parts.length));

  for (let depthIndex = 0; depthIndex < maxDepth; depthIndex += 1) {
    partsSourceTuples = partsSourceTuples.map(([parts, file], currentNodeIndex) => {
      if (parts[depthIndex]) {
        const nodePath = getNodePath(parts, depthIndex);

        const hasSameRootPaths = partsSourceTuples.some(([pathParts], index) => {
          if (index === currentNodeIndex) {
            return false;
          }
          if (!pathParts[depthIndex]) {
            return false;
          }

          return getNodePath(pathParts, depthIndex) === nodePath;
        });

        if (!hasSameRootPaths) {
          // Collapse non-contributing path parts
          return [[...parts.slice(0, depthIndex), parts.slice(depthIndex).join('/')], file];
        }
      }

      return [parts, file];
    });
  }

  return partsSourceTuples.reduce((result, [parts, file]) => {
    result[file] = parts;

    return result;
  }, {});
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

export interface WebTreeData {
  name: string;
  data: WebTreeMapNode;
}

/**
 * Convert file size map to webtreemap data
 */
export function getWebTreeMapData(files: FileDataMap): WebTreeMapNode {
  const treeNodesMap = getTreeNodesMap(files);
  const treeData = newNode('/');

  for (const source in files) {
    addNode(treeNodesMap[source], files[source], treeData);
  }

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

function addNode(parts: string[], fileData: FileData, treeData: WebTreeMapNode): void {
  // No need to create nodes with zero size (e.g. '[unmapped]')
  if (fileData.size === 0) {
    return;
  }

  let node = treeData;

  setNodeData(node, fileData);

  parts.forEach((part) => {
    if (!node.children) {
      node.children = [];
    }

    let child = node.children.find((child) => child.name === part);

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
    node.children.forEach((child) => {
      addSizeToTitle(child, total);
    });
  }
}
