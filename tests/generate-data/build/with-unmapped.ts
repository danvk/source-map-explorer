import { createBundleWithTypeScript } from './common';
import ts from 'typescript';

/**
 * Generate bundle with unmapped bytes
 */
export function generateWithUnmapped(): void {
  createBundleWithTypeScript('with-unmapped.ts', 'with-unmapped.js', {
    target: ts.ScriptTarget.ES5,
    module: ts.ModuleKind.CommonJS,
  });
}
