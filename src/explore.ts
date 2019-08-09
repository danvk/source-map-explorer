import convert from 'convert-source-map';
import path from 'path';
import { BasicSourceMapConsumer, IndexedSourceMapConsumer, SourceMapConsumer } from 'source-map';
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

  const sizes = computeFileSizeMapOptimized(sourceMapData);

  const files = adjustSourcePaths(sizes.files, options);

  const { totalBytes, unmappedBytes } = sizes;

  if (!options.onlyMapped) {
    files[UNMAPPED_KEY] = unmappedBytes;
  }

  // Free Wasm data
  sourceMapData.consumer.destroy();

  return {
    bundleName: getBundleName(bundle),
    totalBytes,
    unmappedBytes,
    files,
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

function computeFileSizeMapOptimized(sourceMapData: SourceMapData): FileSizes {
  const { consumer, codeFileContent } = sourceMapData;
  const lines = codeFileContent.split('\n');
  const files: FileSizeMap = {};
  let mappedBytes = 0;

  consumer.computeColumnSpans();

  consumer.eachMapping((m: any) => {
    // lines are 1-based
    const line = lines[m.generatedLine - 1];
    if (line == null) {
      throw new AppError({
        code: 'InvalidMappingLine',
        generatedLine: m.generatedLine,
        maxLine: lines.length,
      });
    }

    // columns are 0-based
    if (m.generatedColumn >= line.length) {
      throw new AppError({
        code: 'InvalidMappingColumn',
        generatedLine: m.generatedLine,
        generatedColumn: m.generatedColumn,
        maxColumn: line.length,
      });
    }

    let mappingLength: number = 0;
    if (m.lastGeneratedColumn != null) {
      if (m.lastGeneratedColumn >= line.length) {
        throw new AppError({
          code: 'InvalidMappingColumn',
          generatedLine: m.generatedLine,
          generatedColumn: m.lastGeneratedColumn,
          maxColumn: line.length,
        });
      }
      mappingLength = m.lastGeneratedColumn - m.generatedColumn + 1;
    } else {
      mappingLength = line.length - m.generatedColumn;
    }
    files[m.source] = (files[m.source] || 0) + mappingLength;
    mappedBytes += mappingLength;
  });

  // Doesn't count newlines as original version didn't count newlines
  let totalBytes = codeFileContent.length - lines.length + 1;
  const unmappedBytes = totalBytes - mappedBytes;
  return {
    files,
    unmappedBytes,
    totalBytes,
  };
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
