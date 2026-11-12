// Regression (T-005): NativeWind inlines `rem` as 14 dp by default, so Tailwind spacing classes came out
// 12.5% short (`p-4` was 14 dp, `px-6` 21 dp). The kit is sized in dp from ui.css, so rem must be 16.
jest.mock('expo/metro-config', () => ({ getDefaultConfig: () => ({}) }));
jest.mock('nativewind/metro', () => ({ withNativeWind: jest.fn((config: object) => config) }));

test('Metro compiles NativeWind classes with 1rem = 16 dp', () => {
  require('../../metro.config.cjs');
  const { withNativeWind } = require('nativewind/metro') as { withNativeWind: jest.Mock };
  expect(withNativeWind).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ inlineRem: 16 }));
});
