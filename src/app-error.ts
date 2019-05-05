import { formatPercent } from './helpers';

// If we need advanced error consider using https://github.com/joyent/node-verror
export class AppError extends Error {
  code?: string;
  cause?: Error;

  constructor(errorContext: ErrorContext, error?: NodeJS.ErrnoException) {
    super();

    const message = getErrorMessage(errorContext);

    this.message = error ? `${message} ${error.message}` : message;
    this.code = errorContext.code;

    Error.captureStackTrace(this, AppError);
  }
}

export const SOURCE_MAP_INFO_URL =
  'https://github.com/danvk/source-map-explorer/blob/master/README.md#generating-source-maps';

interface CommonErrorContext {
  code: 'NoBundles' | 'NoSourceMap' | 'CannotSaveFile' | 'Unknown';
}

interface OneSourceSourceMapErrorContext {
  code: 'OneSourceSourceMap';
  filename: string;
}

interface UnmappedBytesErrorContext {
  code: 'UnmappedBytes';
  unmappedBytes: number;
  totalBytes: number;
}

type ErrorContext = CommonErrorContext | OneSourceSourceMapErrorContext | UnmappedBytesErrorContext;

export function getErrorMessage(context: ErrorContext): string {
  switch (context.code) {
    case 'NoBundles':
      return 'No file(s) provided';

    case 'NoSourceMap':
      return `Unable to find a source map.
See ${SOURCE_MAP_INFO_URL}`;

    case 'OneSourceSourceMap': {
      const { filename } = context;

      return `Your source map only contains one source (${filename}).
This can happen if you use browserify+uglifyjs, for example, and don't set the --in-source-map flag to uglify.
See ${SOURCE_MAP_INFO_URL}`;
    }

    case 'UnmappedBytes': {
      const { unmappedBytes, totalBytes } = context;

      const bytesString = formatPercent(unmappedBytes, totalBytes, 2);

      return `Unable to map ${unmappedBytes}/${totalBytes} bytes (${bytesString}%)`;
    }

    case 'CannotSaveFile':
      return 'Unable to save html to file';

    default:
      return 'Unknown error';
  }
}
