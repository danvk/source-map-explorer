import { expect } from 'chai';

import { leafify } from '../src/json-explore';

describe('json-explore', function() {
  it.only('should leafify', () => {
    expect(
      leafify({
        'a/b/c': 12,
        'a/b': 18,
        a: 24,
      })
    ).to.deep.equal({
      'a/b/c': 12,
      'a/b': 6,
      a: 6,
    });
  });
});
