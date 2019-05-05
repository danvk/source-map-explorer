import { expect } from 'chai';

import { getCommonPathPrefix } from '../src/helpers';

describe('helpers', () => {
  describe('getCommonPathPrefix', function() {
    const tests = [
      { paths: ['abc', 'abcd', 'ab'], expected: '' },
      { paths: ['/abc/def', '/bcd/efg'], expected: '/' },
      { paths: ['/abc/def', '/abc/efg'], expected: '/abc/' },
      { paths: ['abc'], expected: '' },
      { paths: [], expected: '' },
    ];

    tests.forEach(function({ paths, expected }) {
      it(`should find '${expected}' as common prefix of [${paths.join(', ')}]`, function() {
        expect(getCommonPathPrefix(paths)).to.deep.equal(expected);
      });
    });
  });
});
