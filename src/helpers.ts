import fs from 'fs';

export function getFileContent(file: Buffer | string): string {
  const buffer = Buffer.isBuffer(file) ? file : fs.readFileSync(file);

  return buffer.toString();
}

const BYTE_SIZES = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
// Bytes
const SIZE_BASE = 1024;

/**
 * Format number of bytes as string
 * Source @see https://stackoverflow.com/a/18650828/388951
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return `0 ${BYTE_SIZES[0]}`;

  const exponent = Math.floor(Math.log(bytes) / Math.log(SIZE_BASE));
  const value = bytes / Math.pow(SIZE_BASE, exponent);

  // `parseFloat` removes trailing zero
  return `${parseFloat(value.toFixed(decimals))} ${BYTE_SIZES[exponent]}`;
}

export function formatPercent(value: number, total: number, fractionDigits?: number): string {
  return ((100.0 * value) / total).toFixed(fractionDigits);
}

const PATH_SEPARATOR_REGEX = /(\/)/;

/**
 * Find common path prefix
 * Source @see http://stackoverflow.com/a/1917041/388951
 * @param paths List of filenames
 */
export function getCommonPathPrefix(paths: string[]): string {
  if (paths.length < 2) return '';

  const A = paths.concat().sort(),
    a1 = A[0].split(PATH_SEPARATOR_REGEX),
    a2 = A[A.length - 1].split(PATH_SEPARATOR_REGEX),
    L = a1.length;

  let i = 0;

  while (i < L && a1[i] === a2[i]) i++;

  return a1.slice(0, i).join('');
}
