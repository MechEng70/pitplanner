// Smoker temp menu (mockup 06). A port of legacy/src/screens/plan/TempMenu.tsx. It offers only temps the
// cooker can be set to (SPEC failure mode 12), 200-300F to start with, and each row says what that temp does
// to the plan: the fire time (Ready by) or the serve time (Start at).
import { useMemo, useState } from 'react';
import { buildPlan, onHeatSpan } from '../../../engine/plan';
import { settableTemps } from '../../../engine/temps';
import type { Plan, PlanInput, SmokerProfile } from '../../../engine/types';
import { type Anchor, Button, Check, ChevronUp, Inset, Menu, MenuRow, Num, SelectField, Text } from '@/components/kit';
import { fmtTemp, fmtTempRange, fmtTime, fmtWeight, type Units } from '@/lib/format';
import { countText, food, rules } from '@/lib/rules';
import { colors } from '@/theme/tokens';

/** The selected temp opens as the third row, as in the mockup. */
const ROWS_ABOVE = 2;

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
  anchor: Anchor;
  units: Units;
  onPick: (tempF: number) => void;
  onClose: () => void;
}) {
  const trusted: [number, number] = rules.tempModel.trustedRangeF;
  const [all, setAll] = useState(() => input.pitTempF < trusted[0] || input.pitTempF > trusted[1]);
  const rows = useMemo(
    () =>
      settableTemps(smoker, all ? undefined : trusted).map(t => {
        if (input.items.length === 0) return { t, at: null };
        try {
          const p = buildPlan(rules, { ...input, pitTempF: t });
          return { t, at: input.mode === 'readyBy' ? (p.fireAt ?? p.griddleOnAt ?? null) : p.serveAt };
        } catch {
          return { t, at: null };
        }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `trusted` is a constant from the rules file.
    [smoker, all, input],
  );
  const full = settableTemps(smoker);
  const selected = rows.findIndex(r => r.t === input.pitTempF);

  const step = smoker.tempStepF;
  // A step is a temperature difference, so Celsius is step * 5/9 with no offset.
  const stepText = step ? (units.temp === 'F' ? `${step}F` : `${+((step * 5) / 9).toFixed(1)}C`) : null;

  return (
    <Menu
      anchor={anchor}
      onClose={onClose}
      startRow={Math.max(0, selected - ROWS_ABOVE)}
      rowCount={rows.length}
      field={
        <SelectField
          open
          label="Smoker temp"
          value={<Num>{fmtTemp(input.pitTempF, units, true)}</Num>}
          trailing={<ChevronUp size={20} color={colors.accent} />}
          onPress={onClose}
        />
      }
      intro={
        <Text>
          {`${smoker.name} ${stepText ? 'sets in ' : 'has fixed settings'}`}
          {stepText ? <Num>{stepText}</Num> : null}
          {`${stepText ? ' steps' : ''}.${timesFor(plan, units)}`}
        </Text>
      }
      footer={
        all ? (
          <Inset>
            <Text variant="caption" tone="warn">
              Times outside <Num>{fmtTempRange(trusted, units)}</Num> are a rough guess.
            </Text>
          </Inset>
        ) : full.length > rows.length ? (
          <Button kind="text" block onPress={() => setAll(true)}>
            <Text>
              Show <Num>{fmtTempRange([full[0]!, full[full.length - 1]!], units)}</Num>
            </Text>
          </Button>
        ) : null
      }
    >
      {rows.map(({ t, at }) => {
        const rough = t < trusted[0] || t > trusted[1];
        return (
          <MenuRow
            key={t}
            selected={t === input.pitTempF}
            check={<Check size={18} color={colors.accent} />}
            onPress={() => onPick(t)}
            label={<Num>{fmtTemp(t, units, true)}</Num>}
            trailing={
              at != null ? (
                <Text tone={rough ? 'warn' : undefined}>
                  <Num>
                    {input.mode === 'readyBy' ? 'fire' : 'ready'} {fmtTime(at)}
                  </Num>
                  {rough ? ' (rough)' : ''}
                </Text>
              ) : null
            }
          />
        );
      })}
    </Menu>
  );
}

/** " Times for 12 lb brisket." The item that starts first sets the fire time. */
function timesFor(plan: Plan | null, units: Units): string {
  const first = plan ? [...plan.items].sort((a, b) => onHeatSpan(a).start - onHeatSpan(b).start)[0] : undefined;
  if (!first) return '';
  const f = food(first.input.foodId);
  const qty =
    f.quantity.kind === 'weight' ? fmtWeight(first.input.quantity, units) : countText(f, first.input.quantity);
  return ` Times for ${qty} ${f.name.toLowerCase()}.`;
}
