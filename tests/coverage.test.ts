import { expect } from 'chai';
import rewiremock from './rewiremock';

import { setCoveredSizes, getColorByPercent } from '../src/coverage';
import { Bundle, Coverage, CoverageRange, MappingRange, FileDataMap } from '../src';

describe('coverage', () => {
  describe('addCoverageRanges', () => {
    beforeEach(() => {
      rewiremock.enable();
    });

    afterEach(() => {
      rewiremock.disable();
    });

    it('should match coverages to bundles', () => {
      const bundles: Bundle[] = [
        { code: 'abc/def/ghi.js' },
        { code: 'abc/ghi.js' },
        { code: 'home/develop/abc/jkl.js' },
        { code: 'C:\\develop\\dist\\mno\\pqr\\stu.js' },
      ];

      const coverages: Coverage[] = [
        { url: 'http://my-site.io/assets/abc/ghi.js', ranges: [{ start: 0, end: 3 }], text: 'abc' },
        {
          url: 'http://my-site.io/assets/abc/def/ghi.js',
          ranges: [{ start: 0, end: 4 }],
          text: 'defg',
        },
        { url: 'file:///home/develop/abc/jkl.js', ranges: [{ start: 0, end: 5 }], text: 'hijkl' },
        {
          url: 'file:///C:/develop/dist/mno/pqr/stu.js',
          ranges: [{ start: 0, end: 6 }],
          text: 'mnopqr',
        },
      ];

      const coverageFileContent = JSON.stringify(coverages);

      const { addCoverageRanges } = rewiremock.proxy('../src/coverage', r => ({
        './helpers': r.callThrough().with({
          getFileContent: () => coverageFileContent,
        }),
      }));

      addCoverageRanges(bundles, 'coverage.json');

      expect(bundles[0].coverageRanges).to.deep.equal([[{ start: 0, end: 3 }]]);
      expect(bundles[1].coverageRanges).to.deep.equal([[{ start: 0, end: 2 }]]);
      expect(bundles[2].coverageRanges).to.deep.equal([[{ start: 0, end: 4 }]]);
      expect(bundles[3].coverageRanges).to.deep.equal([[{ start: 0, end: 5 }]]);
    });

    it('should ignore coverage for inline code', () => {
      const bundles: Bundle[] = [{ code: 'abc/ghi.js' }];

      const coverages: Coverage[] = [
        { url: 'http://my-site.io', ranges: [{ start: 0, end: 5 }], text: 'hijkl' },
      ];

      const coverageFileContent = JSON.stringify(coverages);

      const { addCoverageRanges } = rewiremock.proxy('../src/coverage', r => ({
        './helpers': r.callThrough().with({
          getFileContent: () => coverageFileContent,
        }),
      }));

      expect(() => {
        addCoverageRanges(bundles, 'coverage.json');
      }).to.throw('No matched bundles found for coverages');
    });

    it('should convert one-line coverage range to per line ranges', () => {
      const tests = [
        {
          filename: 'a.js',
          ranges: [{ start: 0, end: 54 }],
          text: 'const a1 = 5;\r\nconst b1 = 25;\r\nconsole.log(a1 + b1);\r\n',
          expected: [[{ start: 0, end: 12 }], [{ start: 0, end: 13 }], [{ start: 0, end: 20 }], []],
          message: 'range covers all lines',
        },
        {
          filename: 'b.js',
          ranges: [
            { start: 43, end: 96 },
            { start: 114, end: 173 },
          ],
          text:
            'function foo(value) { console.log(value); } const a2 = 500;\nconst b2 = 2; console.log(a2 * b2); function noop() {}; const c2 = 7;\nconst d2 = { a2, b2, c2 };\nconsole.log(d2);',
          expected: [
            [{ start: 43, end: 58 }],
            [
              { start: 0, end: 35 },
              { start: 54, end: 68 },
            ],
            [{ start: 0, end: 25 }],
            [{ start: 0, end: 15 }],
          ],
          message: 'range starts on one line and ends on the another. EOL = LF',
        },
        {
          filename: 'c.js',
          ranges: [
            { start: 43, end: 97 },
            { start: 115, end: 176 },
          ],
          text:
            'function bar(value) { console.log(value); } const a3 = 500;\r\nconst b3 = 2; console.log(a3 * b3); function loop() {}; const c3 = 7;\r\nconst d3 = { a3, b3, c3 };\r\nconsole.log(d3);',
          expected: [
            [{ start: 43, end: 58 }],
            [
              { start: 0, end: 35 },
              { start: 54, end: 68 },
            ],
            [{ start: 0, end: 25 }],
            [{ start: 0, end: 15 }],
          ],
          message: 'range starts on one line and ends on the another. EOL = CRLF',
        },
        {
          filename: 'd.js',
          ranges: [{ start: 0, end: 58 }],
          text: '(function(global) { global.SETTINGS = { a: 5 };})(window);',
          expected: [[{ start: 0, end: 57 }]],
          message: 'range matches line range',
        },
        {
          filename: 'e.js',
          ranges: [{ start: 37, end: 56 }],
          text: `function a4() { console.log('foo'); } const ಠ_ಠ = '🥩'; function b4() { console.log('bar'); }`,
          expected: [[{ start: 37, end: 55 }]],
          message: 'line range includes range',
        },
        {
          filename: 'f.js',
          ranges: [{ start: 39, end: 62 }],
          text: 'function bar(x) {\n  return `bar${x}`;\n}\n\nmodule.exports = bar;',
          expected: [[], [], [{ start: 1, end: 0 }], [], [{ start: 0, end: 20 }]],
          message: 'empty lines',
        },
      ];

      const bundles: Bundle[] = tests.map(({ filename }) => ({ code: filename }));
      const coverages: Coverage[] = tests.map(({ filename, ranges, text }) => ({
        url: `http://my-site.io/${filename}`,
        ranges,
        text,
      }));
      const coverageFileContent = JSON.stringify(coverages);

      const { addCoverageRanges } = rewiremock.proxy('../src/coverage', r => ({
        './helpers': r.callThrough().with({
          getFileContent: () => coverageFileContent,
        }),
      }));

      addCoverageRanges(bundles, 'coverage.json');

      tests.forEach(({ expected, message }, index) => {
        expect(bundles[index].coverageRanges).to.deep.equal(expected, message);
      });
    });

    it('should throw NoCoverageMatches error when no matches found', () => {
      const bundles: Bundle[] = [{ code: 'abc/def/ghi.js' }, { code: 'abc/ghi.js' }];

      const coverages: Coverage[] = [
        { url: 'http://my-site.io/assets/vwx/yz.js', ranges: [{ start: 0, end: 1 }], text: '' },
        {
          url: 'http://my-site.io/assets/xyz.js',
          ranges: [{ start: 2, end: 3 }],
          text: '',
        },
      ];

      const coverageFileContent = JSON.stringify(coverages);

      const { addCoverageRanges } = rewiremock.proxy('../src/coverage', {
        './helpers': {
          getFileContent: () => coverageFileContent,
        },
      });

      expect(() => {
        addCoverageRanges(bundles, 'coverage.json');
      }).to.throw('No matched bundles found for coverages');
    });
  });

  describe('setCoveredSizes', () => {
    const tests: {
      name: string;
      line: string;
      files: FileDataMap;
      mappingRanges: MappingRange[];
      coveredRanges: CoverageRange[];
      expected: FileDataMap;
    }[] = [
      {
        name: 'should handle module coming before range',
        line: 'const a  = 5',
        files: { foo: { size: 3 } },
        mappingRanges: [{ source: 'foo', start: 0, end: 2 }],
        coveredRanges: [{ start: 3, end: 6 }],
        expected: { foo: { size: 3 } },
      },
      {
        name: 'should handle module coming after range',
        line: 'const b = 2 ** 64',
        files: { foo: { size: 2 } },
        mappingRanges: [{ source: 'foo', start: 7, end: 8 }],
        coveredRanges: [{ start: 3, end: 6 }],
        expected: { foo: { size: 2 } },
      },
      {
        name: 'should handle module partially overlapping start of range',
        line: 'const c = 2 * 4 * 6',
        files: { foo: { size: 2 } },
        mappingRanges: [{ source: 'foo', start: 2, end: 4 }],
        coveredRanges: [{ start: 3, end: 6 }],
        expected: { foo: { size: 2, coveredSize: 2 } },
      },
      {
        name: 'should handle module partially overlapping end of range',
        line: 'const d = (200 - 30) / 7',
        files: { foo: { size: 3 } },
        mappingRanges: [{ source: 'foo', start: 5, end: 7 }],
        coveredRanges: [{ start: 3, end: 6 }],
        expected: { foo: { size: 3, coveredSize: 2 } },
      },
      {
        name: 'should handle module being within the range',
        line: 'const e = Math.PI * 365',
        files: { foo: { size: 2 } },
        mappingRanges: [{ source: 'foo', start: 4, end: 5 }],
        coveredRanges: [{ start: 3, end: 6 }],
        expected: { foo: { size: 2, coveredSize: 2 } },
      },
      {
        name: 'should handle module containing the entire range',
        line: 'const f = "🔥" + "🦊"',
        files: { foo: { size: 27 } },
        mappingRanges: [{ source: 'foo', start: 1, end: 19 }],
        coveredRanges: [{ start: 10, end: 13 }],
        expected: { foo: { size: 27, coveredSize: 6 } },
      },
      {
        name: 'should handle module matching the entire range',
        line: 'const g = "g" + 00 + "gle"',
        files: { foo: { size: 3 } },
        mappingRanges: [{ source: 'foo', start: 3, end: 6 }],
        coveredRanges: [{ start: 3, end: 6 }],
        expected: { foo: { size: 3, coveredSize: 4 } },
      },
      {
        name: 'should handle multiple ranges',
        line: 'const h = 1 + 1 + 2 + 3 + 5 + 8 + 13',
        files: { foo: { size: 7 }, bar: { size: 2 } },
        mappingRanges: [
          { source: 'foo', start: 5, end: 12 },
          { source: 'bar', start: 17, end: 19 },
          { source: 'bar', start: 20, end: 21 },
        ],
        coveredRanges: [
          { start: 1, end: 2 },
          { start: 3, end: 6 },
          { start: 8, end: 11 },
          { start: 18, end: 20 },
        ],
        expected: { foo: { size: 7, coveredSize: 6 }, bar: { size: 2, coveredSize: 3 } },
      },
    ];

    tests.forEach(({ name, line, files, mappingRanges, coveredRanges, expected }) => {
      it(name, () => {
        expect(setCoveredSizes(line, files, mappingRanges, coveredRanges)).to.deep.equal(expected);
      });
    });
  });

  describe('getColorByPercent', () => {
    const tests: { name: string; percent: number; expected: string }[] = [
      {
        name: 'should return green color',
        percent: 1,
        expected: 'rgb(0, 255, 0)',
      },
      {
        name: 'should return red color',
        percent: 0,
        expected: 'rgb(255, 0, 0)',
      },
    ];

    tests.forEach(({ name, percent, expected }) => {
      it(name, () => {
        expect(getColorByPercent(percent)).to.equal(expected);
      });
    });
  });
});
