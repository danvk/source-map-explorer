#!/usr/bin/env node

import { docopt } from 'docopt';
import fs from 'fs';
import temp from 'temp';
import open from 'open';

// TODO: https://github.com/Microsoft/TypeScript/issues/24744
// import packageJson from '../package.json';

import { explore, exploreBundlesAndFilterErroneous } from './api';
import { reportUnmappedBytes, generateHtml, getBundles } from './common';

const doc = [
  'Analyze and debug space usage through source maps.',
  '',
  'Usage:',
  '  source-map-explorer <script.js> [<script.js.map>]',
  '  source-map-explorer [--json | --html | --tsv] [-m | --only-mapped] <script.js> [<script.js.map>] [--replace=BEFORE --with=AFTER]... [--noroot]',
  '  source-map-explorer -h | --help | --version',
  '',
  'If the script file has an inline source map, you may omit the map parameter.',
  '',
  'Options:',
  '  -h --help  Show this screen.',
  '  --version  Show version.',
  '',
  '  --json  Output JSON (on stdout) instead of generating HTML',
  '          and opening the browser.',
  '  --tsv   Output TSV (on stdout) instead of generating HTML',
  '          and opening the browser.',
  '  --html  Output HTML (on stdout) rather than opening a browser.',
  '',
  '  -m --only-mapped  Exclude "unmapped" bytes from the output.',
  '                    This will result in total counts less than the file size',
  '',
  '',
  '  --noroot  To simplify the visualization, source-map-explorer',
  '            will remove any prefix shared by all sources. If you',
  '            wish to disable this behavior, set --noroot.',
  '',
  '  --replace=BEFORE  Apply a simple find/replace on source file',
  '                    names. This can be used to fix some oddities',
  '                    with paths which appear in the source map',
  '                    generation process.  Accepts regular expressions.',
  '  --with=AFTER  See --replace.',
].join('\n');

/**
 * Validate CLI arguments
 */
function validateArgs(args: Args): void {
  if (args['--replace'] && args['--with'] && args['--replace'].length !== args['--with'].length) {
    console.error('--replace flags must be paired with --with flags.');
    process.exit(1);
  }
}

/**
 * Create options object for `explore` method
 * @param  args CLI arguments
 */
function getExploreOptions(args: Args): ExploreOptions {
  let html = true;
  if (args['--json'] || args['--tsv']) {
    html = false;
  }

  const replace: Record<string, string> = {};
  const argsReplace = args['--replace'];
  const argsWith = args['--with'];

  if (argsReplace && argsWith) {
    for (let replaceIndex = 0; replaceIndex < argsReplace.length; replaceIndex += 1) {
      replace[argsReplace[replaceIndex]] = argsWith[replaceIndex];
    }
  }

  return {
    onlyMapped: args['--only-mapped'] || args['-m'],
    html,
    noRoot: !!args['--noroot'],
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
  const args: Args = docopt(doc, { version: '2.0.0' /* packageJson.version*/ });

  validateArgs(args);

  const bundles = getBundles(args['<script.js>'], args['<script.js.map>']);

  if (bundles.length === 0) {
    throw new Error('No file(s) found');
  }

  const exploreOptions = getExploreOptions(args);

  if (bundles.length === 1) {
    let data: ExploreResult;

    try {
      const { codePath, mapPath } = bundles[0];
      data = explore(codePath, mapPath, exploreOptions);

      reportUnmappedBytes(data);

      if (args['--json']) {
        console.log(JSON.stringify(data.files, null, '  '));
        process.exit(0);
      } else if (args['--tsv']) {
        console.log('Source\tSize');
        Object.keys(data.files).forEach(source => {
          const size = data.files[source];
          console.log(`${size}\t${source}`);
        });
        process.exit(0);
      } else if (args['--html']) {
        console.log(data.html);
        process.exit(0);
      }

      writeToHtml(data.html);
    } catch (err) {
      if (err.code === 'ENOENT') {
        console.error(`File not found! -- ${err.message}`);
      } else {
        console.error(err.message);
      }

      process.exit(1);
    }
  } else {
    exploreBundlesAndFilterErroneous(bundles).then(results => {
      if (results.length === 0) {
        throw new Error('There were errors');
      }

      // @ts-ignore TODO: Promise.all returns (void | ExploreResult)[] find a way to filter out void
      results.forEach(reportUnmappedBytes);

      // @ts-ignore TODO: Promise.all returns (void | ExploreResult)[] find a way to filter out void
      const html = generateHtml(results);

      // Check args instead of exploreOptions.html because it always true
      if (args['--html']) {
        console.log(html);
      } else {
        writeToHtml(html);
      }
    });
  }
}
