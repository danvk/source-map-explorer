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
      output: {
        beautify: true,
        // eslint-disable-next-line @typescript-eslint/camelcase
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
