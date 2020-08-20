import { createBundleWithTerser } from './common';

/**
 * Generate bundle containing one source
 */
export function generateOneSource(): void {
  createBundleWithTerser(
    'one-source.js',
    {
      mangle: false,
      compress: false,
      format: {
        beautify: true,
        indent_level: 2,
      },
      sourceMap: {
        url: 'inline',
        includeSources: true,
      },
    },
    'src/bar.js'
  );
}
