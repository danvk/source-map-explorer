import { createBundleWithWebpack } from './common';

/**
 * Generate bundle with null source (containing bootstrap/helpers code)
 */
export function generateNullSource(): void {
  createBundleWithWebpack('foo.js', 'null-source.js');
}
