#!/usr/bin/env node

import yargs from 'yargs';
import fs from 'fs';
import temp from 'temp';
import open from 'open';
import chalk from 'chalk';
import { groupBy } from 'lodash';

import { explore } from './api';
import { ExploreOptions, ReplaceMap, FileSizeMap, ExploreResult } from './index';

/** Parsed CLI arguments */
interface Arguments {
  _: string[];
  json?: boolean;
  tsv?: boolean;
  html?: boolean;
  file?: string;
  onlyMapped?: boolean;
  noRoot?: boolean;
  replace?: string[];
  with?: string[];
}

function parseArguments(): Arguments {
  const argv = yargs
    .strict()
    .scriptName('source-map-explorer')
    .usage('Analyze and debug space usage through source maps.')
    .usage('Usage:')
    .usage(
      '$0 script.js [script.js.map] [--json | --html | --tsv | --file map.html] [-m | --only-mapped] [--replace=BEFORE_1 BEFORE_2 --with=AFTER_1 AFTER_2] [--no-root] [--version] [--help | -h]'
    )
    .example('$0 script.js script.js.map', 'Explore bundle')
    .example('$0 script.js', 'Explore bundle with inline source map')
    .example('$0 dist/js/*.*', 'Explore all bundles inside dist/js folder')
    .demandCommand(1, 'At least one js file must be specified')
    .options({
      json: {
        type: 'boolean',
        description: 'Output JSON (on stdout) instead of generating HTML and opening the browser.',
        conflicts: ['tsv', 'html', 'file'],
      },
      tsv: {
        type: 'boolean',
        description: 'Output TSV (on stdout) instead of generating HTML and opening the browser.',
        conflicts: ['json', 'html', 'file'],
      },
      html: {
        type: 'boolean',
        description: 'Output HTML (on stdout) rather than opening a browser.',
        conflicts: ['json', 'tsv', 'file'],
      },
      file: {
        type: 'string',
        normalize: true,
        description: 'Save HTML output to specified file.',
        conflicts: ['json', 'tsv', 'html'],
      },

      'only-mapped': {
        alias: 'm',
        type: 'boolean',
        description:
          'Exclude "unmapped" bytes from the output. This will result in total counts less than the file size',
      },

      'no-root': {
        type: 'boolean',
        description:
          'To simplify the visualization, source-map-explorer will remove any prefix shared by all sources. If you wish to disable this behavior, set --no-root.',
      },

      replace: {
        type: 'string',
        array: true,
        description:
          'Apply a simple find/replace on source file names. This can be used to fix some oddities with paths which appear in the source map generation process. Accepts regular expressions.',
        implies: 'with',
      },
      with: {
        type: 'string',
        array: true,
        description: 'See --replace.',
        implies: 'replace',
      },
    })
    .group(['json', 'tsv', 'html', 'file'], 'Output:')
    .group(['replace', 'with'], 'Replace:')
    .help('h')
    .alias('h', 'help')
    .showHelpOnFail(false, 'Specify --help for available options')
    .wrap(null) // Do not limit line length
    .parserConfiguration({
      'boolean-negation': false, // Allow --no-root
    })
    .check(argv => {
      if (argv.replace && argv.with && argv.replace.length !== argv.with.length) {
        throw new Error('--replace flags must be paired with --with flags');
      }

      return true;
    })
    .parse();

  // Trim extra quotes
  const quoteRegex = /'/g;
  argv._ = argv._.map(path => path.replace(quoteRegex, ''));

  return argv;
}

export function logError(message: string, error?: Error): void {
  if (error) {
    console.error(chalk.red(message), error);
  } else {
    console.error(chalk.red(message));
  }
}

export function logWarn(message: string): void {
  console.warn(chalk.yellow(message));
}

export function logInfo(message: string): void {
  console.log(chalk.green(message));
}

/**
 * Create options object for `explore` method
 */
function getExploreOptions(argv: Arguments): ExploreOptions {
  let html = true;
  if (argv.json || argv.tsv) {
    html = false;
  }

  let replaceMap: ReplaceMap | undefined;
  const replaceItems = argv.replace;
  const withItems = argv.with;

  if (replaceItems && withItems) {
    replaceMap = replaceItems.reduce<ReplaceMap>((result, item, index) => {
      result[item] = withItems[index];

      return result;
    }, {});
  }

  return {
    html,
    file: argv.file,
    replaceMap,
    onlyMapped: argv.onlyMapped,
    noRoot: argv.noRoot,
  };
}

interface JsonResult {
  results: {
    bundleName: string;
    files: FileSizeMap;
  }[];
}

function outputJson(result: ExploreResult): void {
  const jsonResultObject: JsonResult = {
    results: result.bundles.map(({ bundleName, files }) => ({
      bundleName,
      files,
    })),
  };

  console.log(JSON.stringify(jsonResultObject, null, '  '));
}

function outputTsv(result: ExploreResult): void {
  console.log('Source\tSize');

  result.bundles.forEach((bundle, index) => {
    if (index > 0) {
      // Separate bundles by empty line
      console.log();
    }

    Object.entries(bundle.files)
      .sort(sortFilesBySize)
      .forEach(([source, size]) => {
        console.log(`${source}\t${size}`);
      });
  });
}

function sortFilesBySize([, aSize]: [string, number], [, bSize]: [string, number]): number {
  return bSize - aSize;
}

/**
 * Write HTML content to a temporary file and open the file in a browser
 */
function writeToHtml(html?: string): void {
  if (!html) {
    return;
  }

  const tempName = temp.path({ suffix: '.html' });

  fs.writeFileSync(tempName, html);

  open(tempName, { wait: false }).catch(error => {
    logError('Unable to open web browser.', error);
    logError(
      'Either run with --html, --json, --tsv, --file, or view HTML for the visualization at:'
    );
    logError(tempName);
  });
}

function outputErrors({ errors }: ExploreResult): void {
  if (errors.length === 0) {
    return;
  }

  // Group errors by bundle name
  const groupedErrors = groupBy(errors, 'bundleName');

  Object.entries(groupedErrors).forEach(([bundleName, errors]) => {
    console.group(bundleName);

    const hasManyErrors = errors.length > 1;
    errors.forEach((error, index) => {
      const message = `${hasManyErrors ? `${index + 1}. ` : ''}${error.message}`;

      if (error.isWarning) {
        logWarn(message);
      } else {
        logError(message);
      }
    });

    console.groupEnd();
  });
}

if (require.main === module) {
  const argv = parseArguments();

  const exploreOptions = getExploreOptions(argv);

  explore(argv._, exploreOptions)
    .then(result => {
      if (argv.json) {
        outputJson(result);
      } else if (argv.tsv) {
        outputTsv(result);
      } else if (argv.html) {
        console.log(result.html);
      } else if (argv.file) {
        logInfo(`HTML saved to ${argv.file}`);
        outputErrors(result);
      } else {
        writeToHtml(result.html);
        outputErrors(result);
      }
    })
    .catch(error => {
      if (error.errors) {
        outputErrors(error);
      } else {
        logError('Failed to explore', error);
      }
    });
}
