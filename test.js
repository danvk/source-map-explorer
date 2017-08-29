var expect = require('chai').expect;

var sourceMapExplorer = require('./index'),
  adjustSourcePaths = sourceMapExplorer.adjustSourcePaths,
  mapKeys = sourceMapExplorer.mapKeys,
  commonPathPrefix = sourceMapExplorer.commonPathPrefix,
  expandGlob = sourceMapExplorer.expandGlob,
  mergeNullSeparatedSpans = sourceMapExplorer.mergeNullSeparatedSpans;

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
      expect(adjustSourcePaths({'/src/foo.js': 10, '/src/foodle.js': 20}, false, ['src'], ['dist']))
        .to.deep.equal({'/dist/foo.js': 10, '/dist/foodle.js': 20});
    });

    it('should find/replace with regexp', function() {
      expect(adjustSourcePaths({'/src/foo.js': 10, '/src/foodle.js': 20}, false, ['foo.'], ['bar.']))
        .to.deep.equal({'/src/bar.js': 10, '/src/bar.le.js': 20});
    });

    it('should find/replace with regexp, can be used to add root', function() {
      expect(adjustSourcePaths({'/foo/foo.js': 10, '/foo/foodle.js': 20}, false, ['^/foo'], ['/bar']))
        .to.deep.equal({'/bar/foo.js': 10, '/bar/foodle.js': 20});
    });
  });

  describe('command line parsing', function() {
    expect(expandGlob({'<script.js>': 'testdata/foo.min.js*'})).to.deep.equal({
      '<script.js>': 'testdata/foo.min.js',
      '<script.js.map>': 'testdata/foo.min.js.map',
    });

    expect(expandGlob({
      '<script.js>': 'foo.min.js',
      '<script.js.map>': 'foo.min.js.map'
    })).to.deep.equal({
      '<script.js>': 'foo.min.js',
      '<script.js.map>': 'foo.min.js.map'
    });
  });

  describe('mergeNullSeparatedSpans', function() {
    var merge = mergeNullSeparatedSpans;
    var p = function(source, numChars) {
      return { source: source, numChars: numChars };
    };

    it('should merge null gaps', function() {
      expect(merge([
        p('F1', 10),
        p(null, 10),
        p('F1', 20),
        p('F2', 30)
      ])).to.deep.equal([
        {source: 'F1', numChars: 40},
        {source: 'F2', numChars: 30}
      ]);
    });

    it('should handle leading nulls', function() {
      expect(merge([
        p(null, 10),
        p('F1', 10),
        p(null, 10),
        p('F1', 20)
      ])).to.deep.equal([
        {source: null, numChars: 10},
        {source: 'F1', numChars: 40}
      ]);
    });

    it('should handle trailing nulls', function() {
      expect(merge([
        p('F1', 10),
        p(null, 10),
        p('F1', 20),
        p(null, 30)
      ])).to.deep.equal([
        {source: 'F1', numChars: 40},
        {source: null, numChars: 30}
      ]);
    });

    it('should ignore nulls between different files', function() {
      expect(merge([
        p('F1', 10),
        p(null, 10),
        p('F2', 20),
        p(null, 30)
      ])).to.deep.equal([
        {source: 'F1', numChars: 10},
        {source: null, numChars: 10},
        {source: 'F2', numChars: 20},
        {source: null, numChars: 30}
      ]);
    });

    it('should merge multiple nulls gaps in a file', function() {
      expect(merge([
        p('F1', 10),
        p(null, 10),
        p('F1', 20),
        p(null, 30),
        p('F1', 10),
      ])).to.deep.equal([
        {source: 'F1', numChars: 80}
      ]);
    });
  });
});
