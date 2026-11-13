// Plan tab: Empty (mockup 04) and Plan (05). A port of legacy/src/screens/plan/PlanScreen.tsx.
// What opens from here comes with its own task and arrives as a handler: the temp menu, Add food and the
// Issues sheet (T-018), food details (T-019), Start cook (T-021), Cook a past plan again (T-028), share
// (T-029). Until then the route leaves them out and those controls do nothing.
//
// T-017 requirements kept here: the smoker temp is one field that opens the menu, never preset buttons
// (PR-1); every card has its cooker avatar (PR-2); a value that changes never moves a control: numbers are
// Num (tabular digits, one line), nothing appears above a control, nothing scrolls by itself (PR-3); the
// three tiles share the row in equal parts (PR-4).
import { useMemo } from 'react';
import { Pressable } from 'react-native';
import { buildPlan, onHeatSpan } from '../../../engine/plan';
import type { ItemInput, Plan, SmokerProfile } from '../../../engine/types';
import {
  Avatar,
  Button,
  Calendar,
  Card,
  ChevronDown,
  Chips,
  type CookerKind,
  Fill,
  Fixed,
  IconButton,
  Num,
  Plus,
  Row,
  Screen,
  SelectField,
  ShareIcon,
  Stack,
  Text,
  Tile,
  Tiles,
} from '@/components/kit';
import { fmtDay, fmtDuration, fmtPellets, fmtTemp, fmtTime, fmtWeight, tx, type Units } from '@/lib/format';
import { countText, food, itemSummary, method, rules } from '@/lib/rules';
import { planInput, useStore } from '@/lib/store';
import type { PickDateTime } from '@/platform/types';
import { colors } from '@/theme/tokens';
import { PlanEmpty } from './PlanEmpty';

export interface PlanScreenProps {
  pickDateTime: PickDateTime;
  onAddFood?: () => void;
  onEditItem?: (id: string) => void;
  onOpenTemp?: () => void;
  onOpenIssues?: () => void;
  onStartCook?: (plan: Plan) => void;
  onShare?: (plan: Plan) => void;
  onCookAgain?: () => void;
}

/** Under the name of a saved item whose food or method this version does not have. */
export const UNKNOWN_ITEM = 'Not in this version of Pit Planner';

const MODES = [
  { id: 'readyBy', label: 'Ready by' },
  { id: 'startAt', label: 'Start at' },
];

/**
 * First thing the cook has to do: fire the smoker, fire the griddle, or start an oven phase. Null when the
 * plan has none (a smoker food with no smoker: the plan only carries the warning).
 */
function firstAction(plan: Plan): number | null {
  const oven = plan.items.flatMap(it => it.phases.filter(p => p.cooker === 'oven').map(p => p.start));
  const starts = [plan.fireAt, plan.griddleOnAt, ...oven].filter((x): x is number => x != null);
  return starts.length > 0 ? Math.min(...starts) : null;
}

/** What a card shows for an item. `known` is false for a food or method this version's rules do not have. */
interface CardInfo {
  known: boolean;
  name: string;
  summary: string;
  cooker: CookerKind;
  perWeight: boolean;
}

interface SummaryTile {
  label: string;
  value: string;
  tone?: 'warn';
  /** More fuel than the hopper holds: the tile opens the Issues sheet, which explains the refill. */
  over?: boolean;
}

/** Two tiles before Conflicts: the first action, then fuel or smoker-off, padded with the serve time. */
export function summaryTiles(plan: Plan, smoker: SmokerProfile | undefined, units: Units): SummaryTile[] {
  const out: SummaryTile[] = [];
  if (plan.fireAt != null) out.push({ label: 'Fire smoker', value: fmtTime(plan.fireAt) });
  else if (plan.griddleOnAt != null) out.push({ label: 'Fire griddle', value: fmtTime(plan.griddleOnAt) });
  if (smoker?.hopperLb && plan.fireAt != null) {
    const over = plan.pelletsLb > smoker.hopperLb;
    out.push({
      label: smoker.type === 'gravity' ? 'Charcoal' : 'Pellets',
      value: fmtPellets(plan.pelletsLb, units),
      tone: over ? 'warn' : undefined,
      over,
    });
  } else if (plan.pitOffAt != null) out.push({ label: 'Smoker off', value: fmtTime(plan.pitOffAt) });
  if (out.length < 2) out.push({ label: 'Serve', value: fmtTime(plan.serveAt) });
  return out;
}

