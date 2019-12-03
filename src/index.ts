import { explore } from './api';
import { UNMAPPED_KEY, SOURCE_MAP_COMMENT_KEY, NO_SOURCE_KEY } from './explore';

export { explore, UNMAPPED_KEY, SOURCE_MAP_COMMENT_KEY, NO_SOURCE_KEY };

export default explore;

// Export all interfaces from index.ts to avoid type exports in compiled js code. See https://github.com/babel/babel/issues/8361

export type FileSizeMap = Record<string, number>;

export interface FileSizes {
  files: FileSizeMap;
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
  | 'CannotOpenTempFile';

export type File = string | Buffer;

export type ReplaceMap = Record<string, string>;

export type OutputFormat = 'json' | 'tsv' | 'html';

/** Represents single bundle */
export interface Bundle {
  code: File;
  map?: File;
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

// TODO: Remove when https://github.com/mozilla/source-map/pull/374 is merged
declare module 'source-map' {
  export interface MappingItem {
    lastGeneratedColumn: number | null;
  }
}
