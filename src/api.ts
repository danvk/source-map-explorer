import path from 'path';
import fs from 'fs';
import fse from 'fs-extra';
import os from 'os';
import { SourceMapConsumer, BasicSourceMapConsumer, IndexedSourceMapConsumer } from 'source-map';
import convert from 'convert-source-map';

import { reportUnmappedBytes, generateHtml, getBundles, UNMAPPED, Bundle } from './common';
import { getFileContent, mapKeys, getCommonPathPrefix } from './helpers';

const SOURCE_MAP_INFO_URL =
  'https://github.com/danvk/source-map-explorer/blob/master/README.md#generating-source-maps';

const UNABLE_TO_FIND_SOURCE_MAP = `Unable to find a source map.${os.EOL}See ${SOURCE_MAP_INFO_URL}`;

type Consumer = BasicSourceMapConsumer | IndexedSourceMapConsumer;

export type FileSizeMap = Record<string, number>;

type File = string | Buffer;

interface SourceMapData {
  consumer: Consumer;
  jsFileContent: string;
}

/** Get source map */
async function loadSourceMap(jsFile: File, sourceMapFile?: File): Promise<SourceMapData> {
  const jsFileContent = getFileContent(jsFile);

  let consumer: Consumer;

  if (sourceMapFile) {
    const sourceMapFileContent = getFileContent(sourceMapFile);
    consumer = await new SourceMapConsumer(sourceMapFileContent);
  } else {
    // Try to read a source map from a 'sourceMappingURL' comment.
    let converter = convert.fromSource(jsFileContent);

    if (!converter && !Buffer.isBuffer(jsFile)) {
      converter = convert.fromMapFileSource(jsFileContent, path.dirname(jsFile));
    }

    if (!converter) {
      throw new Error(UNABLE_TO_FIND_SOURCE_MAP);
    }

    consumer = await new SourceMapConsumer(converter.toJSON());
  }

  if (!consumer) {
    throw new Error(UNABLE_TO_FIND_SOURCE_MAP);
  }

  return {
    consumer,
    jsFileContent,
  };
}

interface Span {
  source: string | null;
  numChars: number;
}

function computeSpans(mapConsumer: Consumer, jsFileContent: string): Span[] {
  const lines = jsFileContent.split('\n');
  const spans: Span[] = [];
  let numChars = 0;

  let lastSource: string | null | undefined = undefined; // not a string, not null

  for (let line = 1; line <= lines.length; line++) {
    const lineText = lines[line - 1];
    const numCols = lineText.length;

    for (let column = 0; column < numCols; column++, numChars++) {
      const { source } = mapConsumer.originalPositionFor({ line, column });

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

interface FileSizes {
  files: FileSizeMap;
  unmappedBytes: number;
  totalBytes: number;
}

/** Calculate the number of bytes contributed by each source file */
function computeGeneratedFileSizes(consumer: Consumer, jsFileContent: string): FileSizes {
  const spans = computeSpans(consumer, jsFileContent);

  const files: Record<string, number> = {};
  let unmappedBytes = 0;
  let totalBytes = 0;

  for (let i = 0; i < spans.length; i++) {
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
    const length = prefix.length;

    if (length) {
      sizes = mapKeys(sizes, source => source.slice(length));
    }
  }

  if (!replace) {
    replace = {};
  }

  var finds = Object.keys(replace);

  for (let i = 0; i < finds.length; i++) {
    const before = new RegExp(finds[i]);
    const after = replace[finds[i]];

    sizes = mapKeys(sizes, source => source.replace(before, after));
  }

  return sizes;
}

export interface ExploreOptions {
  onlyMapped?: boolean;
  html?: boolean;
  noRoot?: boolean;
  replace?: ReplaceMap;
}

export type ReplaceMap = Record<string, string>;

export interface ExploreResult {
  bundleName: string;
  totalBytes: number;
  unmappedBytes?: number;
  files: FileSizeMap;
  html?: string;
}

interface ExploreErrorResult {
  bundleName: string;
  error: NodeJS.ErrnoException;
}

/** Analyze bundle */
export async function explore(
  code: File,
  map?: File,
  options?: ExploreOptions
): Promise<ExploreResult> {
  if (typeof options === 'undefined' && typeof map === 'object' && !Buffer.isBuffer(map)) {
    options = map;
    map = undefined;
  }

  if (!options) {
    options = {};
  }

  const { jsFileContent, consumer } = await loadSourceMap(code, map);

  const sizes = computeGeneratedFileSizes(consumer, jsFileContent);

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

  const bundleName = Buffer.isBuffer(code) ? 'Buffer' : code;

  const result: ExploreResult = {
    bundleName,
    totalBytes,
    unmappedBytes,
    files,
  };

  if (options.html) {
    result.html = generateHtml([result]);
  }

  // Free Wasm data
  consumer.destroy();

  return result;
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
export async function exploreBundles(
  bundles: Bundle[]
): Promise<(ExploreResult | ExploreErrorResult)[]> {
  return Promise.all(
    bundles.map(bundle =>
      explore(bundle.codePath, bundle.mapPath).catch<ExploreErrorResult>(error => {
        onExploreError(bundle, error);

        return {
          bundleName: bundle.codePath,
          error,
        };
      })
    )
  );
}

interface WriteConfig {
  path?: string;
  fileName: string;
}

// TODO: Merge into `explore`
/**
 * Explore multiple bundles and write html output to file.
 *
 * @param codePath Path to bundle file or glob matching bundle files
 * @param [mapPath] Path to bundle map file
 */
export async function exploreBundlesAndWriteHtml(
  writeConfig: WriteConfig,
  codePath: string,
  mapPath?: string
): Promise<void> {
  const bundles = getBundles(codePath, mapPath);

  return exploreBundles(bundles).then(results => {
    const successResults = results.filter(
      (result): result is ExploreResult => result.hasOwnProperty('files')
    );

    if (successResults.length === 0) {
      throw new Error('There were errors');
    }

    successResults.forEach(reportUnmappedBytes);

    const html = generateHtml(successResults);

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
