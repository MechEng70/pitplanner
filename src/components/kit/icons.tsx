// Line icons from the mockups (24 dp grid, 2 dp stroke), ported from legacy/src/ui/icons.tsx onto
// react-native-svg. Like CSS `currentColor`, an icon without `color` takes the color its container sets
// through IconColor (a button's label color, an avatar's tone); outside one it is the primary text color.
import * as React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { colors } from '@/theme/tokens';

export type IconProps = { size?: number; color?: string; testID?: string };

/** The color icons inside a container draw in when they get no `color` prop. */
export const IconColor = React.createContext<string>(colors.text);

function Icon({
  size = 22,
  color,
  width = 2,
  testID,
  children,
}: IconProps & { width?: number; children: React.ReactNode }) {
  const inherited = React.useContext(IconColor);
  return (
    <Svg
      testID={testID}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color ?? inherited}
      strokeWidth={width}
      strokeLinecap="round"
      strokeLinejoin="round"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {children}
    </Svg>
  );
}

const FLAME =
  'M12 22c4 0 7-2.7 7-6.5 0-3.3-2.2-5.5-3.6-7.2-.4 1.6-1.3 2.7-2.4 3.2C13 8 12 5 9 2c0 4-4 6.7-4 11.5C5 19.3 8 22 12 22z';

export const Flame = (p: IconProps) => (
  <Icon {...p}>
    <Path d={FLAME} />
  </Icon>
);
export const GriddleIcon = (p: IconProps) => (
  <Icon {...p}>
    <Rect x="3" y="8" width="18" height="8" rx="2" />
    <Path d="M6 16v3M18 16v3M7 5h2M11 5h2M15 5h2" />
  </Icon>
);
export const OvenIcon = (p: IconProps) => (
  <Icon {...p}>
    <Rect x="4" y="5" width="16" height="14" rx="2.5" />
    <Path d="M4 10h16M8 14h8" />
  </Icon>
);
export const ShareIcon = (p: IconProps) => (
  <Icon {...p}>
    <Circle cx="18" cy="5" r="3" />
    <Circle cx="6" cy="12" r="3" />
    <Circle cx="18" cy="19" r="3" />
    <Path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
  </Icon>
);
export const Calendar = (p: IconProps) => (
  <Icon {...p}>
    <Rect x="3" y="5" width="18" height="16" rx="2" />
    <Path d="M16 3v4M8 3v4M3 10h18" />
  </Icon>
);
export const ChevronDown = (p: IconProps) => (
  <Icon {...p}>
    <Path d="M6 9l6 6 6-6" />
  </Icon>
);
export const ChevronUp = (p: IconProps) => (
  <Icon {...p}>
    <Path d="M6 15l6-6 6 6" />
  </Icon>
);
export const ChevronLeft = (p: IconProps) => (
  <Icon {...p}>
    <Path d="M15 6l-6 6 6 6" />
  </Icon>
);
export const ChevronRight = (p: IconProps) => (
  <Icon {...p}>
    <Path d="M9 6l6 6-6 6" />
  </Icon>
);
export const Plus = (p: IconProps) => (
  <Icon {...p} width={2.2}>
    <Path d="M12 5v14M5 12h14" />
  </Icon>
);
export const Minus = (p: IconProps) => (
  <Icon {...p} width={2.2}>
    <Path d="M5 12h14" />
  </Icon>
);
export const Close = (p: IconProps) => (
  <Icon {...p}>
    <Path d="M6 6l12 12M18 6L6 18" />
  </Icon>
);
export const Check = (p: IconProps) => (
  <Icon {...p}>
    <Path d="M5 12.5l4.5 4.5L19 7.5" />
  </Icon>
);
export const Search = (p: IconProps) => (
  <Icon {...p}>
    <Circle cx="11" cy="11" r="7" />
    <Path d="M20 20l-3.5-3.5" />
  </Icon>
);
export const ListIcon = (p: IconProps) => (
  <Icon {...p}>
    <Path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />
  </Icon>
);
export const Timer = (p: IconProps) => (
  <Icon {...p}>
    <Circle cx="12" cy="13" r="8" />
    <Path d="M12 9v4l2.5 2.5M9 2h6" />
  </Icon>
);
export const Sliders = (p: IconProps) => (
  <Icon {...p}>
    <Path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" />
  </Icon>
);
export const MoreVert = (p: IconProps) => (
  <Icon {...p} width={3.2}>
    <Path d="M12 5h.01M12 12h.01M12 19h.01" />
  </Icon>
);
export const Bell = (p: IconProps) => (
  <Icon {...p}>
    <Path d="M6 8.5a6 6 0 0 1 12 0c0 5.5 2.5 7.5 2.5 7.5h-17S6 14 6 8.5z" />
    <Path d="M10.3 20a2 2 0 0 0 3.4 0" />
  </Icon>
);
export const BellOff = (p: IconProps) => (
  <Icon {...p}>
    <Path d="M8.7 3.6A6 6 0 0 1 18 8.5c0 2.6.4 4.5 1 6M6.3 6.3A6 6 0 0 0 6 8.5C6 14 3.5 16 3.5 16H16" />
    <Path d="M10.3 20a2 2 0 0 0 3.4 0M3 3l18 18" />
  </Icon>
);
export const FlameOff = (p: IconProps) => (
  <Icon {...p}>
    <Path d={FLAME} />
    <Path d="M4 4l16 16" />
  </Icon>
);
export const Restart = (p: IconProps) => (
  <Icon {...p}>
    <Path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
    <Path d="M3 3v5h5" />
  </Icon>
);
export const StopSquare = (p: IconProps) => (
  <Icon {...p}>
    <Rect x="5" y="5" width="14" height="14" rx="2" />
  </Icon>
);
export const Warn = (p: IconProps) => (
  <Icon {...p}>
    <Path d="M12 3l10 18H2L12 3z" />
    <Path d="M12 10v5M12 18h.01" />
  </Icon>
);
export const HomeIcon = (p: IconProps) => (
  <Icon {...p}>
    <Path d="M4 11l8-7 8 7v9H4z" />
    <Path d="M10 20v-5h4v5" />
  </Icon>
);
export const Cup = (p: IconProps) => (
  <Icon {...p}>
    <Path d="M4 10h13v4a6 6 0 0 1-6 6h-1a6 6 0 0 1-6-6z" />
    <Path d="M17 11h1.5a2.5 2.5 0 0 1 0 5H17M8 3v3M12 3v3" />
  </Icon>
);
export const Thermo = (p: IconProps) => (
  <Icon {...p}>
    <Path d="M14 14.8V5a2 2 0 0 0-4 0v9.8a4 4 0 1 0 4 0z" />
    <Path d="M12 11v6" />
  </Icon>
);

export type CookerKind = 'smoker' | 'griddle' | 'oven';

/** Avatar glyph: ember flame for a smoker, blue griddle, plain oven (mockups 01, 05, 17). */
export function CookerIcon({ kind, size = 22 }: { kind: CookerKind; size?: number }) {
  const testID = `cooker-icon-${kind}`;
  if (kind === 'griddle') return <GriddleIcon size={size} color={colors.griddle} testID={testID} />;
  if (kind === 'oven') return <OvenIcon size={size} color={colors.text1} testID={testID} />;
  return <Flame size={size} color={colors.accent} testID={testID} />;
}
