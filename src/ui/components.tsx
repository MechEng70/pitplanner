// Shared components, built from the mockup artboards (docs/mockups/source/*.dc.html).
// Screens compose these; they do not add their own CSS.
//
// Font scale rule: times, temps, weights and countdowns are <Num> units that never wrap,
// shrink or ellipsize. Only secondary text (subtitles, notes) may ellipsize.

import type { ComponentChildren, JSX } from 'preact';
import { createContext } from 'preact';
import { useCallback, useContext, useEffect, useRef, useState } from 'preact/hooks';
import { ChevronRight, Close, CookerAvatarIcon, Minus, Plus, Search } from './icons.tsx';
import { useBack } from './back.ts';

type Kids = { children?: ComponentChildren };
const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

/* ---------- Text ---------- */

export type TextVariant = 'when' | 'result' | 'headline' | 'title' | 'sheetTitle' | 'section' | 'bodyL' | 'bodyM' | 'body' | 'label' | 'caption' | 'overline' | 'value' | 'display';
export type Tone = 'primary' | 'secondary' | 'tertiary' | 'soft' | 'accent' | 'accentHi' | 'ok' | 'warn' | 'error' | 'griddle';

export function Text({ v = 'body', tone, weight, clamp, center, as: Tag = 'span', children }: Kids & {
  v?: TextVariant; tone?: Tone; weight?: 400 | 500 | 700; clamp?: boolean; center?: boolean; as?: 'span' | 'p' | 'h1' | 'h2' | 'h3';
}) {
  return <Tag class={cx(`t-${v}`, tone && `tone-${tone}`, weight && `w-${weight}`, clamp && 'clamp', center && 'center')}>{children}</Tag>;
}

/** A number with its unit ("6:40 AM", "225F", "12.0 lb", "1 hr 40 min"): tabular, never broken or cut. */
export const Num = ({ children }: Kids) => <span class="num">{children}</span>;

/* ---------- Layout ---------- */

type Gap = 0 | 2 | 4 | 6 | 8 | 10 | 12 | 14 | 16 | 20 | 24;
export function Stack({ gap = 0, grow, center, children }: Kids & { gap?: Gap; grow?: boolean; center?: boolean }) {
  return <div class={cx('stack', `gap-${gap}`, grow && 'grow', center && 'stack-center')}>{children}</div>;
}
export function Row({ gap = 0, justify, align = 'center', wrap, grow, children }: Kids & {
  gap?: Gap; justify?: 'between' | 'end' | 'center'; align?: 'center' | 'baseline' | 'start'; wrap?: boolean; grow?: boolean;
}) {
  return <div class={cx('row', `gap-${gap}`, justify && `jc-${justify}`, `ai-${align}`, wrap && 'wrap', grow && 'grow')}>{children}</div>;
}
/** Shrinkable text column next to fixed number columns. */
export const Fill = ({ children }: Kids) => <div class="fill">{children}</div>;
/** Fixed column for numbers: right-aligned, never shrinks. */
export const Fixed = ({ children, end = true }: Kids & { end?: boolean }) => <div class={cx('fixed', end && 'fixed-end')}>{children}</div>;
export const Spacer = () => <div class="grow" />;
/** 16 dp side padding inside a flush sheet. */
export const Inset = ({ children }: Kids) => <div class="inset">{children}</div>;

/* ---------- App structure ---------- */

export function AppBar({ title, actions }: { title: string; actions?: ComponentChildren }) {
  return (
    <header class="appbar">
      <h1 class="t-title">{title}</h1>
      {actions && <div class="row gap-0">{actions}</div>}
    </header>
  );
}

/** App bar, a scrolling body with 16 dp sides, and an optional footer pinned above the nav. */
export function Screen({ title, actions, footer, children }: Kids & { title: string; actions?: ComponentChildren; footer?: ComponentChildren }) {
  return (
    <div class="screen">
      <AppBar title={title} actions={actions} />
      <div class="screen-body">{children}</div>
      {footer && <div class="screen-foot">{footer}</div>}
    </div>
  );
}

