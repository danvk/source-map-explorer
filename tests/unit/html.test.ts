import snapshot from '@smpx/snap-shot-it';

import { getWebTreeMapData } from '../../src/html';

import type { FileDataMap } from '../../src/types';

describe('html', () => {
  describe('getWebTreeMapData', () => {
    it('should collapse non-contributing nodes', () => {
      const fileDataMap: FileDataMap = {
        'a/b/c.js': { size: 1 },
        'd/e.js': { size: 2 },
        'd/f.js': { size: 3 },
        'd/g/h.js': { size: 4 },
        'd/g/i.js': { size: 5 },
        'd/j/i.js': { size: 6 },
        z: { size: 7 },
      };

      snapshot(getWebTreeMapData(fileDataMap));
    });

    it('should not split webpack:/// when collapsing non-contributing nodes', () => {
      const fileDataMap: FileDataMap = {
        'webpack:///a/b/c.js': { size: 1 },
        'webpack:///d/e.js': { size: 2 },
        'webpack:///d/f.js': { size: 3 },
        'd/webpack:///g/h.js': { size: 4 },
        'd/webpack:///g/i.js': { size: 5 },
        'd/j/i.js': { size: 6 },
        z: { size: 7 },
      };

      snapshot(getWebTreeMapData(fileDataMap));
    });

    it('should not create node for zero size files', () => {
      const fileDataMap: FileDataMap = {
        'a/b/c.js': { size: 1 },
        'd/e.js': { size: 2 },
        'd/f.js': { size: 3 },
        'd/g/h.js': { size: 4 },
        'd/j/k.js': { size: 5 },
        '[unmapped]': { size: 0 },
      };

      snapshot(getWebTreeMapData(fileDataMap));
    });

    it('should add coverage data and background color', () => {
      const fileDataMap: FileDataMap = {
        'a/b/c.js': { size: 1, coveredSize: 1 },
        'd/e.js': { size: 2, coveredSize: 1 },
        'd/f.js': { size: 3, coveredSize: 2 },
        'd/g/h.js': { size: 4, coveredSize: 3 },
        'd/j/k.js': { size: 5, coveredSize: 2 },
        z: { size: 6, coveredSize: 0 },
      };

      snapshot(getWebTreeMapData(fileDataMap));
    });
  });
});
