const { expect } = require('chai');
const fs = require('fs-extra');
const path = require('path');

const { explore, exploreBundlesAndWriteHtml, adjustSourcePaths } = require('../src/api');

describe('Public API', function() {
  describe('explore', function() {
    const resultMap = {
      inline: {
        files: {
          '<unmapped>': 0,
          'dist/bar.js': 2854,
          'dist/foo.js': 137,
          'node_modules/browserify/node_modules/browser-pack/_prelude.js': 463,
        },
        unmappedBytes: 0,
        totalBytes: 3454,
      },

      inlineOnlyMapped: {
        files: {
          'dist/bar.js': 97,
          'dist/foo.js': 137,
          'node_modules/browserify/node_modules/browser-pack/_prelude.js': 463,
        },
        unmappedBytes: 0,
        totalBytes: 697,
      },

      referenced: {
        files: {
          '<unmapped>': 0,
          'dist/bar.js': 97,
          'dist/foo.js': 137,
          'node_modules/browserify/node_modules/browser-pack/_prelude.js': 463,
        },
        unmappedBytes: 0,
        totalBytes: 697,
      },

      'foo.min.no-map.js': {
        files: {
          '<unmapped>': 0,
          'dist/bar.js': 62,
          'dist/foo.js': 137,
          'node_modules/browserify/node_modules/browser-pack/_prelude.js': 463,
        },
        unmappedBytes: 0,
        totalBytes: 662,
      },
    };

    it('should generate data when provided with js file with inline map', function() {
      const actual = explore('data/foo.min.inline-map.js');

      expect(actual).to.deep.equal(resultMap.inline);
    });

    it('should generate data when provided with file with referenced map', function() {
      const actual = explore('data/foo.min.js');

      expect(actual).to.deep.equal(resultMap.referenced);
    });

    it('should generate data when provided with file with separated map file', function() {
      const actual = explore('data/foo.min.no-map.js', 'data/foo.min.no-map.separated.js.map');

      expect(actual).to.deep.equal(resultMap['foo.min.no-map.js']);
    });

    it('should generate data respecting onlyMapped and replace options', function() {
      const expected = {
        files: {
          'hello/bar.js': 97,
          'hello/foo.js': 137,
          'node_modules/browserify/node_modules/browser-pack/_prelude.js': 463,
        },
        unmappedBytes: 0,
        totalBytes: 697,
      };

      const actual = explore('data/foo.min.js', 'data/foo.min.js.map', {
        onlyMapped: true,
        replace: { dist: 'hello' },
      });

      expect(actual).to.deep.equal(expected);
    });

    it('should accept options passed as second or third argument', function() {
      const expected = resultMap.inlineOnlyMapped;

      const actual3rdArg = explore('data/foo.min.js', 'data/foo.min.js.map', {
        onlyMapped: true,
      });

      expect(actual3rdArg).to.deep.equal(expected);

      const actual2ndArg = explore('data/foo.min.js', { onlyMapped: true });

      expect(actual2ndArg).to.deep.equal(expected);
    });

    it('should accept buffer with inline map', function() {
      const actual = explore(fs.readFileSync('data/foo.min.inline-map.js'));

      expect(actual).to.deep.equal(actual);
    });

    it('should accept buffers with js and map', function() {
      const actual = explore(
        fs.readFileSync('data/foo.min.js'),
        fs.readFileSync('data/foo.min.js.map')
      );

      expect(actual).to.deep.equal(resultMap.referenced);
    });

    it('should generate html', function() {
      const actualBuffer = explore(fs.readFileSync('data/foo.min.inline-map.js'), {
        html: true,
      });

      expect(actualBuffer)
        .to.have.property('html')
        .that.contains('<title>Buffer - Source Map Explorer</title>')
        .and.contains('"bar.js')
        .and.contains('"foo.js');

      const actualInline = explore('data/foo.min.js', { html: true });

      expect(actualInline)
        .to.have.property('html')
        .that.contains('<title>data/foo.min.js - Source Map Explorer</title>')
        .and.contains('"bar.js')
        .and.contains('"foo.js');
    });

    it('should throw when specified file (js or map) not found', function() {
      expect(function() {
        explore('data/something.js');
      }).to.throw('no such file or directory');

      expect(function() {
        explore('data/foo.min.js', 'data/foo.min.js.maap');
      }).to.throw('no such file or directory');
    });

    it('should trow when cannot locate sourcemap', function() {
      expect(function() {
        explore('data/foo.min.no-map.js');
      }).to.throw('Unable to find a source map.');
    });

    it('should throw when used with bad sourcemap', function() {
      expect(function() {
        explore('data/foo.min.no-map.js', 'data/foo.min.no-map.bad-map.js.map');
      }).to.throw('Your source map only contains one source (foo.min.js)');
    });
  });

  describe('exploreBundlesAndWriteHtml', function() {
    function writeConfigToPath(writeConfig) {
      return writeConfig.path !== undefined
        ? `${writeConfig.path}/${writeConfig.fileName}`
        : writeConfig.fileName;
    }

    function expectBundleHtml(data) {
      expect(data).to.to.be.a('string');
      expect(data).to.have.string('<title>[combined] - Source Map Explorer</title>');
    }

    it('should explore multiple bundles and write a html file as specified in writeConfig', async () => {
      const writePath = path.resolve(__dirname, 'tmp');
      const writeConfig = {
        path: writePath,
        fileName: 'bundle-out.tmp.html',
      };

      await exploreBundlesAndWriteHtml(writeConfig, 'data/*.*');

      const data = fs.readFileSync(writeConfigToPath(writeConfig), 'utf8');

      expectBundleHtml(data);

      fs.removeSync(writePath);
    });

    it('should explore multiple bundles and write a html file to current directory if path is undefined in writeConfig', async function() {
      const writeConfig = { fileName: 'bundle-out.tmp.html' };

      await exploreBundlesAndWriteHtml(writeConfig, 'data/*.*');

      const data = fs.readFileSync(writeConfigToPath(writeConfig), 'utf8');

      expectBundleHtml(data);

      fs.removeSync(writeConfig.fileName);
    });
  });

  describe('adjustSourcePaths', function() {
    it('should factor out a common prefix', function() {
      [
        {
          sizes: { '/src/foo.js': 10, '/src/bar.js': 20 },
          expected: { 'foo.js': 10, 'bar.js': 20 },
        },
        {
          sizes: { '/src/foo.js': 10, '/src/foodle.js': 20 },
          expected: { 'foo.js': 10, 'foodle.js': 20 },
        },
      ].forEach(function({ sizes, expected }) {
        expect(adjustSourcePaths(sizes, true, [], [])).to.deep.equal(expected);
      });
    });

    it('should find/replace', function() {
      const expected = { '/dist/foo.js': 10, '/dist/foodle.js': 20 };

      const actual = adjustSourcePaths({ '/src/foo.js': 10, '/src/foodle.js': 20 }, false, {
        src: 'dist',
      });

      expect(actual).to.deep.equal(expected);
    });

    it('should find/replace with regexp', function() {
      const expected = { '/src/bar.js': 10, '/src/bar.le.js': 20 };

      const actual = adjustSourcePaths({ '/src/foo.js': 10, '/src/foodle.js': 20 }, false, {
        'foo.': 'bar.',
      });

      expect(actual).to.deep.equal(expected);
    });

    it('should find/replace with regexp, can be used to add root', function() {
      const expected = { '/bar/foo.js': 10, '/bar/foodle.js': 20 };

      const actual = adjustSourcePaths({ '/foo/foo.js': 10, '/foo/foodle.js': 20 }, false, {
        '^/foo': '/bar',
      });

      expect(actual).to.deep.equal(expected);
    });
  });
});
