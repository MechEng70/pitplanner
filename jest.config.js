// App tests (Jest + React Native Testing Library). Engine tests stay on node:test (`npm run test:engine`).
export default {
  preset: 'jest-expo',
  // No tests under app/: Expo Router would treat them as routes.
  testMatch: ['<rootDir>/src/**/*.test.{ts,tsx}', '<rootDir>/*.test.ts'],
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/legacy/', '<rootDir>/android/'],
  globalSetup: '<rootDir>/jest.global-setup.js',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  // jest-expo's list plus packages that ship untranspiled JSX/ESM (@rn-primitives, nativewind, css-interop).
  transformIgnorePatterns: [
    '/node_modules/(?!(.pnpm|react-native|@react-native|@react-native-community|expo|@expo|@expo-google-fonts|react-navigation|@react-navigation|@sentry/react-native|native-base|standard-navigation|@rn-primitives|nativewind|react-native-css-interop))',
    '/node_modules/react-native-reanimated/plugin/',
    '/node_modules/@react-native/babel-preset/',
  ],
};
