import { createBundleWithTypeScript } from './common';

/**
 * Generate bundle with source map that references column with EOL
 */
export function generateMapReferenceEOL(): void {
  createBundleWithTypeScript('map-reference-eol.ts', 'map-reference-eol.js');
}
