import fs from 'fs';
import path from 'path';
import generate from 'generate-source-map';
import convert from 'convert-source-map';
import Terser from 'terser';
import webpack from 'webpack';
import TerserPlugin from 'terser-webpack-plugin';
import ts from 'typescript';

export const EOL = `\n`;

export const destination = path.resolve(__dirname, '../../data');

export const root = path.resolve(__dirname, '..');
export const src = path.resolve(__dirname, '../src');
export const dist = path.resolve(__dirname, '../dist');

export const BUNDLE_FILE_NAME = 'bundle.js';

export function getSourceMapComment(source: string, sourceFile: string): string {
  const map = generate({ source, sourceFile });

  return convert.fromJSON(map.toString()).toComment();
}

export function getFileContent(filename: string): string {
  return fs.readFileSync(path.join(root, filename)).toString();
}

export function saveTestDataFile(filename: string, content: string): void {
  fs.writeFileSync(path.join(destination, filename), content);
}

export async function createBundleWithTerser(
  distFilename: string,
  options: Terser.MinifyOptions,
  srcFilename?: string
): Promise<void> {
  const source = getFileContent(srcFilename || `dist/${BUNDLE_FILE_NAME}`);
  const files = srcFilename ? { [srcFilename]: source } : source;

  try {
    const result = await Terser.minify(files, options);

    const sourceMapFilename =
      typeof options.sourceMap === 'object' &&
      options.sourceMap.url !== 'inline' &&
      options.sourceMap.url;

    if (result.code) {
      saveTestDataFile(distFilename, result.code);

      if (typeof result.map === 'string' && sourceMapFilename) {
        saveTestDataFile(sourceMapFilename, result.map);
      }
    } else {
      console.error(`Unable to generate "${distFilename}". Code is empty`);
    }
  } catch (error) {
    console.error(`Unable to generate "${distFilename}"`, error);
  }
}

export function createBundleWithWebpack(srcFilename: string, distFilename: string): void {
  webpack(
    {
      mode: 'production',
      entry: path.resolve(src, srcFilename),
      output: {
        path: destination,
        filename: distFilename,
      },
      devtool: 'inline-source-map',
      optimization: {
        minimizer: [
          new TerserPlugin({
            terserOptions: {
              output: {
                comments: false,
                ascii_only: true,
              },
              sourceMap: true,
            },
            extractComments: false,
          }),
        ],
      },
    },
    (err, stats) => {
      const error = err ? err : stats && stats.hasErrors() ? stats.compilation.errors : null;

      if (error) {
        console.error(`Unable to generate "${distFilename}"`, error);
      }
    }
  );
}

export function createBundleWithTypeScript(
  srcFilename: string,
  distFilename: string,
  compilerOptions?: ts.CompilerOptions
): void {
  // https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API

  const program = ts.createProgram([path.resolve(src, srcFilename)], {
    ...(compilerOptions && compilerOptions),
    outFile: path.resolve(destination, distFilename),
    removeComments: true,
    newLine: ts.NewLineKind.LineFeed,
    inlineSourceMap: true,
    inlineSources: true,
  });

  program.emit();
}
