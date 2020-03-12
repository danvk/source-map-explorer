import convert from 'convert-source-map';
import path from 'path';
import { BasicSourceMapConsumer, IndexedSourceMapConsumer, SourceMapConsumer } from 'source-map';
import gzipSize from 'gzip-size';
import { mapKeys } from 'lodash';

import { getBundleName } from './api';
import {
  getFileContent,
  getCommonPathPrefix,
  getFirstRegexMatch,
  detectEOL,
  getOccurrencesCount,
  isEOLAtPosition,
  mergeRanges,
} from './helpers';
import { AppError } from './app-error';
import { setCoveredSizes } from './coverage';

import {
  Bundle,
  CoverageRange,
  ExploreBundleResult,
  ExploreOptions,
  File,
  FileDataMap,
  FileSizes,
  MappingRange,
} from './types';

export const UNMAPPED_KEY = '[unmapped]';
export const SOURCE_MAP_COMMENT_KEY = '[sourceMappingURL]';
export const NO_SOURCE_KEY = '[no source]';
export const EOL_KEY = '[EOLs]';

export const SPECIAL_FILENAMES = [UNMAPPED_KEY, SOURCE_MAP_COMMENT_KEY, NO_SOURCE_KEY, EOL_KEY];

/**
 * Analyze a bundle
 */
