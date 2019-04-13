import { expect } from 'chai';

import { getBundles } from '../src/common';

describe('getBundles - file tokens parsing', function() {
  const tests = [
    {
      name: 'should expand glob',
      fileTokens: ['data/foo.min.js*'],
      expected: [
        {
          codePath: 'data/foo.min.js',
          mapPath: 'data/foo.min.js.map',
        },
      ],
    },
    {
      name: 'should return one bundle if map file specified',
      fileTokens: ['foo.min.js', 'foo.min.js.map'],
      expected: [
        {
          codePath: 'foo.min.js',
          mapPath: 'foo.min.js.map',
        },
      ],
    },
    {
      name: 'should expand glob into all bundles in directory',
      fileTokens: ['data/*.*'],
      expected: [
        {
          codePath: 'data/foo.1234.js',
          mapPath: 'data/foo.1234.js.map',
        },
        {
          codePath: 'data/foo.min.inline-map.js',
          mapPath: undefined,
        },
        {
          codePath: 'data/foo.min.js',
          mapPath: 'data/foo.min.js.map',
        },
        {
          codePath: 'data/foo.min.no-map.js',
          mapPath: undefined,
        },
      ],
    },
    {
      name: 'should expand glob including .map files',
      fileTokens: ['data/foo.1*.js'],
      expected: [
        {
          codePath: 'data/foo.1234.js',
          mapPath: 'data/foo.1234.js.map',
        },
      ],
    },
    {
      name: 'should expand glob into code and map files',
      fileTokens: ['data/foo.1*.js?(.map)'],
      expected: [
        {
          codePath: 'data/foo.1234.js',
          mapPath: 'data/foo.1234.js.map',
        },
      ],
    },
    {
      name: 'should expand multiple globs',
      fileTokens: ['data/foo.1*.js', 'data/foo.mi?.js'],
      expected: [
        {
          codePath: 'data/foo.1234.js',
          mapPath: 'data/foo.1234.js.map',
        },
        {
          codePath: 'data/foo.min.js',
          mapPath: 'data/foo.min.js.map',
        },
      ],
    },
    {
      name: 'should support single file glob when inline map',
      fileTokens: ['data/foo.min.inline*.js'],
      expected: [
        {
          codePath: 'data/foo.min.inline-map.js',
          mapPath: undefined,
        },
      ],
    },
  ];

  tests.forEach(function({ name, fileTokens, expected }) {
    it(name, function() {
      expect(getBundles(fileTokens)).to.deep.equal(expected);
    });
  });
});
