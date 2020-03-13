import { createBundleWithTerser } from './common';

/**
 * Generate bundle w/o source map `sourceMappingURL` comment
 */
export function generateNoMapComment(): void {
  createBundleWithTerser('no-map-comment.js', {
    mangle: false,
    sourceMap: {
      content: 'inline',
    },
  });
}
