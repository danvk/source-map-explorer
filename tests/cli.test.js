import { expect } from 'chai';
import path from 'path';

import { execute } from './test-helpers';

// Test compiled source
const SCRIPT_PATH = path.resolve(__dirname, '../dist/cli.js');

describe('CLI', function() {
  it('should validate --replace arguments', async function() {
    try {
      await execute(SCRIPT_PATH, [
        'data/foo.min.inline-map.js',
        '--replace=foo',
        '--with=bar',
        '--replace=we',
      ]);
    } catch (err) {
      expect(err).to.include('--replace flags must be paired with --with flags.');
    }
  });

  it('should print result as JSON', async function() {
    const result = await execute(SCRIPT_PATH, ['data/foo.min.inline-map.js', '--json']);

    expect(result).to.matchSnapshot();
  });

  it('should output result as tsv', async function() {
    const result = await execute(SCRIPT_PATH, ['data/foo.min.inline-map.js', '--tsv']);

    expect(result).to.matchSnapshot();
  });

  it('should output result as html', async function() {
    const result = await execute(SCRIPT_PATH, ['data/foo.min.inline-map.js', '--html']);

    expect(result).to.matchSnapshot();
  });
});
