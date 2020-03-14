import { expect } from 'chai';
import fs from 'fs';
import rimraf from 'rimraf';
import snapshot from '@smpx/snap-shot-it';

import { explore, getBundles } from '../../src/api';
import { setTestFolder, mockEOL } from '../test-helpers';

import { BundlesAndFileTokens, ExploreOptions, Bundle } from '../../src/types';

describe('api', () => {
  mockEOL();

  describe('explore', () => {
    setTestFolder();

    it('should generate data when provided with js file with inline map', async () => {
      const actual = await explore('data/inline-map.js');

      snapshot(actual);
    });

    it('should generate data when provided with file with referenced map', async () => {
      const actual = await explore('data/foo.min.js');

      snapshot(actual);
    });

    it('should generate data when provided with file with separated map file', async () => {
      const actual = await explore({
        code: 'data/no-map-comment.js',
        map: 'data/no-map-comment.js.map',
      });

      snapshot(actual);
    });

    it('should generate data respecting onlyMapped and replace options', async () => {
      const actual = await explore(
        { code: 'data/foo.min.js', map: 'data/foo.min.js.map' },
        {
          onlyMapped: true,
          replaceMap: { dist: 'hello' },
        }
      );

      snapshot(actual);
    });

    it('should generate data excluding source map bytes', async () => {
      const actual = await explore(
        ['data/inline-map.js', { code: 'data/foo.min.js', map: 'data/foo.min.js.map' }],
        {
          excludeSourceMapComment: true,
        }
      );

      snapshot(actual);
    });

    it('should generate data calculating gzip size', async () => {
      const actual = await explore(
        ['data/inline-map.js', { code: 'data/foo.min.js', map: 'data/foo.min.js.map' }],
        {
          gzip: true,
        }
      );

      snapshot(actual);
    });

    it('should sort bundles by name', async () => {
      const actual = await explore([
        'data/with-unmapped.js',
        'data/one-source.js',
        'data/null-source.js',
        'data/inline-map.js',
      ]);

      snapshot(actual);
    });

    it('should sort filenames', async () => {
      const actual = await explore('data/null-source.js', {
        sort: true,
      });

      snapshot(actual);
    });

    it('should accept buffer with inline map', async () => {
      const actual = await explore({ code: fs.readFileSync('data/inline-map.js') });

      snapshot(actual);
    });

    it('should accept buffers with js and map', async () => {
      const actual = await explore({
        code: fs.readFileSync('data/foo.min.js'),
        map: fs.readFileSync('data/foo.min.js.map'),
      });

      snapshot(actual);
    });

    it('should give name to "null" source a name', async () => {
      const actual = await explore('data/null-source.js');

      snapshot(actual);
    });

    describe('when output format specified', () => {
      it('should generate HTML from buffer', async () => {
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

      it('should generate HTML from file', async () => {
        const result = await explore('data/foo.min.js', { output: { format: 'html' } });

        expect(result)
          .to.have.property('output')
          .that.contains('<title>data/foo.min.js - Source Map Explorer</title>')
          .and.contains('"bar.js')
          .and.contains('"foo.js');
      });

      it('should generate HTML from multiple files', async () => {
        const result = await explore(['data/foo.min.js', 'data/inline-map.js'], {
          output: { format: 'html' },
        });

        expect(result)
          .to.have.property('output')
          .that.contains('<title>[combined] - Source Map Explorer</title>')
          .and.contains('"bar.js')
          .and.contains('"foo.js');
      });

      it('should generate TSV', async () => {
        const result = await explore(['data/foo.min.js', 'data/inline-map.js'], {
          output: { format: 'tsv' },
        });

        snapshot(result.output);
      });

      it('should generate JSON', async () => {
        const result = await explore('data/foo.min.js', { output: { format: 'json' } });

        snapshot(result.output);
      });
    });

    describe(`when output filename specified`, () => {
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

      tests.forEach(({ name, filename, cleanPath }) => {
        it(name, async () => {
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
          bundlesAndFileTokens: { code: 'data/no-map-comment.js' },
          expectedErrorCode: 'NoSourceMap',
        },
        {
          name: 'should throw if source map reference column beyond generated last column in line',
          bundlesAndFileTokens: 'data/invalid-map-column.js',
          expectedErrorCode: 'InvalidMappingColumn',
        },
        {
          name: 'should throw if source map reference more lines than available in source',
          bundlesAndFileTokens: 'data/invalid-map-line.js',
          expectedErrorCode: 'InvalidMappingLine',
        },
      ];

      bundleErrorTests.forEach(({ name, bundlesAndFileTokens, options, expectedErrorCode }) => {
        it(name, async () => {
          await expect(explore(bundlesAndFileTokens, options)).to.be.rejected.then(result => {
            const error = result.errors[0];

            expect(error.code).to.equal(expectedErrorCode);
          });
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
          // `/` is supposed to be invalid filename on both Linux and Windows
          options: { output: { format: 'html', filename: '/' } },
          expectedErrorCode: 'CannotSaveFile',
        },
      ];

      appErrorTests.forEach(({ name, bundlesAndFileTokens, options, expectedErrorCode }) => {
        it(name, async () => {
          await expect(explore(bundlesAndFileTokens, options)).to.be.rejected.then(error => {
            expect(error.code).to.equal(expectedErrorCode);
          });
        });
      });

      it('should not throw if at least one result is successful', async () => {
        await expect(
          explore(['data/foo.min.js', 'data/no-map-comment.js'])
        ).to.not.be.rejected.then(result => {
          expect(result.bundles.length).to.eq(1);
          expect(result.errors.length).to.eq(2);
        });
      });

      it('should not throw when analyzing source map referencing eol', async () => {
        await expect(explore('data/map-reference-eol.js')).to.not.be.rejected;
      });

      it('should add "one source" source map warning when exploring single bundle', async () => {
        const result = await explore('data/one-source.js');

        const warning = result.errors[0];

        expect(warning.isWarning).to.equal(true);
        expect(warning.code).to.equal('OneSourceSourceMap');
      });

      it('should not add "one source" source map warning when exploring multiple bundles', async () => {
        const result = await explore(['data/one-source.js', 'data/inline-map.js'], {
          onlyMapped: true,
        });

        expect(result.errors).to.have.length(0);
      });

      it('should add warning about unmapped bytes', async () => {
        const result = await explore('data/with-unmapped.js');

        const warning = result.errors[1];

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

  describe('getBundles', () => {
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
            code: 'data/big.js',
            map: undefined,
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
            code: 'data/invalid-map-column.js',
            map: undefined,
          },
          {
            code: 'data/invalid-map-line.js',
            map: undefined,
          },
          { code: 'data/map-reference-eol.js', map: undefined },
          {
            code: 'data/no-map-comment.js',
            map: 'data/no-map-comment.js.map',
          },
          { code: 'data/null-source.js', map: undefined },
          {
            code: 'data/one-source.js',
            map: undefined,
          },
          {
            code: 'data/with-unmapped.js',
            map: undefined,
          },
        ],
      },
      {
        name: 'should expand glob including .map files',
        fileTokens: ['data/foo.*.js'],
        expected: [
          {
            code: 'data/foo.min.js',
            map: 'data/foo.min.js.map',
          },
        ],
      },
      {
        name: 'should expand glob into code and map files',
        fileTokens: ['data/foo.*.js?(.map)'],
        expected: [
          {
            code: 'data/foo.min.js',
            map: 'data/foo.min.js.map',
          },
        ],
      },
      {
        name: 'should expand multiple globs',
        fileTokens: ['data/inline-*.js', 'data/foo.mi?.js'],
        expected: [
          {
            code: 'data/inline-map.js',
            map: undefined,
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

    tests.forEach(({ name, fileTokens, expected }) => {
      it(name, () => {
        expect(getBundles(fileTokens)).to.deep.equal(expected);
      });
    });
  });
});
