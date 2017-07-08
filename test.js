var expect = require('chai').expect;

var sourceMapExplorer = require('./index'),
  adjustSourcePaths = sourceMapExplorer.adjustSourcePaths,
  mapKeys = sourceMapExplorer.mapKeys,
  commonPathPrefix = sourceMapExplorer.commonPathPrefix;

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
});
