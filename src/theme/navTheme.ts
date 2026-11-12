// React Navigation theme (tabs, stack backgrounds) from the tokens. Dark only.
import { DarkTheme, type Theme } from 'expo-router';
import { colors, fontFamily } from './tokens.ts';

export const navTheme: Theme = {
  ...DarkTheme,
  dark: true,
  colors: {
    primary: colors.accentHi,
    background: colors.bg,
    card: colors.nav,
    text: colors.text,
    border: colors.divider,
    notification: colors.accent,
  },
  fonts: {
    regular: { fontFamily, fontWeight: '400' },
    medium: { fontFamily, fontWeight: '500' },
    bold: { fontFamily, fontWeight: '700' },
    heavy: { fontFamily, fontWeight: '700' },
  },
};
