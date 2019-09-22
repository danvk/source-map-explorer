import { formatPercent } from './helpers';
import { ErrorCode } from './index';

// If we need advanced error consider using https://github.com/joyent/node-verror
export class AppError extends Error {
  code?: ErrorCode;
  cause?: Error;

  constructor(errorContext: ErrorContext, error?: NodeJS.ErrnoException) {
    super();

    const message = getErrorMessage(errorContext);

    this.message = error ? `${message}: ${error.message}` : message;
    this.code = errorContext.code;

    Error.captureStackTrace(this, AppError);
  }
}

export const SOURCE_MAP_INFO_URL =
  'https://github.com/danvk/source-map-explorer/blob/master/README.md#generating-source-maps';

interface CommonErrorContext {
  code: 'NoBundles' | 'NoSourceMap' | 'CannotSaveFile' | 'CannotCreateTempFile' | 'Unknown';
}

interface OneSourceSourceMapErrorContext {
  code: 'OneSourceSourceMap';
  filename: string;
}

interface UnmappedBytesErrorContext {
  code: 'UnmappedBytes';
  totalBytes: number;
  unmappedBytes: number;
}

interface InvalidMappingLineErrorContext {
  code: 'InvalidMappingLine';
  generatedLine: number;
  maxLine: number;
}

interface InvalidMappingColumnErrorContext {
  code: 'InvalidMappingColumn';
  generatedLine: number;
  generatedColumn: number;
  maxColumn: number;
}

interface CannotOpenTempFileErrorContext {
  code: 'CannotOpenTempFile';
  error: Buffer;
  tempFile: string;
}

export type ErrorContext =
  | CommonErrorContext
  | OneSourceSourceMapErrorContext
  | UnmappedBytesErrorContext
  | InvalidMappingLineErrorContext
  | InvalidMappingColumnErrorContext
  | CannotOpenTempFileErrorContext;

export function getErrorMessage(context: ErrorContext): string {
  switch (context.code) {
    case 'NoBundles':
      return 'No file(s) provided';

    case 'NoSourceMap':
      return `Unable to find a source map.
See ${SOURCE_MAP_INFO_URL}`;

    case 'OneSourceSourceMap': {
      return `Your source map only contains one source (${context.filename}).
This can happen if you use browserify+uglifyjs, for example, and don't set the --in-source-map flag to uglify.
See ${SOURCE_MAP_INFO_URL}`;
    }

    case 'UnmappedBytes': {
      const { unmappedBytes, totalBytes } = context;

      const bytesString = formatPercent(unmappedBytes, totalBytes, 2);

      return `Unable to map ${unmappedBytes}/${totalBytes} bytes (${bytesString}%)`;
    }

    case 'InvalidMappingLine': {
      const { generatedLine, maxLine } = context;

      return `Your source map refers to generated line ${generatedLine}, but the source only contains ${maxLine} line(s).
Check that you are using the correct source map.`;
    }

    case 'InvalidMappingColumn': {
      const { generatedLine, generatedColumn, maxColumn } = context;

      return `Your source map refers to generated column ${generatedColumn} on line ${generatedLine}, but the source only contains ${maxColumn} column(s) on that line.
Check that you are using the correct source map.`;
    }

    case 'CannotSaveFile':
      return 'Unable to save HTML to file';

    case 'CannotCreateTempFile':
      return 'Unable to create a temporary HTML file';

    case 'CannotOpenTempFile': {
      const { error, tempFile } = context;

      return `Unable to open web browser. ${error.toString().trim()}
Either run with --html, --json, --tsv, --file, or view HTML for the visualization at:
${tempFile}`;
    }

    default:
      return 'Unknown error';
  }
}
