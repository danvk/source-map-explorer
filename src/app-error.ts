import os from 'os';
import { formatPercent } from './helpers';

export enum ErrorCode {
  Unknown = 'Unknown',
  NoBundles = 'NoBundles',
  NoSourceMap = 'NoSourceMap',
  OneSourceSourceMap = 'OneSourceSourceMap',
  UnmappedBytes = 'UnmappedBytes',
  CannotSaveFile = 'CannotSaveFile',
}

// If we need advanced error consider using https://github.com/joyent/node-verror
export class AppError extends Error {
  code?: string;
  cause?: Error;

  constructor(code: ErrorCode, error?: NodeJS.ErrnoException) {
    super();

    const message = getErrorMessage(code);

    this.message = error ? `${message} ${error.message}` : message;
    this.code = code;

    Error.captureStackTrace(this, AppError);
  }
}

export const SOURCE_MAP_INFO_URL =
  'https://github.com/danvk/source-map-explorer/blob/master/README.md#generating-source-maps';

export function getErrorMessage(code: ErrorCode, context: any = {}): string {
  switch (code) {
    case ErrorCode.NoBundles:
      return 'No file(s) provided';

    case ErrorCode.NoSourceMap:
      return `Unable to find a source map.${os.EOL}See ${SOURCE_MAP_INFO_URL}`;

    case ErrorCode.OneSourceSourceMap: {
      const { filename }: { filename: string } = context;

      return [
        `Your source map only contains one source (${filename})`,
        `This can happen if you use browserify+uglifyjs, for example, and don't set the --in-source-map flag to uglify.`,
        `See ${SOURCE_MAP_INFO_URL}`,
      ].join(os.EOL);
    }

    case ErrorCode.UnmappedBytes: {
      const { unmappedBytes, totalBytes }: { unmappedBytes: number; totalBytes: number } = context;

      const bytesString = formatPercent(unmappedBytes, totalBytes, 2);

      return `Unable to map ${unmappedBytes}/${totalBytes} bytes (${bytesString}%)`;
    }

    case ErrorCode.CannotSaveFile:
      return 'Unable to save html to file';

    default:
      return 'Unknown error';
  }
}
