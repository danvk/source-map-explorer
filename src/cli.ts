#!/usr/bin/env node

import yargs from 'yargs';
import fs from 'fs';
import temp from 'temp';
import open from 'open';

import { explore, exploreBundles, ExploreOptions, ExploreResult, ReplaceMap } from './api';
import { reportUnmappedBytes, generateHtml, getBundles } from './common';

interface Arguments {
  _: string[];
  json?: boolean;
  tsv?: boolean;
  html?: boolean;
  onlyMapped?: boolean;
  noRoot?: boolean;
  replace?: string[];
  with?: string[];
}

function parseArguments(): Arguments {
  // TODO: Use `middleware` to remove extra single quotes from positional arguments
  return yargs
    .strict()
    .scriptName('source-map-explorer')
    .usage('Analyze and debug space usage through source maps.')
    .usage('Usage:')
    .usage(
      '$0 script.js [script.js.map] [--json | --html | --tsv] [-m | --only-mapped] [--replace=BEFORE_1 BEFORE_2 --with=AFTER_1 AFTER_2] [--no-root] [--version] [--help | -h]'
    )
    .example('$0 script.js script.js.map', 'Explore bundle')
    .example('$0 script.js', 'Explore bundle with inline source map')
    .example('$0 dist/js/*.*', 'Explore all bundles inside dist/js folder')
    .demandCommand(1, 'At least one js file must be specified')
    .options({
      json: {
        type: 'boolean',
        description: 'Output JSON (on stdout) instead of generating HTML and opening the browser.',
        conflicts: ['tsv', 'html'],
      },
      tsv: {
        type: 'boolean',
        description: 'Output TSV (on stdout) instead of generating HTML and opening the browser.',
        conflicts: ['json', 'html'],
      },
      html: {
        type: 'boolean',
        description: 'Output HTML (on stdout) rather than opening a browser.',
        conflicts: ['json', 'tsv'],
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
          'Apply a simple find/replace on source file names. This can be used to fix some oddities with paths which appear in the source map  generation process. Accepts regular expressions.',
        implies: 'with',
      },
      with: {
        type: 'string',
        array: true,
        description: 'See --replace.',
        implies: 'replace',
      },
    })
    .group(['json', 'tsv', 'html'], 'Output:')
    .group(['replace', 'with'], 'Replace:')
    .help('h')
    .alias('h', 'help')
    .showHelpOnFail(false, 'Specify --help for available options')
    .wrap(null) // Do not limit line length
    .parserConfiguration({
      'boolean-negation': false,
    })
    .check(argv => {
      if (argv.replace && argv.with && argv.replace.length !== argv.with.length) {
        throw new Error('--replace flags must be paired with --with flags');
      }

      return true;
    })
    .parse();
}

/**
 * Create options object for `explore` method
 * @param  argv CLI arguments
 */
function getExploreOptions(argv: Arguments): ExploreOptions {
  let html = true;
  if (argv.json || argv.tsv) {
    html = false;
  }

  const replaceItems = argv.replace;
  const replaceWithItems = argv.with;

  const replace =
    replaceItems && replaceWithItems
      ? replaceItems.reduce<ReplaceMap>((result, item, index) => {
          result[item] = replaceWithItems[index];

          return result;
        }, {})
      : undefined;

  return {
    onlyMapped: argv.onlyMapped,
    html,
    noRoot: argv.noRoot,
    replace,
  };
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
    console.error('Unable to open web browser. ' + error);
    console.error(
      'Either run with --html, --json or --tsv, or view HTML for the visualization at:'
    );
    console.error(tempName);
  });
}

if (require.main === module) {
  const argv = parseArguments();

  const bundles = getBundles(argv._[0], argv._[1]);

  if (bundles.length === 0) {
    throw new Error('No file(s) found');
  }

  const exploreOptions = getExploreOptions(argv);

  if (bundles.length === 1) {
    const { codePath, mapPath } = bundles[0];

    explore(codePath, mapPath, exploreOptions)
      .then(result => {
        reportUnmappedBytes(result);

        if (argv.json) {
          console.log(JSON.stringify(result.files, null, '  '));
          process.exit(0);
        } else if (argv.tsv) {
          console.log('Source\tSize');
          Object.keys(result.files).forEach(source => {
            const size = result.files[source];
            console.log(`${size}\t${source}`);
          });
          process.exit(0);
        } else if (argv.html) {
          console.log(result.html);
          process.exit(0);
        }

        writeToHtml(result.html);
      })
      .catch(error => {
        if (error.code === 'ENOENT') {
          console.error(`File not found! -- ${error.message}`);
        } else {
          console.error(error.message);
        }

        process.exit(1);
      });
  } else {
    exploreBundles(bundles).then(results => {
      const successResults = results.filter(
        (result): result is ExploreResult => result.hasOwnProperty('files')
      );

      if (successResults.length === 0) {
        throw new Error('There were errors');
      }

      successResults.forEach(reportUnmappedBytes);

      const html = generateHtml(successResults);

      // Check args instead of exploreOptions.html because it always true
      if (argv.html) {
        console.log(html);
      } else {
        writeToHtml(html);
      }
    });
  }
}