export interface NavItem { id: string; label: string; icon: ComponentChildren }
export function BottomNav({ items, value, onChange }: { items: NavItem[]; value: string; onChange: (id: string) => void }) {
  return (
    <nav class="bottom-nav" aria-label="Main">
      {items.map(it => (
        <button key={it.id} class={cx('nav-item', it.id === value && 'on')} aria-current={it.id === value ? 'page' : undefined} onClick={() => onChange(it.id)}>
          <span class="nav-pill rp">{it.icon}</span>
          <span>{it.label}</span>
        </button>
      ))}
    </nav>
  );
}

/* ---------- Surfaces ---------- */

export function Card({ onClick, tone = 'surface', pad = 'm', label, children }: Kids & {
  onClick?: () => void; tone?: 'surface' | 'result' | 'outline' | 'inset'; pad?: 's' | 'm' | 'l'; label?: string;
}) {
  const c = cx('card', `card-${tone}`, `pad-${pad}`, onClick && 'rp');
  return onClick ? <button class={c} onClick={onClick} aria-label={label}>{children}</button> : <div class={c}>{children}</div>;
}

export function Avatar({ kind, size = 44 }: { kind: 'smoker' | 'griddle' | 'oven'; size?: 40 | 44 | 72 }) {
  return <span class={cx('avatar', `avatar-${size}`, kind === 'griddle' && 'avatar-griddle')}><CookerAvatarIcon kind={kind} size={size === 72 ? 32 : 22} /></span>;
}

export function Tile({ label, value, tone, onClick }: { label: string; value: string; tone?: Tone; onClick?: () => void }) {
  const body = <><Text v="caption" tone="secondary">{label}</Text><span class={cx('t-tile', tone && `tone-${tone}`)}><Num>{value}</Num></span></>;
  return onClick ? <button class="tile rp" onClick={onClick}>{body}</button> : <div class="tile">{body}</div>;
}
/** Tiles share a row and wrap to a second row rather than clipping a value. */
export const Tiles = ({ children }: Kids) => <div class="tiles">{children}</div>;

export function InfoBox({ lead, children }: Kids & { lead?: ComponentChildren }) {
  return <div class="infobox">{lead && <span class="infobox-lead">{lead}</span>}<span>{children}</span></div>;
}

export function ResultCard({ overline, title, children }: Kids & { overline: ComponentChildren; title: ComponentChildren }) {
  return (
    <div class="card card-result pad-m stack gap-6">
      <span class="t-overline tone-accentHi">{overline}</span>
      <span class="t-result">{title}</span>
      {children}
    </div>
  );
}

export function EmptyState({ icon, title, body, children }: Kids & { icon: ComponentChildren; title: string; body: string }) {
  return (
    <div class="empty">
      <div class="empty-main">
        {icon}
        <Text v="headline" as="h2" center>{title}</Text>
        <Text v="bodyM" tone="secondary" as="p" center>{body}</Text>
      </div>
      <div class="stack gap-4">{children}</div>
    </div>
  );
}

/* ---------- Buttons ---------- */

export function Button({ kind = 'primary', block, icon, disabled, onClick, children, label, tone }: Kids & {
  kind?: 'primary' | 'outline' | 'text' | 'tonal'; block?: boolean; icon?: ComponentChildren; disabled?: boolean;
  onClick?: () => void; label?: string; tone?: 'accent' | 'danger';
}) {
  return (
    <button class={cx('btn', `btn-${kind}`, block && 'block', tone && `btn-${tone}`, 'rp')} disabled={disabled} onClick={onClick} aria-label={label}>
      {icon}{children}
    </button>
  );
}

export function IconButton({ label, onClick, children }: Kids & { label: string; onClick: () => void }) {
  return <button class="icon-btn rp" aria-label={label} onClick={onClick}>{children}</button>;
}