export async function exploreBundle(
  bundle: Bundle,
  options: ExploreOptions
): Promise<ExploreBundleResult> {
  const { code, map, coverageRanges } = bundle;

  const sourceMapData = await loadSourceMap(code, map);

  const sizes = computeFileSizes(sourceMapData, options, coverageRanges);

  const files = adjustSourcePaths(sizes.files, options);

  // Free Wasm data
  sourceMapData.consumer.destroy();

  return {
    bundleName: getBundleName(bundle),
    ...sizes,
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

const COMMENT_REGEX = convert.commentRegex;
const MAP_FILE_COMMENT_REGEX = convert.mapFileCommentRegex;

/**
 * Extract either source map comment/file
 */
function getSourceMapComment(fileContent: string): string {
  const sourceMapComment =
    getFirstRegexMatch(COMMENT_REGEX, fileContent) ||
    getFirstRegexMatch(MAP_FILE_COMMENT_REGEX, fileContent) ||
    '';

  // Remove trailing EOLs
  return sourceMapComment.trim();
}

interface ComputeFileSizesContext {
  generatedLine: number;
  generatedColumn: number;
  line: string;
  source: string | null;
  consumer: Consumer;
  mapReferenceEOLSources: Set<string>;
}

/**
 * Check if source map references EOL (see https://github.com/microsoft/TypeScript/issues/34695)
 */
function isReferencingEOL(context: ComputeFileSizesContext, maxColumnIndex: number): boolean {
  const { generatedLine, generatedColumn, source, consumer } = context;

  // Ignore difference more than EOL max length (\r\n)
  if (maxColumnIndex - generatedColumn > 2) {
    return false;
  }

  // Ignore mapping w/o source
  if (!source) {
    return false;
  }

  // Don't check the same source twice. This covers most case even though not 100% reliable
  if (context.mapReferenceEOLSources.has(source)) {
    return true;
  }

  const content = consumer.sourceContentFor(source, true);

  // Content is needed to detect EOL
  if (!content) {
    return false;
  }

  const { line, column } = consumer.originalPositionFor({
    line: generatedLine,
    column: generatedColumn,
  });

  if (line === null || column === null) {
    return false;
  }

  if (isEOLAtPosition(content, [line, column])) {
    context.mapReferenceEOLSources.add(source);

    return true;
  }

  return false;
}

function checkInvalidMappingColumn(context: ComputeFileSizesContext): void {
  const { line, generatedLine, generatedColumn } = context;
  const maxColumnIndex = line.length - 1;

  if (generatedColumn > maxColumnIndex) {
    if (isReferencingEOL(context, maxColumnIndex)) {
      return;
    }

    throw new AppError({
      code: 'InvalidMappingColumn',
      generatedLine,
      generatedColumn,
      maxColumn: line.length,
    });
  }
}

/**
 * Calculate the number of bytes contributed by each source file
 */
function computeFileSizes(
  sourceMapData: SourceMapData,
  options: ExploreOptions,
  coverageRanges?: CoverageRange[][]
): FileSizes {
  const { consumer, codeFileContent: fileContent } = sourceMapData;

  const sourceMapComment = getSourceMapComment(fileContent);
  // Remove inline source map comment, source map file comment and trailing EOLs
  const sourceContent = fileContent.replace(sourceMapComment, '').trim();

  const eol = detectEOL(fileContent);
  // Assume only one type of EOL is used
  const lines = sourceContent.split(eol);

  const mappingRanges: MappingRange[][] = [];

  const context: ComputeFileSizesContext = {
    generatedLine: -1,
    generatedColumn: -1,
    line: '',
    source: null,
    consumer,
    mapReferenceEOLSources: new Set(),
  };

  consumer.computeColumnSpans();
  consumer.eachMapping(({ source, generatedLine, generatedColumn, lastGeneratedColumn }) => {
    // Columns are 0-based, Lines are 1-based

    const lineIndex = generatedLine - 1;
    const line = lines[lineIndex];

    if (line === undefined) {
      throw new AppError({
        code: 'InvalidMappingLine',
        generatedLine,
        maxLine: lines.length,
      });
    }

    context.generatedLine = generatedLine;
    context.generatedColumn = lastGeneratedColumn || generatedColumn;
    context.line = line;
    context.source = source;

    checkInvalidMappingColumn(context);

    const start = generatedColumn;
    const end = lastGeneratedColumn === null ? line.length - 1 : lastGeneratedColumn;

    const lineRanges = mappingRanges[lineIndex] || [];

    lineRanges.push({
      start,
      end,
      source: source === null ? NO_SOURCE_KEY : source,
    });

    mappingRanges[lineIndex] = lineRanges;
  });

  let files: FileDataMap = {};
  let mappedBytes = 0;

  // To account unicode measure byte length rather than symbols count
  const getSize = options.gzip ? gzipSize.sync : Buffer.byteLength;

  mappingRanges.forEach((lineRanges, lineIndex) => {
    const line = lines[lineIndex];
    const mergedRanges = mergeRanges(lineRanges);

    mergedRanges.forEach(({ start, end, source }) => {
      const rangeString = line.substring(start, end + 1);
      const rangeByteLength = getSize(rangeString);

      if (!files[source]) {
        files[source] = { size: 0 };
      }

      files[source].size += rangeByteLength;

      mappedBytes += rangeByteLength;
    });

    if (coverageRanges) {
      files = setCoveredSizes(line, files, mergedRanges, coverageRanges[lineIndex]);
    }
  });

  const sourceMapCommentBytes = getSize(sourceMapComment);
  const eolBytes = getOccurrencesCount(eol, fileContent) * Buffer.byteLength(eol);
  const totalBytes = getSize(fileContent);
  let unmappedBytes: number | undefined;

  if (!options.excludeSourceMapComment) {
    files[SOURCE_MAP_COMMENT_KEY] = { size: sourceMapCommentBytes };
  }

  if (!options.onlyMapped) {
    unmappedBytes = totalBytes - mappedBytes - sourceMapCommentBytes - eolBytes;
    files[UNMAPPED_KEY] = { size: unmappedBytes };
  }

  if (eolBytes > 0) {
    files[EOL_KEY] = { size: eolBytes };
  }

  return {
    ...(options.excludeSourceMapComment
      ? { totalBytes: totalBytes - sourceMapCommentBytes }
      : { totalBytes }),
    mappedBytes,
    ...(!options.onlyMapped && { unmappedBytes }),
    eolBytes,
    sourceMapCommentBytes,
    files,
  };
}

export function adjustSourcePaths(fileSizeMap: FileDataMap, options: ExploreOptions): FileDataMap {
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
