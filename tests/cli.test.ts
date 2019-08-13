import { expect } from 'chai';
import path from 'path';
import snapshot from '@smpx/snap-shot-it';

import { execute, setTestFolder } from './test-helpers';

// Test compiled source
const SCRIPT_PATH = path.resolve(__dirname, '../dist/cli.js');

describe('CLI', function() {
  setTestFolder();

  it('should validate --replace arguments', async function() {
    try {
      await execute(SCRIPT_PATH, [
        'data/inline-map.js',
        '--replace=foo',
        '--with=bar',
        '--replace=we',
      ]);
    } catch (err) {
      expect(err).to.include('--replace flags must be paired with --with flags');
    }
  });

  it('should print result as JSON and support path wrapped by quotes', async function() {
    const result = await execute(SCRIPT_PATH, ["'data/inline-map.js'", '--json']);

    snapshot(result);
  });

  it('should print multiple results as JSON', async function() {
    const result = await execute(SCRIPT_PATH, ['data/inline-map.js', 'data/foo.min.js*', '--json']);

    snapshot(result);
  });

  it('should output result as tsv', async function() {
    const result = await execute(SCRIPT_PATH, ['data/inline-map.js', '--tsv']);

    expect(result)
      .to.have.string('Source\tSize')
      .and.have.string('src/bar.js\t104');
  });

  it('should output multiple results as tsv', async function() {
    const result = await execute(SCRIPT_PATH, ['data/inline-map.js', 'data/foo.min.js*', '--tsv']);

    expect(result)
      .to.have.string('Source\tSize')
      .and.have.string('<unmapped>\t2309')
      .and.have.string('<unmapped>\t36');
  });

  it('should output result as html', async function() {
    const result = await execute(SCRIPT_PATH, ['data/inline-map.js', '--html']);

    snapshot(result);
  });
});
