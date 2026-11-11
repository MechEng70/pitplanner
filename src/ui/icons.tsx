// Line icons from the mockups (24px grid, 2px stroke).

type P = { size?: number; color?: string };
const svg = (d: preact.ComponentChildren, { size = 22, color = 'currentColor' }: P, width = 2) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} stroke-width={width}
    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{d}</svg>
);

export const Flame = (p: P) => svg(<path d="M12 22c4 0 7-2.7 7-6.5 0-3.3-2.2-5.5-3.6-7.2-.4 1.6-1.3 2.7-2.4 3.2C13 8 12 5 9 2c0 4-4 6.7-4 11.5C5 19.3 8 22 12 22z" />, p);
export const GriddleIcon = (p: P) => svg(<><rect x="3" y="8" width="18" height="8" rx="2" /><path d="M6 16v3M18 16v3M7 5h2M11 5h2M15 5h2" /></>, p);
export const ShareIcon = (p: P) => svg(<><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" /></>, p);
export const Calendar = (p: P) => svg(<><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>, p);
export const ChevronDown = (p: P) => svg(<path d="M6 9l6 6 6-6" />, p);
export const ChevronUp = (p: P) => svg(<path d="M6 15l6-6 6 6" />, p);
export const ChevronLeft = (p: P) => svg(<path d="M15 6l-6 6 6 6" />, p);
export const ChevronRight = (p: P) => svg(<path d="M9 6l6 6-6 6" />, p);
export const Plus = (p: P) => svg(<path d="M12 5v14M5 12h14" />, p, 2.2);
export const Minus = (p: P) => svg(<path d="M5 12h14" />, p, 2.2);
export const Close = (p: P) => svg(<path d="M6 6l12 12M18 6L6 18" />, p);
export const Check = (p: P) => svg(<path d="M5 12.5l4.5 4.5L19 7.5" />, p);
export const Search = (p: P) => svg(<><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></>, p);
export const ListIcon = (p: P) => svg(<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />, p);
export const Timer = (p: P) => svg(<><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 2.5M9 2h6" /></>, p);
export const Sliders = (p: P) => svg(<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" />, p);
export const MoreVert = (p: P) => svg(<path d="M12 5h.01M12 12h.01M12 19h.01" />, p, 3.2);
export const BellOff = (p: P) => svg(<><path d="M8.7 3.6A6 6 0 0 1 18 8.5c0 2.6.4 4.5 1 6M6.3 6.3A6 6 0 0 0 6 8.5C6 14 3.5 16 3.5 16H16" /><path d="M10.3 20a2 2 0 0 0 3.4 0M3 3l18 18" /></>, p);
export const FlameOff = (p: P) => svg(<><path d="M12 22c4 0 7-2.7 7-6.5 0-3.3-2.2-5.5-3.6-7.2-.4 1.6-1.3 2.7-2.4 3.2C13 8 12 5 9 2c0 4-4 6.7-4 11.5C5 19.3 8 22 12 22z" /><path d="M4 4l16 16" /></>, p);
export const Restart = (p: P) => svg(<><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></>, p);
export const StopSquare = (p: P) => svg(<rect x="5" y="5" width="14" height="14" rx="2" />, p);
export const Warn = (p: P) => svg(<><path d="M12 3l10 18H2L12 3z" /><path d="M12 10v5M12 18h.01" /></>, p);

export const Bell = (p: P) => svg(<><path d="M6 8.5a6 6 0 0 1 12 0c0 5.5 2.5 7.5 2.5 7.5h-17S6 14 6 8.5z" /><path d="M10.3 20a2 2 0 0 0 3.4 0" /></>, p);
export const HomeIcon = (p: P) => svg(<><path d="M4 11l8-7 8 7v9H4z" /><path d="M10 20v-5h4v5" /></>, p);
export const Cup = (p: P) => svg(<><path d="M4 10h13v4a6 6 0 0 1-6 6h-1a6 6 0 0 1-6-6z" /><path d="M17 11h1.5a2.5 2.5 0 0 1 0 5H17M8 3v3M12 3v3" /></>, p);
export const Thermo = (p: P) => svg(<><path d="M14 14.8V5a2 2 0 0 0-4 0v9.8a4 4 0 1 0 4 0z" /><path d="M12 11v6" /></>, p);
export const OvenIcon = (p: P) => svg(<><rect x="4" y="5" width="16" height="14" rx="2.5" /><path d="M4 10h16M8 14h8" /></>, p);

/** Avatar glyph: ember flame for smoker, blue griddle, plain oven (mockups 01, 17). */
export function CookerAvatarIcon({ kind, size = 22 }: { kind: 'smoker' | 'griddle' | 'oven'; size?: number }) {
  if (kind === 'griddle') return <GriddleIcon size={size} color="var(--griddle)" />;
  if (kind === 'oven') return <OvenIcon size={size} color="var(--text-1)" />;
  return <Flame size={size} color="var(--accent)" />;
}
