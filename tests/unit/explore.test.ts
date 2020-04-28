import { expect } from 'chai';

import { adjustSourcePaths } from '../../src/lib/explore';

import type { FileDataMap, ExploreOptions } from '../../src/lib/types';

interface AdjustSourcePathsTest {
  name: string;
  fileSizeMap: FileDataMap;
  options: ExploreOptions;
  expected: FileDataMap;
}

describe('explore', () => {
  describe('adjustSourcePaths', () => {
    const tests: AdjustSourcePathsTest[] = [
      {
        name: 'should factor out a common prefix',
        fileSizeMap: { '/src/foo.js': { size: 10 }, '/src/bar.js': { size: 20 } },
        options: { noRoot: false },
        expected: { 'foo.js': { size: 10 }, 'bar.js': { size: 20 } },
      },
      {
        name: 'should factor out a common prefix',
        fileSizeMap: { '/src/foo.js': { size: 10 }, '/src/foodle.js': { size: 20 } },
        options: { noRoot: false },
        expected: { 'foo.js': { size: 10 }, 'foodle.js': { size: 20 } },
      },
      {
        name: 'should find/replace',
        fileSizeMap: { '/src/foo.js': { size: 10 }, '/src/foodle.js': { size: 20 } },
        options: {
          noRoot: true,
          replaceMap: {
            src: 'dist',
          },
        },
        expected: { '/dist/foo.js': { size: 10 }, '/dist/foodle.js': { size: 20 } },
      },
      {
        name: 'should find/replace with regexp',
        fileSizeMap: { '/src/foo.js': { size: 10 }, '/src/foodle.js': { size: 20 } },
        options: {
          noRoot: true,
          replaceMap: {
            'foo.': 'bar.',
          },
        },
        expected: { '/src/bar.js': { size: 10 }, '/src/bar.le.js': { size: 20 } },
      },
      {
        name: 'should find/replace with regexp all instances',
        fileSizeMap: { '/src/foo/foo.js': { size: 10 }, '/src/foo/app.js': { size: 20 } },
        options: {
          noRoot: true,
          replaceMap: {
            foo: 'bar',
          },
        },
        expected: { '/src/bar/bar.js': { size: 10 }, '/src/bar/app.js': { size: 20 } },
      },
      {
        name: 'should find/replace with regexp, can be used to add root',
        fileSizeMap: { '/foo/foo.js': { size: 10 }, '/foo/foodle.js': { size: 20 } },
        options: {
          noRoot: true,
          replaceMap: {
            '^/foo': '/bar',
          },
        },
        expected: { '/bar/foo.js': { size: 10 }, '/bar/foodle.js': { size: 20 } },
      },
    ];

    tests.forEach(({ name, fileSizeMap, options, expected }) => {
      it(name, () => {
        expect(adjustSourcePaths(fileSizeMap, options)).to.deep.equal(expected);
      });
    });
  });
});
