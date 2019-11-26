import { expect } from 'chai';
import { findCoveredBytes } from '../src/find-ranges';
import { CoverageData } from 'src';
import { ModuleRange } from 'src/explore';

interface Test {
  name: string;
  coveredRanges: CoverageData['ranges'];
  moduleRanges: ModuleRange[];
  expected: { [file: string]: number };
}

const tests: Test[] = [
  {
    name: 'should handle module coming before range',
    coveredRanges: [{ start: 3, end: 6 }],
    moduleRanges: [{ module: 'foo', start: 0, end: 2 }],
    expected: {},
  },
  {
    name: 'should handle module coming after range',
    coveredRanges: [{ start: 3, end: 6 }],
    moduleRanges: [{ module: 'foo', start: 7, end: 8 }],
    expected: {},
  },
  {
    name: `should handle module partially overlapping start of range`,
    coveredRanges: [{ start: 3, end: 6 }],
    moduleRanges: [{ module: 'foo', start: 2, end: 4 }],
    expected: { foo: 2 },
  },
  {
    name: `should handle module partially overlapping end of range`,
    coveredRanges: [{ start: 3, end: 6 }],
    moduleRanges: [{ module: 'foo', start: 5, end: 7 }],
    expected: { foo: 2 },
  },
  {
    name: 'should handle module being within the range',
    coveredRanges: [{ start: 3, end: 6 }],
    moduleRanges: [{ module: 'foo', start: 4, end: 5 }],
    expected: { foo: 2 },
  },
  {
    name: 'should handle module containing the entire range',
    coveredRanges: [{ start: 3, end: 6 }],
    moduleRanges: [{ module: 'foo', start: 1, end: 10 }],
    expected: { foo: 4 },
  },
  {
    name: 'should handle module matching the entire range',
    coveredRanges: [{ start: 3, end: 6 }],
    moduleRanges: [{ module: 'foo', start: 3, end: 6 }],
    expected: { foo: 4 },
  },
  {
    name: 'should handle multiple ranges',
    coveredRanges: [
      { start: 1, end: 2 },
      { start: 3, end: 6 },
      { start: 8, end: 11 },
      { start: 18, end: 20 },
    ],
    moduleRanges: [
      { module: 'foo', start: 5, end: 12 },
      { module: 'bar', start: 17, end: 19 },
      { module: 'bar', start: 20, end: 21 },
    ],
    expected: { foo: 6, bar: 3 },
  },
];

tests.forEach(test => {
  it('should handle module coming before range', () => {
    const result = findCoveredBytes(test.coveredRanges, test.moduleRanges);
    expect(result).to.deep.equal(test.expected);
  });
});
