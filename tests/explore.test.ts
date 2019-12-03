import { expect } from 'chai';

import { adjustSourcePaths } from '../src/explore';
import { FileSizeMap, ExploreOptions } from '../src';

interface AdjustSourcePathsTest {
  name: string;
  fileSizeMap: FileSizeMap;
  options: ExploreOptions;
  expected: FileSizeMap;
}

describe('explore', () => {
  describe('adjustSourcePaths', () => {
    const tests: AdjustSourcePathsTest[] = [
      {
        name: 'should factor out a common prefix',
        fileSizeMap: { '/src/foo.js': 10, '/src/bar.js': 20 },
        options: { noRoot: false },
        expected: { 'foo.js': 10, 'bar.js': 20 },
      },
      {
        name: 'should factor out a common prefix',
        fileSizeMap: { '/src/foo.js': 10, '/src/foodle.js': 20 },
        options: { noRoot: false },
        expected: { 'foo.js': 10, 'foodle.js': 20 },
      },
      {
        name: 'should find/replace',
        fileSizeMap: { '/src/foo.js': 10, '/src/foodle.js': 20 },
        options: {
          noRoot: true,
          replaceMap: {
            src: 'dist',
          },
        },
        expected: { '/dist/foo.js': 10, '/dist/foodle.js': 20 },
      },
      {
        name: 'should find/replace with regexp',
        fileSizeMap: { '/src/foo.js': 10, '/src/foodle.js': 20 },
        options: {
          noRoot: true,
          replaceMap: {
            'foo.': 'bar.',
          },
        },
        expected: { '/src/bar.js': 10, '/src/bar.le.js': 20 },
      },
      {
        name: 'should find/replace with regexp all instances',
        fileSizeMap: { '/src/foo/foo.js': 10, '/src/foo/app.js': 20 },
        options: {
          noRoot: true,
          replaceMap: {
            foo: 'bar',
          },
        },
        expected: { '/src/bar/bar.js': 10, '/src/bar/app.js': 20 },
      },
      {
        name: 'should find/replace with regexp, can be used to add root',
        fileSizeMap: { '/foo/foo.js': 10, '/foo/foodle.js': 20 },
        options: {
          noRoot: true,
          replaceMap: {
            '^/foo': '/bar',
          },
        },
        expected: { '/bar/foo.js': 10, '/bar/foodle.js': 20 },
      },
    ];

    tests.forEach(({ name, fileSizeMap, options, expected }) => {
      it(name, () => {
        expect(adjustSourcePaths(fileSizeMap, options)).to.deep.equal(expected);
      });
    });
  });
});
