const base = require('./.mocharc.base.js');

module.exports = {
  ...base,
  spec: 'tests/performance/*.test.ts',
};
