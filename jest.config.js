// App tests (Jest + React Native Testing Library). Engine tests stay on node:test (`npm run test:engine`).
export default {
  preset: 'jest-expo',
  // No tests under app/: Expo Router would treat them as routes.
  testMatch: ['<rootDir>/src/**/*.test.{ts,tsx}', '<rootDir>/*.test.ts'],
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/legacy/', '<rootDir>/android/'],
  globalSetup: '<rootDir>/jest.global-setup.js',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
};