/* ---------- Inputs ---------- */

export interface ChipOpt { id: string; label: string; disabled?: boolean; hint?: string }

/** Single-select filter chips. 40 dp visible (32 dp when small), always a 48 dp touch target. */
export function Chips({ options, value, onChange, label, small }: { options: ChipOpt[]; value: string; onChange: (id: string) => void; label: string; small?: boolean }) {
  return (
    <div class={cx('chips', small && 'chips-s')} role="radiogroup" aria-label={label}>
      {options.map(o => (
        <button key={o.id} role="radio" aria-checked={o.id === value} disabled={o.disabled} class="chip-hit" onClick={() => onChange(o.id)}>
          <span class={cx('chip', 'rp', o.id === value && 'chip-on')}>
            {o.label}{o.hint && <span class="chip-hint">{o.hint}</span>}
          </span>
        </button>
      ))}
    </div>
  );
}

export function Segmented({ options, value, onChange, label }: { options: ChipOpt[]; value: string; onChange: (id: string) => void; label: string }) {
  return (
    <div class="segmented" role="radiogroup" aria-label={label}>
      {options.map(o => (
        <button key={o.id} role="radio" aria-checked={o.id === value} disabled={o.disabled} class={cx('rp', o.id === value && 'seg-on')} onClick={() => onChange(o.id)}>{o.label}</button>
      ))}
    </div>
  );
}

export function Stepper({ value, unit, label, onDec, onInc, decDisabled, incDisabled }: {
  value: string; unit?: string; label: string; onDec: () => void; onInc: () => void; decDisabled?: boolean; incDisabled?: boolean;
}) {
  return (
    <div class="stepper" role="group" aria-label={label}>
      <button class="step-btn rp" aria-label={`Less ${label.toLowerCase()}`} disabled={decDisabled} onClick={onDec}><Minus /></button>
      <span class="num step-val"><span class="t-value">{value}</span>{unit && <span class="t-bodyM tone-secondary"> {unit}</span>}</span>
      <button class="step-btn rp" aria-label={`More ${label.toLowerCase()}`} disabled={incDisabled} onClick={onInc}><Plus /></button>
    </div>
  );
}

export function Field({ label, note, children }: Kids & { label: string; note?: ComponentChildren }) {
  return (
    <div class="stack gap-8">
      <Text v="label" tone="secondary">{label}</Text>
      {children}
      {note && <span class="t-caption tone-secondary lh">{note}</span>}
    </div>
  );
}

export function SearchField({ value, onInput, placeholder }: { value: string; onInput: (v: string) => void; placeholder: string }) {
  return (
    <label class="search">
      <Search color="var(--text-2)" />
      <input type="search" placeholder={placeholder} aria-label={placeholder} value={value} onInput={e => onInput(e.currentTarget.value)} />
    </label>
  );
}

/** Outlined dropdown field (Smoker temp). */
export function SelectField({ label, value, trailing, open, onClick, fieldRef }: {
  label: string; value: ComponentChildren; trailing?: ComponentChildren; open?: boolean; onClick: () => void;
  fieldRef?: preact.Ref<HTMLButtonElement>;
}) {
  return (
    <button ref={fieldRef} class={cx('select', 'rp', open && 'select-open')} aria-haspopup="listbox" aria-expanded={!!open} onClick={onClick}>
      <span class="stack gap-2 fill">
        <span class={cx('t-caption', open ? 'tone-accent' : 'tone-secondary')}>{label}</span>
        <span class="t-select">{value}</span>
      </span>
      {trailing}
    </button>
  );
}

/* ---------- Lists and menus ---------- */

export const GroupLabel = ({ children }: Kids) => <h3 class="group-label">{children}</h3>;

