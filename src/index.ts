import { explore } from './api';

export { explore };

export default explore;

// Export all interfaces from index.ts to avoid type exports in compiled js code. See https://github.com/babel/babel/issues/8361

export type FileSizeMap = Record<string, number>;

export interface FileSizes {
  files: FileSizeMap;
  unmappedBytes: number;
  totalBytes: number;
}

export enum ErrorCode {
  Unknown = 'Unknown',
  NoBundles = 'NoBundles',
  NoSourceMap = 'NoSourceMap',
  OneSourceSourceMap = 'OneSourceSourceMap',
  UnmappedBytes = 'UnmappedBytes',
  CannotSaveFile = 'CannotSaveFile',
}

export type File = string | Buffer;

export type ReplaceMap = Record<string, string>;

/** Represents single bundle */
export interface Bundle {
  code: File;
  map?: File;
}

export interface ExploreOptions {
  /** Exclude "unmapped" bytes from the output */
  onlyMapped?: boolean;
  /** Generate html */
  html?: boolean;
  /** Generate html ans save to specified file path  */
  file?: string;
  /** Disable removing prefix shared by all sources */
  noRoot?: boolean;
  replaceMap?: ReplaceMap;
}

export interface ExploreResult {
  bundles: ExploreBundleResult[];
  html?: string;
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
