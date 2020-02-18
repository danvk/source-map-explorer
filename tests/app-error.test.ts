import snapshot from '@smpx/snap-shot-it';

import { getErrorMessage, ErrorContext } from '../src/app-error';

describe('app-error', () => {
  describe('getErrorMessage', () => {
    const tests = [
      { code: 'NoBundles' },
      { code: 'NoSourceMap' },
      { code: 'OneSourceSourceMap', filename: 'foo.min.js' },
      { code: 'UnmappedBytes', totalBytes: 100, unmappedBytes: 70 },
      { code: 'InvalidMappingLine', generatedLine: 60, maxLine: 57 },
      {
        code: 'InvalidMappingColumn',
        generatedLine: 60,
        generatedColumn: 80,
        maxColumn: 80,
      },
      { code: 'CannotSaveFile' },
      { code: 'CannotCreateTempFile' },
      {
        code: 'CannotOpenTempFile',
        error: Buffer.from('The system cannot find the file ?C:\\foo.htm'),
        tempFile: 'C:\\foo.htm',
      },
      { code: 'CannotOpenCoverageFile' },
      { code: 'NoCoverageMatches' },
      { code: 'UnknownCode' },
    ];

    tests.forEach(context => {
      it(`should create message for '${context.code}'`, () => {
        snapshot(getErrorMessage(context as ErrorContext));
      });
    });
  });
});
