// ESLint flat config (TECH-DESIGN section 11, step 2; zero warnings).
// eslint-config-expo (React, React Hooks, import, Expo rules) + typescript-eslint + eslint-plugin-react-native
// + the layer rules of TECH-DESIGN section 3 as no-restricted-imports. `tools/gate.test.mjs` proves each layer
// rule fires; keep it in step when a rule changes.
import expoConfig from 'eslint-config-expo/flat.js';
import { config as tsConfig, configs as tsConfigs } from 'typescript-eslint';
import reactNative from 'eslint-plugin-react-native';
import globals from 'globals';

const RN_AND_EXPO = ['react-native', 'react-native-*', 'expo', 'expo-*', '@expo/*', 'expo/*'];
const msg = (layer, rule) => `${layer}: ${rule} (TECH-DESIGN section 3).`;

/** Import paths that leave a layer, written as gitignore-style groups for no-restricted-imports. */
const UI = ['**/app/**', '**/screens/**', '**/components/**'];
const NATIVE_MODULES = ['**/modules/**'];

function restrict(...patterns) {
  return ['error', { patterns }];
}

export default tsConfig(
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
  ...expoConfig,
  ...tsConfigs.recommended,
  {
    plugins: { 'react-native': reactNative },
    rules: {
      'react-native/no-unused-styles': 'error',
      'react-native/split-platform-components': 'error',
      'react-native/no-single-element-style-arrays': 'error',
      // Theme tokens only (UI acceptance rules): no hex or rgb literals in styles, no inline style objects.
      'react-native/no-color-literals': 'error',
      'react-native/no-inline-styles': 'error',
      'react-native/no-raw-text': ['error', { skip: [] }],
    },
  },
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

  // Layer rules (TECH-DESIGN section 3).
  {
    files: ['engine/**/*.ts'],
    ignores: ['engine/**/*.test.ts'],
    rules: {
      'no-restricted-imports': restrict(
        { group: ['react', 'react/*', ...RN_AND_EXPO], message: msg('engine', 'no React, React Native or Expo') },
        { group: ['**/src/**', ...UI, ...NATIVE_MODULES], message: msg('engine', 'imports only engine/*') },
        { group: ['node:*', 'fs', 'path', 'os', 'http', 'https'], message: msg('engine', 'no storage or network') },
      ),
      'no-restricted-syntax': [
        'error',
        {
          selector: "MemberExpression[object.name='Date'][property.name='now']",
          message: msg('engine', 'no clock; pass `now` in'),
        },
        { selector: "NewExpression[callee.name='Date'][arguments.length=0]", message: msg('engine', 'no clock') },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'fetch', message: msg('engine', 'no network') },
        { name: 'localStorage', message: msg('engine', 'no storage') },
      ],
    },
  },
  {
    // Engine tests may import the pure helpers in src/lib (rule 3) and node:test, nothing from the app.
    files: ['engine/**/*.test.ts'],
    rules: {
      'no-restricted-imports': restrict({
        group: ['react', 'react/*', ...RN_AND_EXPO, ...UI, ...NATIVE_MODULES],
        message: msg('engine tests', 'run under node --test; no React Native or Expo'),
      }),
    },
  },
  {
    files: ['src/lib/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': restrict(
        { group: RN_AND_EXPO, message: msg('src/lib', 'no React Native UI or expo-* directly; use src/platform') },
        { group: [...UI, ...NATIVE_MODULES], message: msg('src/lib', 'no screens, components or native modules') },
        {
          group: ['**/platform/*', '!**/platform/types', '!**/platform/types.ts'],
          message: msg('src/lib', 'platform interfaces only (src/platform/types.ts); implementations are injected'),
        },
        { group: ['**/db/expoDb', '**/db/expoDb.ts'], message: msg('src/lib', 'use the Db interface') },
      ),
    },
  },
  {
    files: ['src/db/**/*.{ts,tsx}'],
    ignores: ['src/db/expoDb.ts'],
    rules: {
      'no-restricted-imports': restrict(
        { group: ['expo-sqlite', 'expo-sqlite/*'], message: msg('src/db', 'expo-sqlite only in src/db/expoDb.ts') },
        { group: [...UI, ...NATIVE_MODULES], message: msg('src/db', 'no screens or native modules') },
      ),
    },
  },
  {
    files: ['src/platform/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': restrict(
        { group: ['expo-sqlite', 'expo-sqlite/*'], message: msg('src/platform', 'storage lives in src/db') },
        { group: [...UI, '**/lib/store', '**/lib/store.*'], message: msg('src/platform', 'no screens or app state') },
      ),
    },
  },
  {
    files: ['app/**/*.{ts,tsx}', 'src/screens/**/*.{ts,tsx}', 'src/components/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': restrict(
        { group: ['expo-sqlite', 'expo-sqlite/*'], message: msg('UI', 'no expo-sqlite; go through src/lib') },
        {
          group: [...NATIVE_MODULES, '**/db/expoDb', '**/db/expoDb.ts'],
          message: msg('UI', 'no native modules or Db'),
        },
      ),
    },
  },

  {
    files: ['**/*.test.{ts,tsx}', 'jest.setup.ts'],
    languageOptions: { globals: { ...globals.jest } },
    // jest.mock factories load modules with require(); they run before imports are hoisted.
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  {
    files: ['tools/**/*.{js,mjs}', '*.config.{js,ts}', 'jest.*.js'],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    // Babel and Metro load their configs synchronously, so these stay CommonJS (package.json is "type": "module").
    files: ['*.cjs'],
    languageOptions: { sourceType: 'commonjs', globals: { ...globals.node } },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
);
