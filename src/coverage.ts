import { Bundle, Coverage, ColumnsRange, MappingRange, FileDataMap } from './index';
import { getFileContent, detectEOL } from './helpers';
import { AppError } from './app-error';

/**
 * Convert one-line coverage ranges (exclusive) into per line ranges (inclusive)
 */
function convertRangesToLinesRanges(coverage: Coverage): ColumnsRange[][] {
  const { ranges, text } = coverage;

  const eol = detectEOL(text);
  const eolLength = eol.length;
  const lines = text.split(eol);

  // Current line offset
  let offset = 0;

  const lineRanges = lines.map(line => {
    const lineLength = line.length;

    if (lineLength === 0) {
      return [];
    }

    // Exclusive line start/end
    const lineStart = offset;
    const lineEnd = offset + lineLength;

    const lineRanges = ranges.reduce<ColumnsRange[]>((result, { start, end }) => {
      // Inclusive range start/end within the line
      const startIndex = start - lineStart;
      const endIndex = end - lineStart - 1;
      const lineEndIndex = lineLength - 1;

      if (start <= lineStart && lineEnd <= end) {
        // Range includes line range
        result.push({ start: 0, end: lineEndIndex });
      } else if (lineStart <= start && end <= lineEnd) {
        // Line range includes range
        result.push({ start: startIndex, end: endIndex });
      } else if (lineStart <= start && start <= lineEnd) {
        // Range starts within line range
        result.push({ start: startIndex, end: lineEndIndex });
      } else if (lineStart <= end && end <= lineEnd) {
        // Range ends within line range
        result.push({ start: 0, end: endIndex });
      }

      return result;
    }, []);

    // Move to next line jumping over EOL character
    offset = lineEnd + eolLength;

    return lineRanges;
  });

  return lineRanges;
}

const PATH_SEPARATOR_REGEX = /[/\\]/;

function getPathParts(path: string): string[] {
  return path.split(PATH_SEPARATOR_REGEX).filter(Boolean);
}

/**
 * Match coverages' ranges to bundles by comparing coverage URL and bundle filename
 */
export function addCoverageRanges(bundles: Bundle[], coverageFilename?: string): Bundle[] {
  if (!coverageFilename) {
    return bundles;
  }

  try {
    const coverages: Coverage[] = JSON.parse(getFileContent(coverageFilename));

    const coveragePaths = coverages
      .map(({ url }) => getPathParts(new URL(url).pathname || '').reverse())
      /**
       * Scripts inlined to HTML doc will have the url of the HTML document.
       * Example: { url: "https://google.com/", ranges: [...] }
       *
       * When this happens, we ended up with an empty array. This will cause
       * for loop below (for (let i = 0; i < partsA.length; i++) )
       * to never be run. Causing false positive because matchingBundles.length will equal to 1.
       */
      .filter(cov => cov.length > 0);

    const bundlesPaths = bundles.reduce<[string[], number][]>((result, { code }, index) => {
      if (!Buffer.isBuffer(code)) {
        result.push([getPathParts(code).reverse(), index]);
      }

      return result;
    }, []);

    coveragePaths.forEach((partsA, coverageIndex) => {
      let matchingBundles = [...bundlesPaths];

      // Start from filename and go up to path root
      for (let i = 0; i < partsA.length; i++) {
        matchingBundles = matchingBundles.filter(
          ([partsB]) => i < partsB.length && partsB[i] === partsA[i]
        );

        // Stop when exact (among bundles) match found or no matches found
        if (matchingBundles.length <= 1) {
          break;
        }
      }

      if (matchingBundles.length === 1) {
        const [[, bundleIndex]] = matchingBundles;

        bundles[bundleIndex].coverageRanges = convertRangesToLinesRanges(coverages[coverageIndex]);
      }
    });
  } catch (error) {
    throw new AppError({ code: 'CannotOpenCoverageFile' }, error);
  }

  if (bundles.every(({ coverageRanges }) => coverageRanges === undefined)) {
    throw new AppError({ code: 'NoCoverageMatches' });
  }

  return bundles;
}

/**
 * Find overlaps in arrays of column ranges, using ratcheting pointers instead of nested loops for
 * O(n) runtime instead of O(n^2)
 */
function findCoveredMappingRanges(
  mappingRanges: MappingRange[],
  coveredRanges: ColumnsRange[]
): MappingRange[] {
  let i = 0;
  let j = 0;

  const result: MappingRange[] = [];

  while (i < mappingRanges.length && j < coveredRanges.length) {
    const mappingRange = mappingRanges[i];
    const coveredRange = coveredRanges[j];

    if (mappingRange.start <= coveredRange.end && coveredRange.start <= mappingRange.end) {
      // Overlaps, calculate amount, move to next coverage range
      const end = Math.min(coveredRange.end, mappingRange.end);
      const start = Math.max(mappingRange.start, coveredRange.start);

      result.push({
        start,
        end,
        source: mappingRange.source,
      });

      if (
        mappingRanges[i + 1] !== undefined &&
        mappingRanges[i + 1].start <= coveredRange.end &&
        mappingRanges[i + 1].end >= coveredRange.start
      ) {
        // Next module also overlaps current coverage range, advance to next module instead of advancing coverage
        i++;
      } else {
        // Check next coverage range, it may also overlap this module range
        j++;
      }
    } else if (mappingRange.end < coveredRange.start) {
      // Module comes entirely before coverageRange, check next module range
      i++;
    }
    if (coveredRange.end < mappingRange.start) {
      // Module range comes entirely after coverage range, check next coverage range
      j++;
    }
  }

  return result;
}

/**
 * Set covered size for files
 */
export function setCoveredSizes(
  line: string,
  files: FileDataMap,
  mappingRanges: MappingRange[],
  coveredRanges: ColumnsRange[]
): FileDataMap {
  findCoveredMappingRanges(mappingRanges, coveredRanges).forEach(({ start, end, source }) => {
    const rangeByteLength = Buffer.byteLength(line.substring(start, end + 1));

    let coveredSize = files[source].coveredSize || 0;

    coveredSize += rangeByteLength;

    files[source].coveredSize = coveredSize;
  });

  return files;
}

const percentColors = [
  { percent: 0.0, color: { r: 0xff, g: 0x00, b: 0 } },
  { percent: 0.5, color: { r: 0xff, g: 0xff, b: 0 } },
  { percent: 1.0, color: { r: 0x00, g: 0xff, b: 0 } },
];

/**
 * Get heat map color by coverage percent
 */
export function getColorByPercent(percent: number): string {
  let i = 1;

  for (; i < percentColors.length - 1; i++) {
    if (percent < percentColors[i].percent) {
      break;
    }
  }

  const lowerColor = percentColors[i - 1];
  const upperColor = percentColors[i];
  const rangeWithinColors = upperColor.percent - lowerColor.percent;
  const rangePercent = (percent - lowerColor.percent) / rangeWithinColors;
  const percentLower = 1 - rangePercent;
  const percentUpper = rangePercent;

  const r = Math.floor(lowerColor.color.r * percentLower + upperColor.color.r * percentUpper);
  const g = Math.floor(lowerColor.color.g * percentLower + upperColor.color.g * percentUpper);
  const b = Math.floor(lowerColor.color.b * percentLower + upperColor.color.b * percentUpper);

  return `rgb(${r}, ${g}, ${b})`;
}
