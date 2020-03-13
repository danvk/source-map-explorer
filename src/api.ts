import glob from 'glob';
import { partition, flatMap, isString, toPairs, fromPairs, sortBy } from 'lodash';

import { exploreBundle, UNMAPPED_KEY, SPECIAL_FILENAMES } from './explore';
import { AppError, getErrorMessage } from './app-error';
import { formatOutput, saveOutputToFile } from './output';
import { addCoverageRanges } from './coverage';

import {
  Bundle,
  BundlesAndFileTokens,
  ExploreBundleResult,
  ExploreErrorResult,
  ExploreOptions,
  ExploreResult,
} from './types';

function adjustOptions(options: ExploreOptions): ExploreOptions {
  /* Unmapped bytes cannot be calculate because it's impossible to get total size by summing files'
     sizes when calculating gzip size for a file. */
  if (options.gzip) {
    options.onlyMapped = true;
  }

  return options;
}

/**
 * Analyze bundle(s)
 */
export async function explore(
  bundlesAndFileTokens: BundlesAndFileTokens,
  options: ExploreOptions = {}
): Promise<ExploreResult> {
  bundlesAndFileTokens = Array.isArray(bundlesAndFileTokens)
    ? bundlesAndFileTokens
    : [bundlesAndFileTokens];

  if (bundlesAndFileTokens.length === 0) {
    throw new AppError({ code: 'NoBundles' });
  }

  adjustOptions(options);

  // Separate bundles from file tokens
  const [fileTokens, bundles] = partition(bundlesAndFileTokens, isString);

  // Get bundles from file tokens
  bundles.push(...getBundles(fileTokens));

  addCoverageRanges(bundles, options.coverage);

  const results = await Promise.all(
    bundles.map(bundle =>
      exploreBundle(bundle, options).catch<ExploreErrorResult>(error =>
        onExploreError(bundle, error)
      )
    )
  );

  const exploreResult = getExploreResult(results, options);

  // Reject if none of results is successful
  if (exploreResult.bundles.length === 0) {
    return Promise.reject(exploreResult);
  }

  saveOutputToFile(exploreResult, options);

  return exploreResult;
}

/**
 * Expand list of file tokens into a list of bundles
 */
export function getBundles(fileTokens: string[]): Bundle[] {
  const filenames = flatMap(fileTokens, filePath =>
    glob.hasMagic(filePath) ? expandGlob(filePath) : filePath
  );

  const [mapFilenames, codeFilenames] = partition(filenames, filename => filename.endsWith('.map'));

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
    code: error.code || 'Unknown',
    message: error.message,
    error,
  };
}

function sort(bundles: ExploreBundleResult[]): ExploreBundleResult[] {
  return sortBy(bundles, bundle => bundle.bundleName).map(bundle => ({
    ...bundle,
    files: fromPairs(sortBy(toPairs(bundle.files), 0)),
  }));
}

function getExploreResult(
  results: (ExploreBundleResult | ExploreErrorResult)[],
  options: ExploreOptions
): ExploreResult {
  const [bundles, errors] = partition(
    results,
    (result): result is ExploreBundleResult => 'files' in result
  );

  const sortedBundles = sort(bundles);

  errors.push(...getPostExploreErrors(bundles));

  return {
    bundles: sortedBundles,
    errors,
    ...(bundles.length > 0 && { output: formatOutput(sortedBundles, options) }),
  };
}

function getPostExploreErrors(exploreBundleResults: ExploreBundleResult[]): ExploreErrorResult[] {
  const errors: ExploreErrorResult[] = [];

  const isSingleBundle = exploreBundleResults.length === 1;

  for (const result of exploreBundleResults) {
    const { bundleName, files, totalBytes } = result;

    // Check if source map contains only one file - this make result useless when exploring single bundle
    if (isSingleBundle) {
      const filenames = Object.keys(files).filter(
        filename => !SPECIAL_FILENAMES.includes(filename)
      );

      if (filenames.length === 1) {
        errors.push({
          bundleName,
          isWarning: true,
          code: 'OneSourceSourceMap',
          message: getErrorMessage({ code: 'OneSourceSourceMap', filename: filenames[0] }),
        });
      }
    }

    if (files[UNMAPPED_KEY] !== undefined) {
      const { size: unmappedBytes } = files[UNMAPPED_KEY];

      if (unmappedBytes) {
        errors.push({
          bundleName,
          isWarning: true,
          code: 'UnmappedBytes',
          message: getErrorMessage({ code: 'UnmappedBytes', unmappedBytes, totalBytes }),
        });
      }
    }
  }

  return errors;
}
