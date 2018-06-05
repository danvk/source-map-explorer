var expect = require('chai').expect;

var sourceMapExplorer = require('./index'),
  adjustSourcePaths = sourceMapExplorer.adjustSourcePaths,
  mapKeys = sourceMapExplorer.mapKeys,
  commonPathPrefix = sourceMapExplorer.commonPathPrefix,
  expandGlob = sourceMapExplorer.expandGlob;

describe('source-map-explorer', function() {
  describe('commonPathPrefix', function() {
    it('should find common prefixes', function() {
      expect(commonPathPrefix(['abc', 'abcd', 'ab'])).to.deep.equal('');  // no paths
      expect(commonPathPrefix(['/abc/def', '/bcd/efg'])).to.deep.equal('/');   // mismatch
      expect(commonPathPrefix(['/abc/def', '/abc/efg'])).to.deep.equal('/abc/');
      expect(commonPathPrefix([])).to.deep.equal('');
    });
  });

  describe('mapKeys', function() {
    it('should map keys', function() {
      expect(mapKeys({a: 1, b: 2}, function(x) { return x; }))
        .to.deep.equal({a: 1, b: 2});
      expect(mapKeys({a: 1, b: 2}, function(x) { return x + x; }))
        .to.deep.equal({aa: 1, bb: 2});
      expect(mapKeys({}, function(x) { return x + x; })) .to.deep.equal({});
    });
  });

  describe('adjustSourcePaths', function() {
    it('should factor out a common prefix', function() {
      expect(adjustSourcePaths({'/src/foo.js': 10, '/src/bar.js': 20}, true, [], []))
        .to.deep.equal({'foo.js': 10, 'bar.js': 20});
      expect(adjustSourcePaths({'/src/foo.js': 10, '/src/foodle.js': 20}, true, [], []))
        .to.deep.equal({'foo.js': 10, 'foodle.js': 20});
    });

    it('should find/replace', function() {
      expect(adjustSourcePaths({'/src/foo.js': 10, '/src/foodle.js': 20}, false, { src: 'dist' }))
        .to.deep.equal({'/dist/foo.js': 10, '/dist/foodle.js': 20});
    });

    it('should find/replace with regexp', function() {
      expect(adjustSourcePaths({'/src/foo.js': 10, '/src/foodle.js': 20}, false, { 'foo.': 'bar.' }))
        .to.deep.equal({'/src/bar.js': 10, '/src/bar.le.js': 20});
    });

    it('should find/replace with regexp, can be used to add root', function() {
      expect(adjustSourcePaths({'/foo/foo.js': 10, '/foo/foodle.js': 20}, false, { '^/foo': '/bar' }))
        .to.deep.equal({'/bar/foo.js': 10, '/bar/foodle.js': 20});
    });
  });

  describe('command line parsing', function() {
    expect(expandGlob({'<script.js>': 'testdata/foo.min.js*'})).to.deep.equal({
      '<script.js>': 'testdata/foo.min.js',
      '<script.js.map>': 'testdata/foo.min.js.map'
    });

    expect(expandGlob({
      '<script.js>': 'foo.min.js',
      '<script.js.map>': 'foo.min.js.map'
    })).to.deep.equal({
      '<script.js>': 'foo.min.js',
      '<script.js.map>': 'foo.min.js.map'
    });
  });

  describe('explore public API', function() {
    it('should generate data when provided with js file with inline map', function() {
      var fooDataInline = {
        'counts': {
          '<unmapped>': 0,
          'dist/bar.js': 2854,
          'dist/foo.js': 137,
          'node_modules/browserify/node_modules/browser-pack/_prelude.js': 463,
        },
        'numUnmapped': 0,
        'totalBytes': 3454,
      };

      expect(sourceMapExplorer('testdata/foo.min.inline-map.js')).to.deep.equal(fooDataInline);
    });

    it('should generate data when provided with file with referenced map', function() {
      var fooDataFile = {
        'counts': {
          '<unmapped>': 0,
          'dist/bar.js': 97,
          'dist/foo.js': 137,
          'node_modules/browserify/node_modules/browser-pack/_prelude.js': 463,
        },
        'numUnmapped': 0,
        'totalBytes': 697,
      };

      expect(sourceMapExplorer('testdata/foo.min.js'))
        .to.deep.equal(fooDataFile);
    });

    it('should generate data when provided with file with separated map file', function() {
      var fooDataSeparated = {
        'counts': {
          '<unmapped>': 0,
          'dist/bar.js': 62,
          'dist/foo.js': 137,
          'node_modules/browserify/node_modules/browser-pack/_prelude.js': 463,
        },
        'numUnmapped': 0,
        'totalBytes': 662,
      };

      expect(sourceMapExplorer('testdata/foo.min.no-map.js', 'testdata/foo.min.no-map.separated.js.map'))
        .to.deep.equal(fooDataSeparated);
    });

    // var fooDataReplaced = {
    //   'counts': {
    //     '<unmapped>': 0,
    //     'dist/bar.js': 97,
    //     'dist/foo.js': 137,
    //     'node_modules/browserify/node_modules/browser-pack/_prelude.js': 463,
    //   },
    //   'numUnmapped': 0,
    //   'totalBytes': 697,
    // };


  });
});
