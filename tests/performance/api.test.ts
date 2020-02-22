import { explore } from '../../src/api';
import { setTestFolder } from '../test-helpers';

const BIG_FILE_EXPLORE = 350;

describe('api', () => {
  describe('explore', () => {
    setTestFolder();

    it(`should explore big file in less than ${BIG_FILE_EXPLORE}ms`, async function() {
      this.timeout(BIG_FILE_EXPLORE);

      await explore('data/big.js');
    });
  });
});
