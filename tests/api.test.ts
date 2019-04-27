import { expect } from 'chai';
import fs from 'fs';
import rimraf from 'rimraf';
import snapshot from '@smpx/snap-shot-it';

import { explore, getBundles, Bundle, BundlesAndFileTokens, ExploreOptions } from '../src/api';
import { setTestFolder } from './test-helpers';
import { ErrorCode } from '../src/app-error';

describe('api', () => {
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

    describe(`when 'html' option specified`, function() {
      it('should generate html from buffer', async function() {
        const result = await explore(
          { code: fs.readFileSync('data/inline-map.js') },
          { html: true }
        );

        expect(result)
          .to.have.property('html')
          .that.contains('<title>Buffer - Source Map Explorer</title>')
          .and.contains('"bar.js')
          .and.contains('"foo.js');
      });

      it('should generate html from file', async function() {
        const result = await explore('data/foo.min.js', { html: true });

        expect(result)
          .to.have.property('html')
          .that.contains('<title>data/foo.min.js - Source Map Explorer</title>')
          .and.contains('"bar.js')
          .and.contains('"foo.js');
      });

      it('should generate html from multiple files', async function() {
        const result = await explore(['data/foo.min.js', 'data/inline-map.js'], { html: true });

        expect(result)
          .to.have.property('html')
          .that.contains('<title>[combined] - Source Map Explorer</title>')
          .and.contains('"bar.js')
          .and.contains('"foo.js');
      });
    });

    describe(`when 'file' option specified`, function() {
      const tests: {
        name: string;
        file: string;
        cleanPath?: string;
      }[] = [
        {
          name: 'should save html to file',
          file: 'sme-result.html',
        },
        {
          name: 'should save html to file creating nested directories',
          file: './tmp/nested/sme-result.html',
          cleanPath: './tmp',
        },
      ];

      tests.forEach(function({ name, file, cleanPath }) {
        it(name, async function() {
          await explore('data/inline-map.js', {
            file,
          });

          expect(fs.existsSync(file)).to.eq(true);

          const htmlContent = fs.readFileSync(file).toString();
          expect(htmlContent).to.have.string(
            '<title>data/inline-map.js - Source Map Explorer</title>'
          );

          rimraf.sync(cleanPath || file);
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
          expectedErrorCode: ErrorCode.NoSourceMap,
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
          expectedErrorCode: ErrorCode.NoBundles,
        },
        {
          name: 'should throw when cannot save html to file',
          bundlesAndFileTokens: 'data/inline-map.js',
          options: { file: '?' },
          expectedErrorCode: ErrorCode.CannotSaveFile,
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
        expect(result.errors.length).to.eq(1);
      });

      it('should add error when used with bad sourcemap', async function() {
        const result = await explore({
          code: 'data/no-map.js',
          map: 'data/foo.min.no-map.bad-map.js.map',
        });

        const error = result.errors[0];

        expect(error.code).to.equal(ErrorCode.OneSourceSourceMap);
      });

      it('should add warning about unmapped bytes', async function() {
        const result = await explore('data/with-unmapped.js');

        const warning = result.errors[0];

        expect(warning.isWarning).to.equal(true);
        expect(warning.code).to.equal(ErrorCode.UnmappedBytes);
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
            code: 'data/inline-map.js',
            map: undefined,
          },
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
