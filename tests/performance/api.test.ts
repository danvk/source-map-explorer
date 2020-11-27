import { expect } from 'chai';
import { PerformanceObserver, performance } from 'perf_hooks';

import { explore } from '../../src/lib/api';
import { setTestFolder } from '../test-helpers';

// TODO: Figure out what caused performance drop by ~1.5sec after c6de7123a6271d897eabc26190b0abc9a372a7e1 commit. Return 6000 as a value
// Set to value actual for CI (not your local environment)
const BIG_FILE_EXPLORE_WITH_HTML_MS = 15000;

describe('api', () => {
  describe('explore', () => {
    setTestFolder();

    it(`should explore big file in less than ${BIG_FILE_EXPLORE_WITH_HTML_MS}ms`, async () => {
      const obs = new PerformanceObserver((items) => {
        const duration = items.getEntries()[0].duration;

        expect(duration).to.be.lessThan(BIG_FILE_EXPLORE_WITH_HTML_MS);

        performance.clearMarks();
        obs.disconnect();
      });

      obs.observe({ entryTypes: ['measure'] });

      performance.mark('A');

      // Set output 'html' to cover default use case
      await explore('data/big.js', { output: { format: 'html' } });

      performance.mark('B');
      performance.measure('A to B', 'A', 'B');
    });
  });
});
