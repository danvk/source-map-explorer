import { createBundleWithTerser } from './common';

/**
 * Generate bundle with source map comment inlined
 */
export function generateInlineMap(): void {
  createBundleWithTerser('inline-map.js', {
    mangle: false,
    sourceMap: {
      url: 'inline',
      content: 'inline',
    },
  });
}
