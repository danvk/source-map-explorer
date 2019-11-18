export function findCoveredBytes(coveredRanges, moduleRanges): { [module: string]: number } {
  const sortedCoverageRanges = coveredRanges.sort((a, b) => a.start - b.start);
  const sortedModuleRanges = moduleRanges.sort((a, b) => a.start - b.start);

  let i = 0;
  let j = 0;
  const sizes = {};

  while (i < moduleRanges.length && j < coveredRanges.length) {
    const moduleRange = sortedModuleRanges[i];
    const coverageRange = sortedCoverageRanges[j];

    if (moduleRange.start <= coverageRange.end && moduleRange.end >= coverageRange.start) {
      // overlaps, calculate amount, move to next coverage range
      const end = Math.min(coverageRange.end, moduleRange.end);
      const start = Math.max(moduleRange.start, coverageRange.start);
      if (sizes[moduleRange.module] === undefined) {
        sizes[moduleRange.module] = 0;
      }
      sizes[moduleRange.module] += end - start + 1;

      if (
        sortedModuleRanges[i + 1] !== undefined &&
        sortedModuleRanges[i + 1].start <= coverageRange.end &&
        sortedModuleRanges[i + 1].end >= coverageRange.start
      ) {
        // next module also overlaps current coverage range, advance to next module instead of advancing coverage
        i++;
      } else {
        // check next coverage range, it may also overlap this module range
        j++;
      }
    } else if (moduleRange.end < coverageRange.start) {
      // module comes entirely before coverageRange, check next module range
      i++;
    }
    if (coverageRange.end < moduleRange.start) {
      // module range comes entirely after coverage range, check next coverage range
      j++;
    }
  }

  return sizes;
}
