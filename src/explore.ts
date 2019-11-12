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

  const sizes = computeFileSizes(sourceMapData);

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

function detectEOL(content: string): string {
  return content.includes('\r\n') ? '\r\n' : '\n';
}

interface ComputeFileSizesContext {
  generatedLine: number;
  generatedColumn: number;
  line: string;
  eol: string;
}

function checkInvalidMappingColumn({
  generatedLine,
  generatedColumn,
  line,
  eol,
}: ComputeFileSizesContext): void {
  const maxColumnIndex = line.length - 1;

  // Columns are 0-based
  // Ignore case when source map references EOL character (e.g. https://github.com/microsoft/TypeScript/issues/34695)
  if (generatedColumn > maxColumnIndex && `${line}${eol}`.lastIndexOf(eol) !== generatedColumn) {
    throw new AppError({
      code: 'InvalidMappingColumn',
      generatedLine,
      generatedColumn,
      maxColumn: line.length,
    });
  }
}

/** Calculate the number of bytes contributed by each source file */
function computeFileSizes(sourceMapData: SourceMapData): FileSizes {
  const { consumer, codeFileContent } = sourceMapData;
  const eol = detectEOL(codeFileContent);
  // Assume only one EOL is used
  const lines = codeFileContent.split(eol);

  const files: FileSizeMap = {};
  let mappedBytes = 0;

  consumer.computeColumnSpans();

  consumer.eachMapping(({ source, generatedLine, generatedColumn, lastGeneratedColumn }) => {
    // Lines are 1-based
    const line = lines[generatedLine - 1];

    if (line === undefined) {
      throw new AppError({
        code: 'InvalidMappingLine',
        generatedLine,
        maxLine: lines.length,
      });
    }

    checkInvalidMappingColumn({
      generatedLine,
      generatedColumn,
      line,
      eol,
    });

    let mappingLength = 0;
    if (lastGeneratedColumn !== null) {
      checkInvalidMappingColumn({
        generatedLine,
        generatedColumn: lastGeneratedColumn,
        line,
        eol,
      });

      mappingLength = lastGeneratedColumn - generatedColumn + 1;
    } else {
      mappingLength = line.length - generatedColumn;
    }

    files[source] = (files[source] || 0) + mappingLength;
    mappedBytes += mappingLength;
  });

  // Don't count newlines as original version didn't count newlines
  const totalBytes = codeFileContent.length - lines.length + 1;

  return {
    files,
    unmappedBytes: totalBytes - mappedBytes,
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