export function PlanScreen({
  pickDateTime,
  onAddFood,
  onEditItem,
  onOpenTemp,
  onOpenIssues,
  onStartCook,
  onShare,
  onCookAgain,
}: PlanScreenProps) {
  const { state, setDraft } = useStore();
  const { draft, gear, units } = state;
  const empty = draft.items.length === 0;

  const built = useMemo((): { plan: Plan | null; error: string | null } => {
    if (state.draft.items.length === 0) return { plan: null, error: null };
    try {
      return { plan: buildPlan(rules, planInput(state)), error: null };
    } catch (e) {
      return { plan: null, error: String(e) };
    }
  }, [state]);
  const plan = built.plan;

  const setMode = (mode: string) => {
    if (mode === draft.mode || (mode !== 'readyBy' && mode !== 'startAt')) return;
    // Keep the same schedule when flipping: start-at takes the first action, ready-by the serve time.
    const at = (plan ? (mode === 'startAt' ? firstAction(plan) : plan.serveAt) : null) ?? draft.at;
    setDraft(d => ({ ...d, mode, at }));
  };
  const pickDate = async () => {
    const at = await pickDateTime(draft.at);
    if (at != null) setDraft(d => ({ ...d, at }));
  };
  const cardInfo = (it: ItemInput): CardInfo => {
    try {
      const f = food(it.foodId);
      const m = method(it.foodId, it.methodId);
      const qty = f.quantity.kind === 'weight' ? fmtWeight(it.quantity, units) : countText(f, it.quantity);
      return {
        known: true,
        name: f.name,
        summary: tx(itemSummary(it, qty), units),
        cooker: m.cooker,
        perWeight: m.timing.kind === 'perWeight',
      };
    } catch {
      // A saved item the rules do not know (a plan saved by another version). The card must still draw, so
      // the item can be opened and removed; the plan itself cannot be built and says so below the list.
      return { known: false, name: it.foodId, summary: UNKNOWN_ITEM, cooker: 'smoker', perWeight: false };
    }
  };
  const warnCount = plan?.warnings.filter(w => w.level === 'warn').length ?? 0;

  const when = (
    <Card pad="l" col>
      <Stack gap={empty ? 8 : 4}>
        <Row justify="between">
          <Chips label="Plan from" small={!empty} value={draft.mode} onChange={setMode} options={MODES} />
          {empty ? null : (
            <IconButton bleed label="Pick date and time" onPress={() => void pickDate()}>
              <Calendar color={colors.text2} />
            </IconButton>
          )}
        </Row>
        {/* 48 dp to the finger, a text line in the layout. Day and time are separate numbers: at big font
            sizes the line breaks between them, never inside one. */}
        <Pressable
          role="button"
          aria-label="Change date and time"
          onPress={() => void pickDate()}
          className="-my-2 min-h-[48px] justify-center rounded-small"
        >
          <Text variant="when">
            <Num>{fmtDay(draft.at)}</Num> at <Num>{fmtTime(draft.at)}</Num>
          </Text>
        </Pressable>
      </Stack>
    </Card>
  );

  if (empty)
    return (
      <Screen title="Plan">
        {when}
        <PlanEmpty
          draftLost={state.draftLost}
          hasHistory={state.history.length > 0}
          onAddFood={() => onAddFood?.()}
          onCookAgain={() => onCookAgain?.()}
        />
      </Screen>
    );

  return (
    <Screen
      title="Plan"
      actions={
        plan ? (
          <IconButton label="Share plan" onPress={() => onShare?.(plan)}>
            <ShareIcon />
          </IconButton>
        ) : null
      }
      footer={
        <Button block disabled={!plan} onPress={() => plan && onStartCook?.(plan)}>
          <Text>Start cook</Text>
        </Button>
      }
    >
      {when}

      {gear.smoker ? (
        <SelectField
          label="Smoker temp"
          value={<Num>{fmtTemp(draft.pitTempF, units, true)}</Num>}
          onPress={() => onOpenTemp?.()}
          trailing={
            <Row gap={10}>
              {plan?.fireAt != null ? (
                <Num variant="label" tone="secondary">
                  Fire {fmtTime(plan.fireAt)}
                </Num>
              ) : null}
              <ChevronDown size={20} color={colors.text1} />
            </Row>
          }
        />
      ) : null}

      <Row justify="between" align="baseline">
        <Text variant="section" role="heading">
          On the menu
        </Text>
        <Num variant="label" tone="secondary">
          {draft.items.length} {draft.items.length === 1 ? 'item' : 'items'}
        </Num>
      </Row>

      {draft.items.map(it => {
        const planned = plan?.items.find(x => x.input.id === it.id);
        const span = planned ? onHeatSpan(planned) : null;
        const info = cardInfo(it);
        return (
          <Card key={it.id} onPress={() => onEditItem?.(it.id)} label={`${info.name}, edit`}>
            <Avatar kind={info.cooker} />
            <Fill>
              <Stack gap={2}>
                <Text variant="bodyL" weight="500">
                  {info.name}
                </Text>
                <Text variant="label" tone={info.known ? 'secondary' : 'warn'} clamp>
                  {info.summary}
                </Text>
              </Stack>
            </Fill>
            {span ? (
              <Fixed>
                <Num variant="body" weight="500">
                  {fmtTime(span.start)}
                </Num>
                <Num variant="caption" tone="secondary">
                  {fmtDuration(span.minutes)}
                  {info.perWeight ? ' on heat' : ''}
                </Num>
              </Fixed>
            ) : null}
          </Card>
        );
      })}

      <Button kind="outline" tone="accent" block onPress={() => onAddFood?.()}>
        <Plus size={18} />
        <Text>Add food</Text>
      </Button>

      {built.error ? (
        <Text variant="label" tone="error">
          Could not build the plan: {built.error}
        </Text>
      ) : null}

      {plan ? (
        <Tiles equal>
          {summaryTiles(plan, gear.smoker, units).map(({ over, ...t }) => (
            <Tile key={t.label} {...t} onPress={over ? () => onOpenIssues?.() : undefined} />
          ))}
          <Tile
            label="Conflicts"
            value={warnCount ? String(warnCount) : 'None'}
            tone={warnCount ? 'warn' : 'ok'}
            onPress={() => onOpenIssues?.()}
          />
        </Tiles>
      ) : null}
    </Screen>
  );
}
