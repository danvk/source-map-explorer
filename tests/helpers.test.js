import { expect } from 'chai';

import { getCommonPathPrefix, mapKeys } from '../src/helpers';

describe('getCommonPathPrefix', function() {
  const tests = [
    { paths: ['abc', 'abcd', 'ab'], expected: '' },
    { paths: ['/abc/def', '/bcd/efg'], expected: '/' },
    { paths: ['/abc/def', '/abc/efg'], expected: '/abc/' },
    { paths: [], expected: '' },
  ];

  tests.forEach(function({ paths, expected }) {
    it(`should find '${expected}' as common prefix of [${paths.join(', ')}]`, function() {
      expect(getCommonPathPrefix(paths)).to.deep.equal(expected);
    });
  });
});

describe('mapKeys', function() {
  const tests = [
    { obj: { a: 1, b: 2 }, mapFunc: x => x, expected: { a: 1, b: 2 } },
    { obj: { a: 1, b: 2 }, mapFunc: x => x + x, expected: { aa: 1, bb: 2 } },
    { obj: {}, mapFunc: x => x + x, expected: {} },
  ];

  tests.forEach(function({ obj, mapFunc, expected }) {
    it(`should map keys ${JSON.stringify(obj)} => ${JSON.stringify(expected)}`, function() {
      expect(mapKeys(obj, mapFunc)).to.deep.equal(expected);
    });
  });
});
