import path from 'path';
import fs from 'fs';
import glob from 'glob';
import ejs from 'ejs';
import btoa from 'btoa';

import { formatBytes, getCommonPathPrefix } from './helpers';
import { ExploreResult, FileSizeMap } from './api';

export const UNMAPPED = '<unmapped>';

export function reportUnmappedBytes(data: ExploreResult): void {
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
 */
function makeMergedBundle(exploreResults: ExploreResult[]): ExploreResult {
  let totalBytes = 0;
  const files: Record<string, number> = {};

  // Remove any common prefix to keep the visualization as simple as possible.
  const commonPrefix = getCommonPathPrefix(exploreResults.map(r => r.bundleName));

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

interface WebTreeMapNode {
  name: string;
  data: {
    $area: number;
  };
  children: WebTreeMapNode[];
}

/**
 * Covert file size map to webtreemap data
 */
function getWebTreeMapData(files: FileSizeMap): WebTreeMapNode {
  function newNode(name: string): WebTreeMapNode {
    return {
      name: name,
      data: {
        $area: 0,
      },
      children: [],
    };
  }

  const treeData = newNode('/');

  function addNode(path: string, size: number): void {
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

  function addSizeToTitle(node: WebTreeMapNode, total: number): void {
    const size = node.data['$area'],
      pct = (100.0 * size) / total;

    node.name += ` • ${formatBytes(size)} • ${pct.toFixed(1)}%`;
    node.children.forEach(child => {
      addSizeToTitle(child, total);
    });
  }

  for (const source in files) {
    addNode(source, files[source]);
  }
  addSizeToTitle(treeData, treeData.data['$area']);

  return treeData;
}

/**
 *  Generate HTML file content for specified files
 */
export function generateHtml(exploreResults: ExploreResult[]): string {
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
    size: formatBytes(data.totalBytes),
  }));

  // Get webtreemap data to update map on bundle select
  const treeDataMap = exploreResults.reduce<Record<string, WebTreeMapNode>>((result, data) => {
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

export interface Bundle {
  codePath: string;
  mapPath?: string;
}

/**
 * Expand codePath and mapPath into a list of { codePath, mapPath } pairs
 * @see https://github.com/danvk/source-map-explorer/issues/52
 * @param codePath Path to bundle file or glob matching bundle files
 * @param [mapPath] Path to bundle map file
 */
export function getBundles(codePath: string, mapPath?: string): Bundle[] {
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
    .map<Bundle>(filename => ({
      codePath: filename,
      mapPath: mapFilenames.find(mapFilename => mapFilename === `${filename}.map`),
    }));
}
