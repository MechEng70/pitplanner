import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { buildPlan } from '../../../engine/plan.ts';
import { settableTemps } from '../../../engine/temps.ts';
import type { PlanInput, SmokerProfile } from '../../../engine/types.ts';
import { Check, ChevronUp } from '../../components/icons.tsx';
import { useBack } from '../../components/back.ts';
import { rules } from '../../lib/rules.ts';
import { fmtTemp, fmtTime, type Units } from '../../lib/format.ts';

/**
 * Smoker temp dropdown. Offers only temps the cooker can be set to, 200-300F by default.
 * Each row shows what that temp does to the plan: fire time (ready-by) or serve time (start-at).
 */
export function TempMenu({ smoker, input, anchor, units, onPick, onClose }: {
  smoker: SmokerProfile; input: PlanInput; anchor: DOMRect; units: Units;
  onPick: (tempF: number) => void; onClose: () => void;
}) {
  useBack(onClose);
  const trusted: [number, number] = rules.tempModel.trustedRangeF;
  const [all, setAll] = useState(() => input.pitTempF < trusted[0] || input.pitTempF > trusted[1]);
  const temps = settableTemps(smoker, all ? undefined : trusted);
  const fullRange = settableTemps(smoker);
  const canExpand = fullRange.length > temps.length;

  const rows = useMemo(() => temps.map(t => {
    if (!input.items.length) return { t, when: '' };
    try {
      const p = buildPlan(rules, { ...input, pitTempF: t });
      const at = input.mode === 'readyBy' ? (p.fireAt ?? p.griddleOnAt) : p.serveAt;
      return { t, when: at == null ? '' : `${input.mode === 'readyBy' ? 'fire' : 'ready'} ${fmtTime(at)}` };
    } catch { return { t, when: '' }; }
  }), [temps.join(), input]);

  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => { listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'center' }); }, [all]);

  const step = smoker.tempStepF;
  // A step is a temperature difference, so Celsius is step * 5/9 with no offset.
  const stepText = step && (units.temp === 'F' ? `${step}F` : `${+(step * 5 / 9).toFixed(1)}C`);
  const intro = `${smoker.name} ${stepText ? `sets in ${stepText} steps` : 'has fixed settings'}.`;

  return (
    <div class="scrim scrim-light" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div class="temp-field temp-field-open" style={px({ top: anchor.top, left: anchor.left, width: anchor.width, height: anchor.height })}
        onClick={onClose} role="button" aria-expanded="true" aria-label="Close smoker temp menu">
        <span class="tf-text"><span class="tf-label accent">Smoker temp</span><span class="tf-value">{fmtTemp(input.pitTempF, units, true)}</span></span>
        <ChevronUp color="var(--accent)" />
      </div>
      <div class="menu" style={{ ...px({ top: anchor.bottom + 8, left: anchor.left, width: anchor.width }), maxHeight: `calc(100dvh - ${anchor.bottom + 24}px - env(safe-area-inset-bottom))` }}>
        <p class="menu-intro">{intro}{input.items.length ? ' Times for this menu.' : ''}</p>
        <div class="menu-list" role="listbox" aria-label="Smoker temp" ref={listRef}>
          {rows.map(({ t, when }) => {
            const sel = t === input.pitTempF;
            const rough = t < trusted[0] || t > trusted[1];
            return (
              <button key={t} role="option" aria-selected={sel} class={`menu-row ${sel ? 'menu-row-on' : ''}`} onClick={() => onPick(t)}>
                <span class="mr-check">{sel && <Check size={20} color="var(--accent)" />}</span>
                <span class="mr-temp">{fmtTemp(t, units, true)}</span>
                <span class="mr-when">{rough ? <span class="warn-text">rough guess</span> : null}{when && <span>{when}</span>}</span>
              </button>
            );
          })}
        </div>
        {canExpand && !all && (
          <button class="menu-more" onClick={() => setAll(true)}>
            Show {fmtTemp(fullRange[0], units, true).slice(0, -1)}-{fmtTemp(fullRange[fullRange.length - 1], units, true)}
          </button>
        )}
        {all && (
          <p class="menu-foot">Times outside {fmtTemp(trusted[0], units).slice(0, -1)}-{fmtTemp(trusted[1], units)} are a rough guess.</p>
        )}
      </div>
    </div>
  );
}

/** Preact 11 no longer appends px to numeric styles. */
const px = (o: Record<string, number>) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, `${v}px`]));
