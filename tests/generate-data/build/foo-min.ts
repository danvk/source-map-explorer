import { createBundleWithTerser } from './common';

/**
 * Generate bundle with separate source map file
 */
export function generateFooMin(): void {
  createBundleWithTerser('foo.min.js', {
    mangle: false,
    sourceMap: {
      url: 'foo.min.js.map',
      content: 'inline',
    },
  });
}
