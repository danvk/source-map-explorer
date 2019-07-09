import convert from 'convert-source-map';
import path from 'path';
import { BasicSourceMapConsumer, IndexedSourceMapConsumer, SourceMapConsumer } from 'source-map';
import gzipSize from 'gzip-size';
import { mapKeys } from 'lodash';

import { getBundleName } from './api';
import { getFileContent, getCommonPathPrefix } from './helpers';
import { AppError } from './app-error';
import { File, Bundle, ExploreOptions, ExploreBundleResult, FileSizes, FileSizeMap } from './index';

export const UNMAPPED_KEY = '<unmapped>';

/**
 * Analyze a bundle
 */
export async function exploreBundle(
  bundle: Bundle,
  options: ExploreOptions
): Promise<ExploreBundleResult> {
  const { code, map } = bundle;

  const sourceMapData = await loadSourceMap(code, map);

  const sizes = computeGeneratedFileSizes(sourceMapData);

  const gzipFiles = adjustSourcePaths(sizes.gzipFiles, options);
  const statFiles = adjustSourcePaths(sizes.statFiles, options);

  const { totalBytes, unmappedBytes } = sizes;

  if (!options.onlyMapped) {
    gzipFiles[UNMAPPED_KEY] = unmappedBytes.gzip;
    statFiles[UNMAPPED_KEY] = unmappedBytes.stat;
  }

  // Free Wasm data
  sourceMapData.consumer.destroy();

  return {
    bundleName: getBundleName(bundle),
    totalBytes,
    unmappedBytes,
    gzipFiles,
    statFiles,
  };
}

type Consumer = BasicSourceMapConsumer | IndexedSourceMapConsumer;

interface SourceMapData {
  consumer: Consumer;
  codeFileContent: string;
}

/**
 * Get source map
 */
async function loadSourceMap(codeFile: File, sourceMapFile?: File): Promise<SourceMapData> {
  const codeFileContent = getFileContent(codeFile);

  let consumer: Consumer;

  if (sourceMapFile) {
    const sourceMapFileContent = getFileContent(sourceMapFile);
    consumer = await new SourceMapConsumer(sourceMapFileContent);
  } else {
    // Try to read a source map from a 'sourceMappingURL' comment.
    let converter = convert.fromSource(codeFileContent);

    if (!converter && !Buffer.isBuffer(codeFile)) {
      converter = convert.fromMapFileSource(codeFileContent, path.dirname(codeFile));
    }

    if (!converter) {
      throw new AppError({ code: 'NoSourceMap' });
    }

    consumer = await new SourceMapConsumer(converter.toJSON());
  }

  if (!consumer) {
    throw new AppError({ code: 'NoSourceMap' });
  }

  return {
    consumer,
    codeFileContent,
  };
}

/** Calculate the number of bytes contributed by each source file */
function computeGeneratedFileSizes(sourceMapData: SourceMapData): FileSizes {
  const spans = computeSpans(sourceMapData);

  const statFiles: FileSizeMap = {};
  const gzipFiles: FileSizeMap = {};
  const unmappedBytes = {
    stat: 0,
    gzip: 0,
  };
  const totalBytes = {
    stat: 0,
    gzip: 0,
  };

  for (let i = 0; i < spans.length; i++) {
    const { source, gzippedSize, numChars } = spans[i];

    totalBytes.gzip += gzippedSize;
    totalBytes.stat += numChars;

    if (source === null) {
      unmappedBytes.gzip += gzippedSize;
      unmappedBytes.stat += numChars;
    } else {
      gzipFiles[source] = (gzipFiles[source] || 0) + gzippedSize;
      statFiles[source] = (statFiles[source] || 0) + numChars;
    }
  }

  return {
    statFiles,
    gzipFiles,
    unmappedBytes,
    totalBytes,
  };
}

interface Span {
  source: string | null;
  chars: string;
  numChars: number;
  gzippedSize: number;
}

function computeSpans(sourceMapData: SourceMapData): Span[] {
  const { consumer, codeFileContent } = sourceMapData;

  const lines = codeFileContent.split('\n');
  const spans: Span[] = [];
  let numChars = 0;

  let lastSource: string | null | undefined = undefined; // not a string, not null

  for (let line = 1; line <= lines.length; line++) {
    const lineText = lines[line - 1];
    const numCols = lineText.length;

    for (let column = 0; column < numCols; column++, numChars++) {
      const { source } = consumer.originalPositionFor({ line, column });

      if (source !== lastSource) {
        if (spans[spans.length - 1]) {
          spans[spans.length - 1].gzippedSize = gzipSize.sync(spans[spans.length - 1].chars);
        }
        lastSource = source;
        spans.push({ source, numChars: 1, chars: '', gzippedSize: 0 });
      } else {
        spans[spans.length - 1].numChars += 1;
        spans[spans.length - 1].chars += codeFileContent.charAt(column);
      }
    }
  }

  return spans;
}

export function adjustSourcePaths(fileSizeMap: FileSizeMap, options: ExploreOptions): FileSizeMap {
  if (!options.noRoot) {
    const prefix = getCommonPathPrefix(Object.keys(fileSizeMap));
    const length = prefix.length;

    if (length) {
      fileSizeMap = mapKeys(fileSizeMap, (size, source) => source.slice(length));
    }
  }

  if (options.replaceMap) {
    fileSizeMap = Object.entries(options.replaceMap).reduce((result, [before, after]) => {
      const regexp = new RegExp(before, 'g');

      return mapKeys(result, (size, source) => source.replace(regexp, after));
    }, fileSizeMap);
  }

  return fileSizeMap;
}
