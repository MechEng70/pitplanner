import { useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { buildPlan, onHeatSpan } from '../../../engine/plan.ts';
import { settableTemps } from '../../../engine/temps.ts';
import type { Plan, PlanInput, SmokerProfile } from '../../../engine/types.ts';
import { Button, Menu, MenuRow, Num, SelectField, Text } from '../../ui/components.tsx';
import { Check, ChevronUp } from '../../ui/icons.tsx';
import { rules, food, countText } from '../../lib/rules.ts';
import { fmtTemp, fmtTime, fmtWeight, type Units } from '../../lib/format.ts';

/**
 * Smoker temp dropdown (mockup 06). Offers only temps the cooker can be set to, 200-300F by default.
 * Each row shows what that temp does to the plan: fire time (ready-by) or serve time (start-at).
 */
export function TempMenu({
  smoker,
  input,
  plan,
  anchor,
  units,
  onPick,
  onClose,
}: {
  smoker: SmokerProfile;
  input: PlanInput;
  plan: Plan | null;
  anchor: DOMRect;
  units: Units;
  onPick: (tempF: number) => void;
  onClose: () => void;
}) {
  const trusted: [number, number] = rules.tempModel.trustedRangeF;
  const [all, setAll] = useState(() => input.pitTempF < trusted[0] || input.pitTempF > trusted[1]);
  const temps = settableTemps(smoker, all ? undefined : trusted);
  const fullRange = settableTemps(smoker);

  const rows = useMemo(
    () =>
      temps.map(t => {
        if (!input.items.length) return { t, at: null };
        try {
          const p = buildPlan(rules, { ...input, pitTempF: t });
          return { t, at: input.mode === 'readyBy' ? (p.fireAt ?? p.griddleOnAt) : p.serveAt };
        } catch {
          return { t, at: null };
        }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- temps is rebuilt each render; its joined values are the real key.
    [temps.join(), input],
  );

  // Open with the current temp as the third row, like the mockup.
  const listRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const list = listRef.current?.parentElement;
    const sel = listRef.current?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (list && sel) list.scrollTop = Math.max(0, sel.offsetTop - list.offsetTop - 2 * sel.offsetHeight);
  }, [all]);

  const step = smoker.tempStepF;
  // A step is a temperature difference, so Celsius is step * 5/9 with no offset.
  const stepText = step && (units.temp === 'F' ? `${step}F` : `${+((step * 5) / 9).toFixed(1)}C`);
  const intro = (
    <>
      {smoker.name}{' '}
      {stepText ? (
        <>
          sets in <Num>{stepText}</Num> steps
        </>
      ) : (
        'has fixed settings'
      )}
      .{timesFor(plan, units)}
    </>
  );

  const field = (
    <SelectField
      open
      label="Smoker temp"
      value={<Num>{fmtTemp(input.pitTempF, units, true)}</Num>}
      trailing={<ChevronUp color="var(--accent)" />}
      onClick={onClose}
    />
  );
  const range = (lo: number, hi: number) => `${fmtTemp(lo, units, true).slice(0, -1)}-${fmtTemp(hi, units, true)}`;

  return (
    <Menu
      anchor={anchor}
      onClose={onClose}
      field={field}
      intro={intro}
      footer={
        !all && fullRange.length > temps.length ? (
          <Button kind="text" block onClick={() => setAll(true)}>
            <span>
              Show <Num>{range(fullRange[0], fullRange[fullRange.length - 1])}</Num>
            </span>
          </Button>
        ) : all ? (
          <div class="menu-intro">
            <Text v="caption" tone="warn">
              Times outside <Num>{range(trusted[0], trusted[1])}</Num> are a rough guess.
            </Text>
          </div>
        ) : null
      }
    >
      <div ref={listRef}>
        {rows.map(({ t, at }) => {
          const rough = t < trusted[0] || t > trusted[1];
          return (
            <MenuRow
              key={t}
              selected={t === input.pitTempF}
              check={<Check size={18} color="var(--accent)" />}
              onClick={() => onPick(t)}
              label={<Num>{fmtTemp(t, units, true)}</Num>}
              trailing={
                at != null && (
                  <span class={rough ? 'tone-warn' : undefined}>
                    <Num>
                      {input.mode === 'readyBy' ? 'fire' : 'ready'} {fmtTime(at)}
                    </Num>
                    {rough && ' (rough)'}
                  </span>
                )
              }
            />
          );
        })}
      </div>
    </Menu>
  );
}

/** " Times for 12 lb brisket." The item that starts first sets the fire time. */
function timesFor(plan: Plan | null, units: Units): string {
  if (!plan?.items.length) return '';
  const first = [...plan.items].sort((a, b) => onHeatSpan(a).start - onHeatSpan(b).start)[0];
  const f = food(first.input.foodId);
  const qty =
    f.quantity.kind === 'weight' ? fmtWeight(first.input.quantity, units) : countText(f, first.input.quantity);
  return ` Times for ${qty} ${f.name.toLowerCase()}.`;
}
