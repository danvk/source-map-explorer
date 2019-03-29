import { expect } from 'chai';

import { getBundles } from '../src/common';

describe('getBundles - command line parsing', function() {
  const tests = [
    {
      name: 'should expand glob',
      args: ['data/foo.min.js*'],
      expected: [
        {
          codePath: 'data/foo.min.js',
          mapPath: 'data/foo.min.js.map',
        },
      ],
    },
    {
      name: 'should return one bundle if map file specified',
      args: ['foo.min.js', 'foo.min.js.map'],
      expected: [
        {
          codePath: 'foo.min.js',
          mapPath: 'foo.min.js.map',
        },
      ],
    },
    {
      name: 'should expand glob into all bundles in directory',
      args: ['data/*.*'],
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
      name: 'should support single file glob',
      args: ['data/foo.1*.js'],
      expected: [
        {
          codePath: 'data/foo.1234.js',
          mapPath: 'data/foo.1234.js.map',
        },
      ],
    },
    {
      name: 'should support single file glob when inline map',
      args: ['data/foo.min.inline*.js'],
      expected: [
        {
          codePath: 'data/foo.min.inline-map.js',
          mapPath: undefined,
        },
      ],
    },
  ];

  tests.forEach(function({ name, args, expected }) {
    it(name, function() {
      expect(getBundles(...args)).to.deep.equal(expected);
    });
  });
});
