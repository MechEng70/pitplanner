// ESLint flat config, T-002 minimum: @eslint/js + typescript-eslint recommended.
// T-003 adds eslint-config-expo, React / React Hooks / React Native rules and the layer import rules.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      'android/',
      'ios/',
      '.expo/',
      'expo-env.d.ts',
      'legacy/',
      'release/',
      'reference/',
      'docs/',
      'node_modules/',
      'coverage/',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      'no-undef': 'off', // TypeScript checks this
      '@typescript-eslint/no-unused-vars': [
        'error',
        // ignoreRestSiblings: `const { secret, ...rest } = x` is how fields are dropped (share export).
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
    },
  },
  {
    files: ['tools/**/*.{js,mjs}', '*.config.{js,ts}', 'jest.*.js'],
    languageOptions: { globals: { ...globals.node } },
  },
);
