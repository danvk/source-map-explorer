import { expect } from 'chai';
import { PerformanceObserver, performance } from 'perf_hooks';

import { explore } from '../../src/api';
import { setTestFolder } from '../test-helpers';

// Set to value actual for CI (not your local environment)
const BIG_FILE_EXPLORE_WITH_HTML = 5000;

describe('api', () => {
  describe('explore', () => {
    setTestFolder();

    it(`should explore big file in less than ${BIG_FILE_EXPLORE_WITH_HTML}ms`, async () => {
      const obs = new PerformanceObserver(items => {
        const duration = items.getEntries()[0].duration;

        expect(duration).to.be.lessThan(BIG_FILE_EXPLORE_WITH_HTML);

        console.log(`Actual duration: ${duration}ms`);

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
