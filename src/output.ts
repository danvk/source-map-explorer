import os from 'os';
import path from 'path';
import fs from 'fs';

import { ExploreBundleResult, ExploreOptions, ExploreResult } from './index';
import { generateHtml } from './html';
import { AppError } from './app-error';

export function formatOutput(
  results: ExploreBundleResult[],
  options: ExploreOptions
): string | undefined {
  if (!options.output) {
    return;
  }

  switch (options.output.format) {
    case 'json':
      return JSON.stringify({ results }, null, '  ');

    case 'tsv':
      return outputAsTsv(results);

    case 'html':
      return generateHtml(results);
  }
}

function outputAsTsv(results: ExploreBundleResult[]): string {
  const lines = ['Source\tSize'];

  results.forEach((bundle, index) => {
    if (index > 0) {
      // Separate bundles by empty line
      lines.push('');
    }

    Object.entries(bundle.gzipFiles)
      .sort(sortFilesBySize)
      .forEach(([source, size]) => {
        lines.push(`${source}\t${size}`);
      });
  });

  return lines.join(os.EOL);
}

function sortFilesBySize([, aSize]: [string, number], [, bSize]: [string, number]): number {
  return bSize - aSize;
}

export function saveOutputToFile(result: ExploreResult, options: ExploreOptions): void {
  if (!options.output) {
    return;
  }

  const output = result.output;
  const filename = options.output.filename;

  if (output && filename) {
    try {
      const dir = path.dirname(filename);

      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(filename, output);
    } catch (error) {
      throw new AppError({ code: 'CannotSaveFile' }, error);
    }
  }
}
