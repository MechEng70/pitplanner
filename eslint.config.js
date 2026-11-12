// ESLint flat config: Preact rules (eslint-config-preact) + typescript-eslint recommended.
// typescript-eslint supports TypeScript up to 6.0, so it parses with the `typescript` 6.0 package;
// `npm run typecheck` uses TypeScript 7 (`typescript7`). See docs/design/TECH-DESIGN.md, risks.
import preact from 'eslint-config-preact';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      'dist/',
      'android/',
      'release/',
      'reference/',
      'docs/',
      'node_modules/',
      'tools/device/out/',
      'coverage/',
    ],
  },
  ...preact,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { ecmaFeatures: { jsx: true }, sourceType: 'module' },
    },
    rules: {
      'no-undef': 'off', // TypeScript checks this
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        // ignoreRestSiblings: `const { secret, ...rest } = x` is how fields are dropped (share export).
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
    },
  },
  {
    files: ['tools/**/*.{js,mjs}', '*.config.{js,ts}'],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    settings: { react: { pragma: 'h', version: '16.0' }, polyfills: ['fetch', 'Promise'] },
  },
);
