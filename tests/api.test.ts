import { expect } from 'chai';
import fs from 'fs';
import rimraf from 'rimraf';
import snapshot from '@smpx/snap-shot-it';

import { explore, getBundles } from '../src/api';
import { setTestFolder, mockEOL } from './test-helpers';
import { BundlesAndFileTokens, ExploreOptions, Bundle } from '../src';

describe('api', () => {
  mockEOL();

  describe('explore', function() {
    setTestFolder();

    it('should generate data when provided with js file with inline map', async function() {
      const actual = await explore('data/inline-map.js');

      snapshot(actual);
    });

    it('should generate data when provided with file with referenced map', async function() {
      const actual = await explore('data/foo.min.js');

      snapshot(actual);
    });

    it('should generate data when provided with file with separated map file', async function() {
      const actual = await explore({
        code: 'data/no-map.js',
        map: 'data/no-map.js.map',
      });

      snapshot(actual);
    });

    it('should generate data respecting onlyMapped and replace options', async function() {
      const actual = await explore(
        { code: 'data/foo.min.js', map: 'data/foo.min.js.map' },
        {
          onlyMapped: true,
          replaceMap: { dist: 'hello' },
        }
      );

      snapshot(actual);
    });

    it('should accept buffer with inline map', async function() {
      const actual = await explore({ code: fs.readFileSync('data/inline-map.js') });

      snapshot(actual);
    });

    it('should accept buffers with js and map', async function() {
      const actual = await explore({
        code: fs.readFileSync('data/foo.min.js'),
        map: fs.readFileSync('data/foo.min.js.map'),
      });

      snapshot(actual);
    });

    describe('when output format specified', function() {
      it('should generate HTML from buffer', async function() {
        const result = await explore(
          { code: fs.readFileSync('data/inline-map.js') },
          { output: { format: 'html' } }
        );

        expect(result)
          .to.have.property('output')
          .that.contains('<title>Buffer - Source Map Explorer</title>')
          .and.contains('"bar.js')
          .and.contains('"foo.js');
      });

      it('should generate HTML from file', async function() {
        const result = await explore('data/foo.min.js', { output: { format: 'html' } });

        expect(result)
          .to.have.property('output')
          .that.contains('<title>data/foo.min.js - Source Map Explorer</title>')
          .and.contains('"bar.js')
          .and.contains('"foo.js');
      });

      it('should generate HTML from multiple files', async function() {
        const result = await explore(['data/foo.min.js', 'data/inline-map.js'], {
          output: { format: 'html' },
        });

        expect(result)
          .to.have.property('output')
          .that.contains('<title>[combined] - Source Map Explorer</title>')
          .and.contains('"bar.js')
          .and.contains('"foo.js');
      });

      it('should generate TSV', async function() {
        const result = await explore(['data/foo.min.js', 'data/inline-map.js'], {
          output: { format: 'tsv' },
        });

        snapshot(result.output);
      });

      it('should generate JSON', async function() {
        const result = await explore('data/foo.min.js', { output: { format: 'json' } });

        snapshot(result.output);
      });
    });

    describe(`when output filename specified`, function() {
      const tests: {
        name: string;
        filename: string;
        cleanPath?: string;
      }[] = [
        {
          name: 'should save html to file',
          filename: 'sme-result.html',
        },
        {
          name: 'should save html to file creating nested directories',
          filename: './tmp/nested/sme-result.html',
          cleanPath: './tmp',
        },
      ];

      tests.forEach(function({ name, filename, cleanPath }) {
        it(name, async function() {
          await explore('data/inline-map.js', {
            output: { format: 'html', filename },
          });

          expect(fs.existsSync(filename)).to.eq(true);

          const htmlContent = fs.readFileSync(filename).toString();
          expect(htmlContent).to.have.string(
            '<title>data/inline-map.js - Source Map Explorer</title>'
          );

          rimraf.sync(cleanPath || filename);
        });
      });
    });

    interface OnErrorTest {
      name: string;
      bundlesAndFileTokens: BundlesAndFileTokens;
      expectedErrorCode: string;
      options?: ExploreOptions;
    }

    describe('on error', () => {
      const bundleErrorTests: OnErrorTest[] = [
        {
          name: 'should throw when specified js file not found',
          bundlesAndFileTokens: 'data/something.js',
          expectedErrorCode: 'ENOENT',
        },
        {
          name: 'should throw when specified map file not found',
          bundlesAndFileTokens: { code: 'data/foo.min.js', map: 'data/foo.min.js.maap' },
          expectedErrorCode: 'ENOENT',
        },
        {
          name: 'should throw when cannot locate sourcemap',
          bundlesAndFileTokens: { code: 'data/no-map.js' },
          expectedErrorCode: 'NoSourceMap',
        },
      ];

      bundleErrorTests.forEach(function({
        name,
        bundlesAndFileTokens,
        options,
        expectedErrorCode,
      }) {
        it(name, async function() {
          try {
            await explore(bundlesAndFileTokens, options);
          } catch (result) {
            const error = result.errors[0];
            expect(error.code).to.equal(expectedErrorCode);
          }
        });
      });

      const appErrorTests: OnErrorTest[] = [
        {
          name: 'should throw when no bundles provided',
          bundlesAndFileTokens: [],
          expectedErrorCode: 'NoBundles',
        },
        {
          name: 'should throw when cannot save html to file',
          bundlesAndFileTokens: 'data/inline-map.js',
          options: { output: { format: 'html', filename: '?' } },
          expectedErrorCode: 'CannotSaveFile',
        },
      ];

      appErrorTests.forEach(function({ name, bundlesAndFileTokens, options, expectedErrorCode }) {
        it(name, async function() {
          try {
            await explore(bundlesAndFileTokens, options);
          } catch (error) {
            expect(error.code).to.equal(expectedErrorCode);
          }
        });
      });

      it('should not throw if at least one result is successful', async function() {
        const result = await explore(['data/foo.min.js', 'data/no-map.js']);

        expect(result.bundles.length).to.eq(1);
        expect(result.errors.length).to.eq(2);
      });

      it('should add error when used with bad sourcemap', async function() {
        const result = await explore('data/foo.min.no-map.bad-map.js');

        const error = result.errors[0];

        expect(error.code).to.equal('OneSourceSourceMap');
      });

      it('should throw if source map reference column beyond generated last column in line', async function() {
        try {
          await explore('data/invalid-map-column.js');
        } catch (errorResult) {
          const error = errorResult.errors[0];

          expect(error.code).to.equal('InvalidMappingColumn');
        }
      });

      it('should add warning about unmapped bytes', async function() {
        const result = await explore('data/with-unmapped.js');

        const warning = result.errors[0];

        expect(warning.isWarning).to.equal(true);
        expect(warning.code).to.equal('UnmappedBytes');
      });
    });
  });

  interface GetBundlesTest {
    name: string;
    fileTokens: string[];
    expected: Bundle[];
  }

  describe('getBundles', function() {
    setTestFolder();

    const tests: GetBundlesTest[] = [
      {
        name: 'should expand glob',
        fileTokens: ['data/foo.min.js*'],
        expected: [
          {
            code: 'data/foo.min.js',
            map: 'data/foo.min.js.map',
          },
        ],
      },
      {
        name: 'should group code and map file into bundle',
        fileTokens: ['data/foo.min.js', 'data/foo.min.js.map'],
        expected: [
          {
            code: 'data/foo.min.js',
            map: 'data/foo.min.js.map',
          },
        ],
      },
      {
        name: 'should expand glob into all bundles in directory',
        fileTokens: ['data/*.*'],
        expected: [
          {
            code: 'data/foo.1234.js',
            map: 'data/foo.1234.js.map',
          },
          {
            code: 'data/foo.min.js',
            map: 'data/foo.min.js.map',
          },
          {
            code: 'data/foo.min.no-map.bad-map.js',
            map: 'data/foo.min.no-map.bad-map.js.map',
          },
          {
            code: 'data/inline-map.js',
            map: undefined,
          },
          {
            code: 'data/invalid-map-column.js',
            map: undefined,
          },
          {
            code: 'data/invalid-map-line.js',
            map: undefined,
          },
          { code: 'data/map-reference-eol.js', map: undefined },
          {
            code: 'data/no-map.js',
            map: 'data/no-map.js.map',
          },
          {
            code: 'data/with-unmapped.js',
            map: 'data/with-unmapped.js.map',
          },
        ],
      },
      {
        name: 'should expand glob including .map files',
        fileTokens: ['data/foo.1*.js'],
        expected: [
          {
            code: 'data/foo.1234.js',
            map: 'data/foo.1234.js.map',
          },
        ],
      },
      {
        name: 'should expand glob into code and map files',
        fileTokens: ['data/foo.1*.js?(.map)'],
        expected: [
          {
            code: 'data/foo.1234.js',
            map: 'data/foo.1234.js.map',
          },
        ],
      },
      {
        name: 'should expand multiple globs',
        fileTokens: ['data/foo.1*.js', 'data/foo.mi?.js'],
        expected: [
          {
            code: 'data/foo.1234.js',
            map: 'data/foo.1234.js.map',
          },
          {
            code: 'data/foo.min.js',
            map: 'data/foo.min.js.map',
          },
        ],
      },
      {
        name: 'should support single file glob when inline map',
        fileTokens: ['data/inline*.js'],
        expected: [
          {
            code: 'data/inline-map.js',
            map: undefined,
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
});
