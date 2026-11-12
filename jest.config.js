// App tests (Jest + React Native Testing Library). Engine tests stay on node:test (`npm run test:engine`).
// T-003 adds the full setup (font and safe-area mocks, coverage); this is the T-002 minimum.
export default {
  preset: 'jest-expo',
  // No tests under app/: Expo Router would treat them as routes.
  testMatch: ['<rootDir>/src/**/*.test.{ts,tsx}', '<rootDir>/*.test.ts'],
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/legacy/', '<rootDir>/android/'],
  globalSetup: '<rootDir>/jest.global-setup.js',
};
