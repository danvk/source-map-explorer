import { explore, getExploreResult } from './api';
import { saveOutputToFile } from './output';
import { writeHtmlToTempFile } from './cli';
import {
  loadSourceMap,
  adjustSourcePaths,
  UNMAPPED_KEY,
  SOURCE_MAP_COMMENT_KEY,
  NO_SOURCE_KEY,
} from './explore';

export {
  explore,
  getExploreResult,
  loadSourceMap,
  adjustSourcePaths,
  saveOutputToFile,
  writeHtmlToTempFile,
  UNMAPPED_KEY,
  SOURCE_MAP_COMMENT_KEY,
  NO_SOURCE_KEY,
};

export default explore;

// Export all interfaces from index.ts to avoid type exports in compiled js code. See https://github.com/babel/babel/issues/8361

export interface FileData {
  size: number;
  coveredSize?: number;
}

export type FileDataMap = Record<string, FileData>;

export interface FileSizes {
  files: FileDataMap;
  mappedBytes: number;
  unmappedBytes: number;
  eolBytes: number;
  sourceMapCommentBytes: number;
  totalBytes: number;
}

export type ErrorCode =
  | 'Unknown'
  | 'NoBundles'
  | 'NoSourceMap'
  | 'OneSourceSourceMap'
  | 'UnmappedBytes'
  | 'InvalidMappingLine'
  | 'InvalidMappingColumn'
  | 'CannotSaveFile'
  | 'CannotCreateTempFile'
  | 'CannotOpenTempFile'
  | 'CannotOpenCoverageFile'
  | 'NoCoverageMatches';

export type File = string | Buffer;

export type ReplaceMap = Record<string, string>;

export type OutputFormat = 'json' | 'tsv' | 'html';

/** Represents single bundle */
export interface Bundle {
  code: File;
  map?: File;
  coverageRanges?: ColumnsRange[][];
}

export interface ExploreOptions {
  /** Exclude "unmapped" bytes from the output */
  onlyMapped?: boolean;
  /** Exclude source map comment size from output */
  excludeSourceMapComment?: boolean;
  /** Output result as a string */
  output?: {
    format: OutputFormat;
    /** Filename to save output to */
    filename?: string;
  };
  /** Disable removing prefix shared by all sources */
  noRoot?: boolean;
  /** Replace "this" by "that" map */
  replaceMap?: ReplaceMap;
  coverage?: string;
}

export interface ExploreResult {
  bundles: ExploreBundleResult[];
  /** Result as a string - either JSON, TSV or HTML */
  output?: string;
  errors: ExploreErrorResult[];
}

export interface ExploreBundleResult extends FileSizes {
  bundleName: string;
}

export interface ExploreErrorResult {
  bundleName: string;
  code: string;
  message: string;
  error?: NodeJS.ErrnoException;
  isWarning?: boolean;
}

export type BundlesAndFileTokens = (Bundle | string)[] | Bundle | string;

/** Represents inclusive range (e.g. [0,5] six columns) */
export interface ColumnsRange {
  /** Fist column index */
  start: number;
  /** Last column index */
  end: number;
}

export interface MappingRange extends ColumnsRange {
  source: string;
}

/** Represents exclusive range (e.g. [0,5) - four columns) */
export interface Coverage {
  url: string;
  ranges: CoverageRange[];
  /** File content as one line */
  text: string;
}

export interface CoverageRange {
  /** First column index */
  start: number;
  /** Column index next after last column index */
  end: number;
}

// TODO: Remove when https://github.com/mozilla/source-map/pull/374 is merged
declare module 'source-map' {
  export interface MappingItem {
    lastGeneratedColumn: number | null;
  }
}
