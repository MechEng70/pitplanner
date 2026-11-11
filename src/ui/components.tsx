// Shared components, built from the mockup artboards (docs/mockups/source/*.dc.html).
// Screens compose these; they do not add their own CSS.
//
// Font scale rule: times, temps, weights and countdowns are <Num> units that never wrap,
// shrink or ellipsize. Only secondary text (subtitles, notes) may ellipsize.

import { createPortal } from 'preact/compat';
import type { ComponentChildren, JSX } from 'preact';
import { createContext } from 'preact';
import { useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { Check, ChevronRight, Close, CookerAvatarIcon, Minus, Plus, Search } from './icons.tsx';
import { useBack } from './back.ts';

type Kids = { children?: ComponentChildren };
const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

/* ---------- Text ---------- */

export type TextVariant = 'when' | 'result' | 'countdown' | 'nextTitle' | 'headline' | 'title' | 'sheetTitle' | 'section' | 'bodyL' | 'bodyM' | 'body' | 'label' | 'caption' | 'overline' | 'value' | 'display';
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

export function AppBar({ title, subtitle, overline, actions }: { title: string; subtitle?: ComponentChildren; overline?: string; actions?: ComponentChildren }) {
  const sub = subtitle != null || overline != null;
  return (
    <header class={cx('appbar', sub && 'appbar-sub')}>
      {sub
        ? <div class="fill stack gap-2">
            {overline && <span class="t-overline tone-accentHi">{overline}</span>}
            <h1 class="t-title">{title}</h1>
            {subtitle != null && <span class="t-bodyM tone-secondary">{subtitle}</span>}
          </div>
        : <h1 class="t-title">{title}</h1>}
      {actions && <div class="row gap-0">{actions}</div>}
    </header>
  );
}

/** App bar, a scrolling body with 16 dp sides, and an optional footer pinned above the nav. */
export function Screen({ title, subtitle, overline, actions, footer, children }: Kids & {
  title: string; subtitle?: ComponentChildren; overline?: string; actions?: ComponentChildren; footer?: ComponentChildren;
}) {
  return (
    <div class="screen">
      <AppBar title={title} subtitle={subtitle} overline={overline} actions={actions} />
      <ScrollWithFooter bodyClass="screen-body" footClass="screen-foot" footer={footer}>{children}</ScrollWithFooter>
    </div>
  );
}

/**
 * Shared rule for every pinned action bar (screens and sheets): the bar floats over the bottom of
 * the scroll area with a fade, and the scroll area gets bottom padding and scroll padding equal to
 * the bar's measured height, so no content can end up hidden behind it at any font size.
 */
function ScrollWithFooter({ bodyClass, footClass, footer, children }: Kids & { bodyClass: string; footClass: string; footer?: ComponentChildren }) {
  const wrap = useRef<HTMLDivElement>(null);
  const foot = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const f = foot.current, w = wrap.current;
    if (!f || !w) { w?.style.setProperty('--foot-h', '0px'); return; }
    const set = () => w.style.setProperty('--foot-h', `${f.offsetHeight}px`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(f);
    return () => ro.disconnect();
  }, [!!footer]);
  return (
    <div class="scroll-wrap" ref={wrap}>
      <div class={cx(bodyClass, 'scroll-body')}>{children}</div>
      {footer && <div class={cx(footClass, 'float-foot')} ref={foot}>{footer}</div>}
    </div>
  );
}

/**
 * Keeps its content fully on screen: after any change in `deps`, scrolls the nearest scroll area
 * just enough to show it (above any pinned action bar, via scroll-padding).
 */
