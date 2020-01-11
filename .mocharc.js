module.exports = {
  spec: 'tests/*.test.ts',
  file: ['tests/setup.js'],
  require: './tests/babel-register.js',
  timeout: 999999,
  colors: true,
};