export function ListRow({ leading, title, subtitle, onClick, trailing }: {
  leading?: ComponentChildren; title: ComponentChildren; subtitle?: ComponentChildren; onClick: () => void; trailing?: ComponentChildren;
}) {
  return (
    <button class="list-row rp" onClick={onClick}>
      {leading}
      <span class="fill stack gap-2">
        <span class="t-bodyL">{title}</span>
        {subtitle && <span class="t-label tone-secondary clamp">{subtitle}</span>}
      </span>
      {trailing ?? <ChevronRight color="var(--text-2)" />}
    </button>
  );
}

export function MenuRow({ selected, label, trailing, onClick, check }: {
  selected?: boolean; label: ComponentChildren; trailing?: ComponentChildren; onClick: () => void; check?: ComponentChildren;
}) {
  return (
    <button role="option" aria-selected={!!selected} class={cx('menu-row', 'rp', selected && 'menu-row-on')} onClick={onClick}>
      <span class="menu-check">{selected && check}</span>
      <span class="fill t-bodyL">{label}</span>
      {trailing && <span class="fixed fixed-end t-label tone-secondary">{trailing}</span>}
    </button>
  );
}

/* ---------- Overlays ---------- */

interface SheetCtl { close: (after?: () => void) => void }
const SheetCtx = createContext<SheetCtl>({ close: f => f?.() });
/** Inside a Sheet: close with the slide-down animation, then run `after`. */
export const useSheet = () => useContext(SheetCtx);

const SHEET_OUT_MS = 200;

/** Modal bottom sheet: scrim, drag handle, title, close. Slides up; body scrolls above a pinned footer. */
export function Sheet({ title, onClose, footer, flush, children }: Kids & { title: string; onClose: () => void; footer?: ComponentChildren; flush?: boolean }) {
  const [closing, setClosing] = useState(false);
  const after = useRef<(() => void) | undefined>(undefined);
  const close = useCallback((fn?: () => void) => {
    after.current = fn;
    setClosing(true);
  }, []);
  useEffect(() => {
    if (!closing) return;
    const t = setTimeout(() => { onClose(); after.current?.(); }, SHEET_OUT_MS);
    return () => clearTimeout(t);
  }, [closing]);
  const back = useCallback(() => close(), [close]);
  useBack(back);

  return (
    <SheetCtx.Provider value={{ close }}>
      <div class={cx('scrim', closing && 'scrim-out')} onClick={e => { if (e.target === e.currentTarget) close(); }}>
        <section class={cx('sheet', closing && 'sheet-out')} role="dialog" aria-modal="true" aria-label={title}>
          <div class="sheet-handle"><span /></div>
          <header class="sheet-head">
            <h2 class="t-sheetTitle">{title}</h2>
            <IconButton label="Close" onClick={() => close()}><Close /></IconButton>
          </header>
          <div class={cx('sheet-body', flush && 'flush')}>{children}</div>
          {footer && <div class="sheet-foot">{footer}</div>}
        </section>
      </div>
    </SheetCtx.Provider>
  );
}

/** Dropdown menu anchored under a field, over a light scrim. */
export function Menu({ anchor, onClose, intro, footer, children, field }: Kids & {
  anchor: DOMRect; onClose: () => void; intro?: ComponentChildren; footer?: ComponentChildren; field: ComponentChildren;
}) {
  useBack(onClose);
  const px = (n: number) => `${n}px`;
  return (
    <div class="scrim scrim-menu" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div class="menu-anchor" style={{ top: px(anchor.top), left: px(anchor.left), width: px(anchor.width) }}>{field}</div>
      <div class="menu" role="listbox" style={{ top: px(anchor.bottom + 8), left: px(anchor.left), width: px(anchor.width),
        maxHeight: `calc(100dvh - ${anchor.bottom + 24}px - env(safe-area-inset-bottom))` }}>
        {intro && <div class="menu-intro t-caption tone-secondary">{intro}</div>}
        <div class="menu-list">{children}</div>
        {footer && <div class="menu-foot">{footer}</div>}
      </div>
    </div>
  );
}

export type { JSX };
