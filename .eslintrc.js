module.exports = {
  root: true,
  env: {
    commonjs: true,
    mocha: true,
    node: true,
    es6: true,
  },
  parserOptions: {
    ecmaVersion: 2018,
  },
  plugins: ['prettier'],
  extends: ['eslint:recommended', 'plugin:prettier/recommended'],
  rules: {
    'no-console': 0,
    'prefer-const': 2,
    'padding-line-between-statements': [
      "error",
      { blankLine: "always", prev: "*", next: "return" }
    ]
  },
};
