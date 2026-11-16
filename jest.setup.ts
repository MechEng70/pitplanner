// Jest setup for app tests (jest-expo + React Native Testing Library). Proved by src/test/jestSetup.test.tsx.

// Safe area: zero insets and a 320x640 frame, no provider needed (the library's own mock).
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);

// Fonts: report every font as loaded at once, so screens that wait on useFonts render on the first pass.
jest.mock('expo-font', () => ({
  ...jest.requireActual('expo-font'),
  useFonts: () => [true, null],
  isLoaded: () => true,
  loadAsync: async () => {},
}));

// File picker (T-036): not in Jest. Screens take the picker as a prop and tests pass the fake
// (src/platform/fakes.ts `fakeFilePicker`); this answers "cancelled" for anything that reaches the module.
jest.mock('expo-document-picker', () => ({
  getDocumentAsync: async () => ({ canceled: true, assets: null }),
}));
