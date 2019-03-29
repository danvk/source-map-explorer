import path from 'path';
import fs from 'fs';
import fse from 'fs-extra';
import os from 'os';
import { SourceMapConsumer } from 'source-map';
import convert from 'convert-source-map';

import { reportUnmappedBytes, generateHtml, getBundles, UNMAPPED } from './common';
import { getFileContent, mapKeys, getCommonPathPrefix } from './helpers';

type File = string | Buffer;

const SOURCE_MAP_INFO_URL =
  'https://github.com/danvk/source-map-explorer/blob/master/README.md#generating-source-maps';

/** Get source map */
function loadSourceMap(jsFile: File, mapFile?: File) {
  const jsData = getFileContent(jsFile);
  let mapConsumer;

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

function computeSpans(mapConsumer: any, generatedJs: string): Span[] {
  const lines = generatedJs.split('\n');
  const spans: Span[] = [];
  let numChars = 0;

  // TODO: Figure out why lastSource was set to false
  let lastSource: string | null | undefined = undefined; // not a string, not null.

  for (let line = 1; line <= lines.length; line++) {
    const lineText = lines[line - 1];
    const numCols = lineText.length;

    for (let column = 0; column < numCols; column++, numChars++) {
      const pos: { source: string | null } = mapConsumer.originalPositionFor({ line, column });
      const source = pos.source;

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

/** Calculate the number of bytes contributed by each source file */
function computeGeneratedFileSizes(mapConsumer: any, generatedJs: string) {
  const spans = computeSpans(mapConsumer, generatedJs);

  let unmappedBytes = 0;
  const files: Record<string, number> = {};
  var totalBytes = 0;

  for (var i = 0; i < spans.length; i++) {
    const { numChars, source } = spans[i];

    totalBytes += numChars;

    if (source === null) {
      unmappedBytes += numChars;
    } else {
      files[source] = (files[source] || 0) + numChars;
    }
  }

  return {
    files,
    unmappedBytes,
    totalBytes,
  };
}

// Export for tests
export function adjustSourcePaths(
  sizes: FileSizeMap,
  findRoot: boolean,
  replace?: ReplaceMap
): FileSizeMap {
  if (findRoot) {
    const prefix = getCommonPathPrefix(Object.keys(sizes));
    const len = prefix.length;

    if (len) {
      sizes = mapKeys(sizes, source => source.slice(len));
    }
  }

  if (!replace) {
    replace = {};
  }

  var finds = Object.keys(replace);

  for (var i = 0; i < finds.length; i++) {
    const before = new RegExp(finds[i]);
    const after = replace[finds[i]];

    sizes = mapKeys(sizes, source => source.replace(before, after));
  }

  return sizes;
}

/** Analyze bundle */
export function explore(code: File, map?: File, options?: ExploreOptions): ExploreResult {
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

  // TODO: Remove. `data` is always set
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

  const result: ExploreResult = {
    bundleName: 'bundle', // TODO: Temporary to merge ExploreResult and ExploreBatchResult
    totalBytes,
    unmappedBytes,
    files,
  };

  if (options.html) {
    const title = Buffer.isBuffer(code) ? 'Buffer' : code;
    result.html = generateHtml([
      {
        ...result,
        bundleName: title,
      },
    ]);
  }

  return result;
}

/**
 * Wrap `explore` with Promise
 */
function explorePromisified({ codePath, mapPath }: Bundle): Promise<ExploreResult> {
  return new Promise<ExploreResult>(resolve => {
    const result = explore(codePath, mapPath);

    resolve({
      ...result,
      bundleName: codePath,
    });
  });
}

/**
 * Handle error during multiple bundles processing
 */
function onExploreError(bundleInfo: Bundle, err: NodeJS.ErrnoException): void {
  if (err.code === 'ENOENT') {
    console.error(`[${bundleInfo.codePath}] File not found! -- ${err.message}`);
  } else {
    console.error(`[${bundleInfo.codePath}]`, err.message);
  }
}

/**
 * Explore multiple bundles and write html output to file.
 *
 * @param bundles Bundles to explore
 */
export function exploreBundlesAndFilterErroneous(
  bundles: Bundle[]
): Promise<(void | ExploreResult)[]> {
  return Promise.all(
    bundles.map(bundle => explorePromisified(bundle).catch(err => onExploreError(bundle, err)))
  ).then(results => results.filter(data => data));
}

/**
 * Explore multiple bundles and write html output to file.
 *
 * @param codePath Path to bundle file or glob matching bundle files
 * @param [mapPath] Path to bundle map file
 */
export function exploreBundlesAndWriteHtml(
  writeConfig: WriteConfig,
  codePath: string,
  mapPath?: string
): Promise<void> {
  const bundles = getBundles(codePath, mapPath);

  return exploreBundlesAndFilterErroneous(bundles).then(results => {
    if (results.length === 0) {
      throw new Error('There were errors');
    }

    // @ts-ignore TODO: Promise.all returns (void | ExploreResult)[] find a way to filter out void
    results.forEach(reportUnmappedBytes);

    // @ts-ignore TODO: Promise.all returns (void | ExploreResult)[] find a way to filter out void
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
