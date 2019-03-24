#!/usr/bin/env node

const { docopt } = require('docopt');
const fs = require('fs');
const temp = require('temp');
const open = require('opn');

const packageJson = require('../package.json');

const { explore, exploreBundlesAndFilterErroneous } = require('./api');
const { reportUnmappedBytes, generateHtml, getBundles } = require('./common');

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
 * @typedef {Object} Args
 * @property {string} `<script.js>` - Path to code file or Glob matching bundle files
 * @property {(string|null)} `<script.js.map>` - Path to map file
 * @property {boolean} `--json`
 * @property {boolean} `--html`
 * @property {boolean} `--tsv`
 * @property {boolean}  `--only-mapped`
 * @property {boolean}  `-m`
 * @property {string[]} `--replace`
 * @property {string[]} `--with`
 * @property {boolean} `--noroot`
 */

/**
 * Validates CLI arguments
 * @param {Args} args
 */
function validateArgs(args) {
  if (args['--replace'].length !== args['--with'].length) {
    console.error('--replace flags must be paired with --with flags.');
    process.exit(1);
  }
}

/**
 * @typedef {Object} ExploreOptions
 * @property {boolean} onlyMapped
 * @property {boolean} html
 * @property {boolean} noRoot
 * @property {Object.<string, string>} replace
 */

/**
 * Create options object for `explore` method
 * @param {Args} args CLI arguments
 * @returns {ExploreOptions}
 */
function getExploreOptions(args) {
  let html = true;
  if (args['--json'] || args['--tsv']) {
    html = false;
  }

  const replace = {};
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
    noRoot: args['--noroot'],
    replace,
  };
}

/**
 * Write HTML content to a temporary file and open the file in a browser
 * @param {string} html
 */
function writeToHtml(html) {
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
  /** @type {Args} */
  const args = docopt(doc, { version: packageJson.version });

  validateArgs(args);

  const bundles = getBundles(args['<script.js>'], args['<script.js.map>']);

  if (bundles.length === 0) {
    throw new Error('No file(s) found');
  }

  const exploreOptions = getExploreOptions(args);

  if (bundles.length === 1) {
    let data;

    try {
      const { codePath, mapPath } = bundles[0];
      data = explore(codePath, mapPath, exploreOptions);
    } catch (err) {
      if (err.code === 'ENOENT') {
        console.error(`File not found! -- ${err.message}`);
        process.exit(1);
      } else {
        console.error(err.message);
        process.exit(1);
      }
    }

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
  } else {
    exploreBundlesAndFilterErroneous(bundles).then(results => {
      if (results.length === 0) {
        throw new Error('There were errors');
      }

      results.forEach(reportUnmappedBytes);

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
