import { expect } from 'chai';
import { PerformanceObserver, performance } from 'perf_hooks';

import { explore } from '../../src/api';
import { setTestFolder } from '../test-helpers';

const BIG_FILE_EXPLORE = 350;

describe('api', () => {
  describe('explore', () => {
    setTestFolder();

    it(`should explore big file in less than ${BIG_FILE_EXPLORE}ms`, async () => {
      const obs = new PerformanceObserver(items => {
        const duration = items.getEntries()[0].duration;

        expect(duration).to.be.lessThan(BIG_FILE_EXPLORE);

        performance.clearMarks();
        obs.disconnect();
      });

      obs.observe({ entryTypes: ['measure'] });

      performance.mark('A');
      await explore('data/big.js');
      performance.mark('B');
      performance.measure('A to B', 'A', 'B');
    });
  });
});
