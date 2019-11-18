import { expect } from 'chai';
import { findCoveredBytes } from '../src/find-ranges';

it('handles module coming before range', () => {
  const result = findCoveredBytes([{ start: 3, end: 6 }], [{ module: 'foo', start: 0, end: 2 }]);
  expect(result).to.deep.equal({});
});

it('handles module coming after range', () => {
  const result = findCoveredBytes([{ start: 3, end: 6 }], [{ module: 'foo', start: 7, end: 8 }]);
  expect(result).to.deep.equal({});
});

it(`handles module partially overlapping start of range`, () => {
  const result = findCoveredBytes([{ start: 3, end: 6 }], [{ module: 'foo', start: 2, end: 4 }]);
  expect(result).to.deep.equal({ foo: 2 });
});

it(`handles module partially overlapping end of range`, () => {
  const result = findCoveredBytes([{ start: 3, end: 6 }], [{ module: 'foo', start: 5, end: 7 }]);
  expect(result).to.deep.equal({ foo: 2 });
});

it('handles module being within the range', () => {
  const result = findCoveredBytes([{ start: 3, end: 6 }], [{ module: 'foo', start: 4, end: 5 }]);
  expect(result).to.deep.equal({ foo: 2 });
});

it('handles module containing the entire range', () => {
  const result = findCoveredBytes([{ start: 3, end: 6 }], [{ module: 'foo', start: 1, end: 10 }]);
  expect(result).to.deep.equal({ foo: 4 });
});

it('handles module matching the entire range', () => {
  const result = findCoveredBytes([{ start: 3, end: 6 }], [{ module: 'foo', start: 3, end: 6 }]);
  expect(result).to.deep.equal({ foo: 4 });
});

it('handles multiple ranges', () => {
  const coveredRanges = [
    { start: 1, end: 2 },
    { start: 3, end: 6 },
    { start: 8, end: 11 },
    { start: 18, end: 20 },
  ];
  const modules = [
    { module: 'foo', start: 5, end: 12 },
    { module: 'bar', start: 17, end: 19 },
    { module: 'bar', start: 20, end: 21 },
  ];
  const result = findCoveredBytes(coveredRanges, modules);
  expect(result).to.deep.equal({ foo: 6, bar: 3 });
});
