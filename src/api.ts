import fs from 'fs';
import path from 'path';
import glob from 'glob';

import { generateHtml } from './html';
import { FileSizes, exploreBundle, UNMAPPED_KEY } from './explore';
import { AppError, ErrorCode, getErrorMessage } from './app-error';

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

/**
 * Analyze bundle(s)
 */
export async function explore(
  bundlesAndFileTokens: BundlesAndFileTokens,
  options?: ExploreOptions
): Promise<ExploreResult> {
  const bundles: Bundle[] = [];
  const fileTokens: string[] = [];

  bundlesAndFileTokens = Array.isArray(bundlesAndFileTokens)
    ? bundlesAndFileTokens
    : [bundlesAndFileTokens];

  if (bundlesAndFileTokens.length === 0) {
    throw new AppError(ErrorCode.NoBundles);
  }

  // Separate bundles from file tokens
  bundlesAndFileTokens.forEach(item => {
    if (typeof item === 'string') {
      fileTokens.push(item);
    } else {
      bundles.push(item);
    }
  });

  // Get bundles from file tokens
  bundles.push(...getBundles(fileTokens));

  return Promise.all(
    bundles.map(bundle =>
      exploreBundle(bundle, options).catch<ExploreErrorResult>(error =>
        onExploreError(bundle, error)
      )
    )
  )
    .then(results => getExploreResult(results, options))
    .then(result => {
      // Reject if none of results is successful
      if (result.bundles.length === 0) {
        return Promise.reject(result);
      }

      saveHtmlToFile(result, options);

      return result;
    });
}

/**
 * Expand list of file tokens into a list of bundles
 */
export function getBundles(fileTokens: string[]): Bundle[] {
  const filenames = fileTokens.reduce<string[]>((result, filePath) => {
    if (glob.hasMagic(filePath)) {
      result.push(...expandGlob(filePath));
    } else {
      result.push(filePath);
    }

    return result;
  }, []);

  const codeFilenames: string[] = [];
  const mapFilenames: string[] = [];

  filenames.forEach(filename => {
    if (filename.endsWith('.map')) {
      mapFilenames.push(filename);
    } else {
      codeFilenames.push(filename);
    }
  });

  return codeFilenames.map<Bundle>(code => ({
    code,
    map: mapFilenames.find(filename => filename === `${code}.map`),
  }));
}

function expandGlob(pattern: string): string[] {
  // Make sure pattern match `.map` files as well
  if (pattern.endsWith('.js')) {
    pattern = `${pattern}?(.map)`;
  }

  return glob.sync(pattern);
}

export function getBundleName(bundle: Bundle): string {
  return Buffer.isBuffer(bundle.code) ? 'Buffer' : bundle.code;
}

/**
 * Handle error during bundle processing
 */
function onExploreError(bundle: Bundle, error: NodeJS.ErrnoException): ExploreErrorResult {
  return {
    bundleName: getBundleName(bundle),
    code: error.code || ErrorCode.Unknown,
    message: error.message,
    error,
  };
}

function getExploreResult(
  results: (ExploreBundleResult | ExploreErrorResult)[],
  options: ExploreOptions = {}
): ExploreResult {
  const bundles: ExploreBundleResult[] = [];
  const errors: ExploreErrorResult[] = [];

  results.forEach(result => {
    if ((result as ExploreBundleResult).files) {
      bundles.push(result as ExploreBundleResult);
    } else {
      errors.push(result as ExploreErrorResult);
    }
  });

  errors.push(...getPostExploreErrors(bundles));

  return {
    bundles,
    errors,
    ...((options.html || options.file) && { html: generateHtml(bundles) }),
  };
}

function getPostExploreErrors(exploreBundleResult: ExploreBundleResult[]): ExploreErrorResult[] {
  return exploreBundleResult.reduce<ExploreErrorResult[]>((result, exploreBundleResult) => {
    const { bundleName, files, totalBytes } = exploreBundleResult;

    const filenames = Object.keys(files).filter(filename => filename !== UNMAPPED_KEY);
    if (filenames.length === 1) {
      result.push({
        bundleName,
        code: ErrorCode.OneSourceSourceMap,
        message: getErrorMessage(ErrorCode.OneSourceSourceMap, { filename: filenames[0] }),
      });
    }

    const unmappedBytes = files[UNMAPPED_KEY];
    if (unmappedBytes) {
      result.push({
        bundleName,
        isWarning: true,
        code: ErrorCode.UnmappedBytes,
        message: getErrorMessage(ErrorCode.UnmappedBytes, { unmappedBytes, totalBytes }),
      });
    }

    return result;
  }, []);
}

function saveHtmlToFile(result: ExploreResult, options: ExploreOptions = {}): void {
  if (result.html && options.file) {
    try {
      const filename = options.file;
      const dir = path.dirname(filename);

      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(options.file, result.html);
    } catch (error) {
      throw new AppError(ErrorCode.CannotSaveFile, error);
    }
  }
}
