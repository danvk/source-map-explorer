module.exports = {
  file: 'tests/setup.ts',
  require: ['./tests/env.js', 'ts-node/register', 'source-map-support/register'],
  timeout: 60000,
  colors: true,
  recursive: true,
};
