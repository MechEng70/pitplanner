// Metro: Expo defaults plus NativeWind (compiles global.css with tailwind.config.js).
// inlineRem 16: NativeWind's default is 14, which made every Tailwind spacing class 12.5% short of its
// dp value (`p-4` was 14 dp, not 16). tokens.test.ts guards this.
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

module.exports = withNativeWind(getDefaultConfig(__dirname), { input: './global.css', inlineRem: 16 });