export function KeepVisible({ deps, children }: Kids & { deps: unknown[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, deps);
  return <div ref={ref}>{children}</div>;
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

/** Card of rows separated by hairlines (Setup alerts, Gear lists). */
export function GroupCard({ children }: Kids) {
  return <div class="group-card">{children}</div>;
}

/** Row with title, secondary line, and a trailing status or action (mockup 03). */
export function StatusRow({ title, subtitle, ok, okLabel = 'On', action }: {
  title: string; subtitle?: string; ok: boolean; okLabel?: string; action?: ComponentChildren;
}) {
  return (
    <div class="status-row">
      <span class="fill stack gap-2">
        <span class="t-bodyL w-500">{title}</span>
        {subtitle && <span class="t-label tone-secondary lh">{subtitle}</span>}
      </span>
      {ok ? <span class="status-ok"><Check size={18} color="var(--ok)" />{okLabel}</span> : action}
    </div>
  );
}

export function StatusChip({ tone, children }: Kids & { tone: 'ok' | 'warn' | 'error' }) {
  return <span class={cx('status-chip', `status-${tone}`)}><span class="status-dot" />{children}</span>;
}

/** Full-width warning strip with an optional action (alerts off, pit out). */
export function Banner({ tone = 'error', children, action }: Kids & { tone?: 'error' | 'warn'; action?: ComponentChildren }) {
  return <div class={cx('banner', `banner-${tone}`)} role="alert"><span class="fill t-body">{children}</span>{action}</div>;
}

/** Icon + title + secondary line, whole row tappable (Cook options). */
export function ActionRow({ icon, title, subtitle, onClick, tone }: {
  icon: ComponentChildren; title: string; subtitle?: string; onClick: () => void; tone?: 'danger';
}) {
  return (
    <button class={cx('action-row', 'rp', tone === 'danger' && 'action-danger')} onClick={onClick}>
      <span class="action-icon">{icon}</span>
      <span class="fill stack gap-2">
        <span class="t-bodyL">{title}</span>
        {subtitle && <span class="t-label tone-secondary lh">{subtitle}</span>}
      </span>
    </button>
  );
}

/** Read-only row in a GroupCard: title, a trailing status, a secondary line (Cook finished). */
export function InfoRow({ title, trailing, subtitle, tone }: { title: ComponentChildren; trailing?: ComponentChildren; subtitle?: ComponentChildren; tone?: Tone }) {
  return (
    <div class="info-row">
      <div class="row gap-12 info-top"><span class="fill t-bodyL w-500">{title}</span>{trailing && <span class={cx('t-body w-500 num', tone && `tone-${tone}`)}>{trailing}</span>}</div>
      {subtitle && <span class="t-body tone-secondary">{subtitle}</span>}
    </div>
  );
}

export const Divider = () => <div class="divider" role="separator" />;

export interface Choice { id: string; title: ComponentChildren; subtitle?: ComponentChildren }
/** Two or more large outlined options, one selected (Keep serve / Move serve). */
export function ChoiceCards({ options, value, onChange, label }: { options: Choice[]; value: string; onChange: (id: string) => void; label: string }) {
  return (
    <div class="choice-cards" role="radiogroup" aria-label={label}>
      {options.map(o => (
        <button key={o.id} role="radio" aria-checked={o.id === value} class={cx('choice', 'rp', o.id === value && 'choice-on')} onClick={() => onChange(o.id)}>
          <span class="t-bodyM">{o.title}</span>
          {o.subtitle && <span class="t-label tone-secondary">{o.subtitle}</span>}
        </button>
      ))}
    </div>
  );
}

/** Note keyed to the lane chart's highlight band: swatch, bold lead, then the rest (mockup 12). */
export function BandNote({ lead, children }: Kids & { lead: ComponentChildren }) {
  return <div class="band-note"><span class="band-swatch" aria-hidden="true" /><span class="t-body"><b class="w-500">{lead}</b> {children}</span></div>;
}

export function TextArea({ value, onInput, placeholder, label }: { value: string; onInput: (v: string) => void; placeholder: string; label: string }) {
  return <textarea class="textarea" aria-label={label} placeholder={placeholder} value={value} rows={2} onInput={e => onInput(e.currentTarget.value)} />;
}

/* ---------- Lane chart ---------- */

export interface LaneSegment { start: number; end: number; label?: string; tone: 'smoke' | 'smoke2' | 'hot' | 'griddle' | 'oven' | 'hold' }
export interface Lane { id: string; title: string; subtitle: string; segments: LaneSegment[] }

/**
 * Horizontal timeline: one lane per food, segments positioned by time, a now line, and an optional
 * highlighted band (foods sharing the smoker). Times are epoch ms; the caller formats tick labels.
 */
export function Lanes({ lanes, from, to, now, band, ticks }: {
  lanes: Lane[]; from: number; to: number; now: number; band?: { start: number; end: number; laneIds: string[] } | null;
  ticks: { at: number; label: string }[];
}) {
  const pct = (t: number) => `${Math.max(0, Math.min(100, ((t - from) / (to - from)) * 100))}%`;
  const width = (a: number, b: number) => `${Math.max(0, ((Math.min(b, to) - Math.max(a, from)) / (to - from)) * 100)}%`;
  const bandRows = band ? lanes.map((l, i) => band.laneIds.includes(l.id) ? i : -1).filter(i => i >= 0) : [];
  return (
    <div class="lanes" style={{ "--lanes": String(lanes.length) }}>
      {lanes.map(l => (
        <div key={l.id} class="lane">
          <div class="lane-label"><span class="t-bodyM w-500 clamp">{l.title}</span><span class="t-label tone-secondary clamp">{l.subtitle}</span></div>
          <div class="lane-track">
            {l.segments.filter(s => s.end > from && s.start < to).map((s, i) => (
              <span key={i} class={cx('seg', `seg-${s.tone}`)} style={{ left: pct(s.start), width: width(s.start, s.end) }}>
                {s.label && (Math.min(s.end, to) - Math.max(s.start, from)) / (to - from) >= 0.1 && <span class="seg-label">{s.label}</span>}
              </span>
            ))}
          </div>
        </div>
      ))}
      <div class="lane-overlay" aria-hidden="true">
        {band && bandRows.length > 1 && (
          <span class="lane-band" style={{ left: pct(band.start), width: width(band.start, band.end),
            top: `calc(${bandRows[0]} * var(--lane-h) - 4px)`, height: `calc(${bandRows[bandRows.length - 1] - bandRows[0] + 1} * var(--lane-h) + 8px)` }} />
        )}
        {now >= from && now <= to && <span class="lane-now" style={{ left: pct(now) }} />}
      </div>
      <div class="lane-ticks">
        <span />
        <div class="lane-tick-row">
          {ticks.map(t => <span key={t.at} class="t-caption tone-secondary num lane-tick" style={{ left: pct(t.at) }}>{t.label}</span>)}
        </div>
      </div>
    </div>
  );
}

/* ---------- Buttons ---------- */

export function Button({ kind = 'primary', block, icon, disabled, onClick, children, label, tone }: Kids & {
  kind?: 'primary' | 'outline' | 'text' | 'tonal' | 'small'; block?: boolean; icon?: ComponentChildren; disabled?: boolean;
  onClick?: () => void; label?: string; tone?: 'accent' | 'danger';
}) {
  return (
    <button class={cx('btn', `btn-${kind}`, block && 'block', tone && `btn-${tone}`, 'rp')} disabled={disabled} onClick={onClick} aria-label={label}>
      {icon}{children}
    </button>
  );
}

/** Text button that opens an outside page (the system browser takes it). */
export function LinkButton({ href, children }: Kids & { href: string }) {
  return <a class="btn btn-text btn-link rp" href={href} target="_blank" rel="noopener">{children}</a>;
}

/** 48 dp round icon button. `bleed`: keeps the 48 dp target but takes no extra height in a tight row. */
export function IconButton({ label, onClick, bleed, children }: Kids & { label: string; onClick: () => void; bleed?: boolean }) {
  return <button class={cx('icon-btn', 'rp', bleed && 'icon-bleed')} aria-label={label} onClick={onClick}>{children}</button>;
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

  // Portal: a sheet opened from inside a scroll area must not inherit its stacking context (the
  // fade mask on footer-less screens would otherwise put the sheet under the bottom nav).
  return createPortal(
    <SheetCtx.Provider value={{ close }}>
      <div class={cx('scrim', closing && 'scrim-out')} onClick={e => { if (e.target === e.currentTarget) close(); }}>
        <section class={cx('sheet', closing && 'sheet-out')} role="dialog" aria-modal="true" aria-label={title}>
          <div class="sheet-handle"><span /></div>
          <header class="sheet-head">
            <h2 class="t-sheetTitle">{title}</h2>
            <IconButton label="Close" onClick={() => close()}><Close /></IconButton>
          </header>
          <ScrollWithFooter bodyClass={cx('sheet-body', flush && 'flush')} footClass="sheet-foot" footer={footer}>{children}</ScrollWithFooter>
        </section>
      </div>
    </SheetCtx.Provider>,
    document.body,
  );
}

/** Dropdown menu anchored under a field, over a light scrim. */
export function Menu({ anchor, onClose, intro, footer, children, field }: Kids & {
  anchor: DOMRect; onClose: () => void; intro?: ComponentChildren; footer?: ComponentChildren; field: ComponentChildren;
}) {
  useBack(onClose);
  const px = (n: number) => `${n}px`;
  return createPortal(
    <div class="scrim scrim-menu" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div class="menu-anchor" style={{ top: px(anchor.top), left: px(anchor.left), width: px(anchor.width) }}>{field}</div>
      <div class="menu" role="listbox" style={{ top: px(anchor.bottom + 8), left: px(anchor.left), width: px(anchor.width),
        maxHeight: `calc(100dvh - ${anchor.bottom + 24}px - env(safe-area-inset-bottom))` }}>
        {intro && <div class="menu-intro t-caption tone-secondary">{intro}</div>}
        <div class="menu-list">{children}</div>
        {footer && <div class="menu-foot">{footer}</div>}
      </div>
    </div>
  , document.body);
}

export type { JSX };
