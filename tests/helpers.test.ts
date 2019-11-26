import { expect } from 'chai';

import {
  formatBytes,
  getCommonPathPrefix,
  getFirstRegexMatch,
  getOccurrencesCount,
} from '../src/helpers';

describe('helpers', () => {
  describe('formatBytes', () => {
    const tests = [
      { bytes: 0, expected: '0 B' },
      { bytes: 1024, expected: '1 KB' },
      { bytes: 27291, expected: '26.65 KB' },
      { bytes: 6232294, expected: '5.94 MB' },
    ];

    tests.forEach(({ bytes, expected }) => {
      it(`should format '${bytes}' as '${expected}'`, () => {
        expect(formatBytes(bytes)).to.equal(expected);
      });
    });
  });

  describe('getCommonPathPrefix', () => {
    const tests = [
      { paths: ['abc', 'abcd', 'ab'], expected: '' },
      { paths: ['/abc/def', '/bcd/efg'], expected: '/' },
      { paths: ['/abc/def', '/abc/efg'], expected: '/abc/' },
      { paths: ['abc'], expected: '' },
      { paths: [], expected: '' },
    ];

    tests.forEach(({ paths, expected }) => {
      it(`should find '${expected}' as common prefix of [${paths.join(', ')}]`, () => {
        expect(getCommonPathPrefix(paths)).to.deep.equal(expected);
      });
    });
  });

  describe('getFirstRegexMatch', () => {
    const tests = [
      { regex: /\/\/.+$/, string: 'const a = 4 // bad var name', expected: '// bad var name' },
      { regex: /foo/, string: 'A man walks into a bar..', expected: null },
    ];

    tests.forEach(({ regex, string, expected }) => {
      it(`should return '${expected}' as first match of '${regex}' from '${string}'`, () => {
        expect(getFirstRegexMatch(regex, string)).to.equal(expected);
      });
    });
  });

  describe('getOccurrencesCount', () => {
    const tests = [
      { string: '', subString: 'foo', expected: 0 },
      { string: 'fo foo bar foofoo', subString: 'foo', expected: 3 },
      {
        string: 'this\nis\na\nmultiline\nstring\n',
        subString: '\n',
        expected: 5,
      },
    ];

    tests.forEach(({ subString, string, expected }) => {
      it(`should find ${expected} occurrences of '${subString}' inside '${string}'`, () => {
        expect(getOccurrencesCount(subString, string)).to.equal(expected);
      });
    });
  });
});
