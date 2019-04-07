module.exports = {
  root: true,
  env: {
    commonjs: true,
    node: true,
    es6: true,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: './tsconfig.json',
  },
  plugins: ['prettier', '@typescript-eslint'],
  extends: [
    'plugin:@typescript-eslint/recommended',
    'eslint:recommended',
    'plugin:prettier/recommended',
    'prettier/@typescript-eslint',
  ],
  rules: {
    'func-style': ['error', 'declaration'],
    'no-console': 0,
    'prefer-arrow-callback': 'error',
    'prefer-const': 2,
    'padding-line-between-statements': [
      'error',
      { blankLine: 'always', prev: '*', next: 'return' },
    ],
    // TypeScript specific
    '@typescript-eslint/explicit-function-return-type': ['warn', { allowExpressions: true }],
  },
};
