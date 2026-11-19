// Gear tab (mockup 16; a port of legacy/src/screens/gear/GearScreen.tsx): cookers, cook rates, app settings,
// version. The Units row and the Home Assistant row without a chevron are the 0.2.0 screen's (Jason approved
// both). A cooker's sheet (`onCooker`, T-027) comes in as a prop the route does not pass yet; until then
// those rows do nothing. Cook rates opens Cook history (`onHistory`, T-028; HistoryScreen.tsx).
// The "Update available" row shows what the last update check saved (`state.update`); the check is T-032.
// Export my data and Restore from a file (T-036; Jason, 2026-11-16, mockup 16): the data file
// (src/lib/dataFile.ts) through the share sheet, and back through the system file picker, a confirm sheet and
// the store's restore. Refusals, a failed share and the restored counts show in a sheet with OK
// (ImportNotice), as Plan shows "Couldn't share" and "This file is not a Pit Planner plan.".
import { useRef, useState } from 'react';
import type { Cookers } from '../../../engine/types';
import { lbToKg } from '../../../engine/units';
import {
  Avatar,
  Bell,
  Button,
  Cup,
  Download,
  Field,
  FootLine,
  GroupCard,
  HomeIcon,
  IconAvatar,
  ListRow,
  Num,
  Plus,
  Screen,
  Segmented,
  Sheet,
  Stack,
  Text,
  Thermo,
  Upload,
  useSheet,
} from '@/components/kit';
import { buildDataFile, dataFileName, MAX_CHARS, readDataFile, type DataCheck } from '@/lib/dataFile';
import { grantDebugPass } from '@/lib/debugPass';
import { errorText } from '@/lib/eventLog';
import { fmtMonthDay, fmtTemp, type Units } from '@/lib/format';
import { hasHopper, smokerTypeInfo } from '@/lib/gear';
import { rateRows, ratesSummary } from '@/lib/historyView';
import { confirmText, leftOutText, refusalText, restoredText, type Refusal } from '@/lib/restoreText';
import { rules } from '@/lib/rules';
import { useStore } from '@/lib/store';
import { availableUpdate, RELEASES_PAGE } from '@/lib/update';
import {
  allGranted,
  type AlarmService,
  type AlarmStatus,
  type AppLinks,
  type PermissionService,
  type PickTextFile,
  type ShareFile,
} from '@/platform/types';
import { AddCooker, type CookerKind } from '@/screens/shared/AddCooker';
import { AlertChecks, BatteryNote, TestAlertButton, useAlarmStatus } from '@/screens/shared/AlertChecks';
import { ImportNotice } from '@/screens/shared/ImportNotice';

export const SUPPORT_URL = 'https://buymeacoffee.com/PitPlanner';
/** Taps on the version that open the hidden test screen. */
export const DEBUG_TAPS = 5;
const KINDS: CookerKind[] = ['smoker', 'griddle', 'oven'];

/** A failed Export my data (Jason, 2026-11-16; as "Couldn't share" on Plan). */
export const EXPORT_FAILED = { title: "Couldn't export", body: 'Your data was not shared. Try again.' };
/** The title over a refusal or the restored counts: the row's own name, as Plan's "Open shared plan". */
export const RESTORE_TITLE = 'Restore from a file';

type Checked = Extract<DataCheck, { ok: true }>;
type Open =
  | 'add'
  | 'alerts'
  | 'units'
  | { kind: 'confirm'; check: Checked }
  | { kind: 'notice'; title: string; body: string }
  | null;

export function GearScreen({
  version,
  permissions,
  alarms,
  onResume,
  onDebug,
  onCooker,
  onHistory,
  shareDataFile,
  pickDataFile,
  now = Date.now,
}: {
  /** The app's version, as the build has it. */
  version: string;
  permissions: PermissionService;
  /** For "Send a test alert in 10 sec" on the Alerts sheet (the real alarm path). */
  alarms: Pick<AlarmService, 'testAlarm'>;
  onResume: AppLinks['onResume'];
  /** Opens the hidden test screen; the screen grants the pass first (src/lib/debugPass.ts). */
  onDebug: () => void;
  /** T-027: a cooker's sheet, for one the user has (edit) or one chosen in Add a cooker (new). */
  onCooker?: (kind: CookerKind) => void;
  /** T-028: Cook rates and history. */
  onHistory?: () => void;
  /** T-036: hands the data file to the share sheet. Without it Export my data does nothing. */
  shareDataFile?: ShareFile;
  /** T-036: the system file picker. Without it Restore from a file does nothing. */
  pickDataFile?: PickTextFile;
  /** The export's time and the reader's "now"; tests pass a fixed one. */
  now?: () => number;
}) {
  const { state, setUnits, restoreData, logEvent } = useStore();
  const { gear, units } = state;
  const [open, setOpen] = useState<Open>(null);
  const [status, refresh] = useAlarmStatus(permissions, onResume);
  const [taps, setTaps] = useState(0);
  const close = () => setOpen(null);
  const missing = KINDS.filter(k => !gear[k]);

  const update = availableUpdate(state.update, version);
  const rateLine = ratesSummary(
    rateRows(rules, state.history, gear.smoker?.id ?? 'none', state.rates, state.totalHours, state.rateLocks),
    units,
  );
  const notice = (title: string, body: string) => setOpen({ kind: 'notice', title, body });
  const refuse = (why: Refusal) => notice(RESTORE_TITLE, refusalText(why));

  // Export my data: the pitplanner-data file (not the error screen's full dump), named by the time it was made.
  const exportData = () => {
    if (!shareDataFile) return;
    const at = now();
    const { gear: g, units: u, rates, totalHours, rateLocks, records, flags } = state;
    const text = buildDataFile({ gear: g, units: u, rates, totalHours, rateLocks, records, flags }, at, version);
    // Written to the event log too, so it is not silent in a release build. A second tap while the sheet is
    // still opening is not a failure: shareTextFile drops that one.
    const failed = (e: unknown) => {
      logEvent('error', `data export failed: ${errorText(e)}`);
      notice(EXPORT_FAILED.title, EXPORT_FAILED.body);
    };
    try {
      shareDataFile(dataFileName(at), text).catch(failed);
    } catch (e) {
      failed(e);
    }
  };

  // Restore from a file: refused at once while a cook runs (no picker). A cancelled picker says nothing. The
  // file is checked in full before the confirm sheet; only Replace writes.
  const picking = useRef(false);
  const restoreFromFile = async () => {
    if (!pickDataFile || picking.current) return;
    if (state.cook) return refuse('cook running');
    picking.current = true;
    const picked = await pickDataFile(MAX_CHARS).catch(() => ({ error: 'unreadable' as const }));
    picking.current = false;
    if ('canceled' in picked) return;
    if ('error' in picked) return refuse(picked.error === 'tooBig' ? 'too big' : 'unreadable');
    const check = readDataFile(rules, picked.text, now());
    if (!check.ok) return refuse(check.problem);
    setOpen({ kind: 'confirm', check });
  };
  const replace = (check: Checked) => {
    const result = restoreData(check.data);
    if (!result.ok) return refuse(result.problem);
    notice(RESTORE_TITLE, restoredText(result.counts));
  };

  const tapVersion = () => {
    if (taps + 1 < DEBUG_TAPS) return setTaps(taps + 1);
    setTaps(0);
    grantDebugPass();
    onDebug();
  };

  return (
    <Screen title="Gear">
      <Stack gap={8}>
        <Heading label="Cookers" />
        <GroupCard>
          {gear.smoker ? (
            <ListRow
              leading={<Avatar kind="smoker" size={40} />}
              title={gear.smoker.name}
              wrap
              subtitle={<Values text={smokerSubtitle(gear, units)} />}
              onPress={() => onCooker?.('smoker')}
            />
          ) : null}
          {gear.griddle ? (
            <ListRow
              leading={<Avatar kind="griddle" size={40} />}
              title="Griddle"
              wrap
              subtitle={
                gear.griddle.name !== 'Griddle' ? (
                  gear.griddle.name
                ) : (
                  <Values text={`${gear.griddle.sizeIn} in, ${gear.griddle.burners} burners`} />
                )
              }
              onPress={() => onCooker?.('griddle')}
            />
          ) : null}
          {gear.oven ? (
            <ListRow
              leading={<Avatar kind="oven" size={40} />}
              title="Oven"
              wrap
              subtitle={
                gear.oven.holdIn === 'cooler' ? (
                  'Holding in a cooler'
                ) : (
                  <Values text={`Holding at ${fmtTemp(gear.oven.lowestTempF, units, true)}`} />
                )
              }
              onPress={() => onCooker?.('oven')}
            />
          ) : null}
          {missing.length > 0 ? (
            <ListRow
              leading={
                <IconAvatar tone="bare">
                  <Plus />
                </IconAvatar>
              }
              title="Add a cooker"
              tone="accent"
              trailing={null}
              onPress={() => setOpen('add')}
            />
          ) : null}
        </GroupCard>
      </Stack>

      <Stack gap={8}>
        <Heading label="Your numbers" />
        <GroupCard>
          <ListRow
            leading={
              <IconAvatar tone="ok">
                <AvatarText text="hr" />
              </IconAvatar>
            }
            title="Cook rates"
            wrap
            subtitle={<Values text={rateLine} />}
            onPress={() => onHistory?.()}
          />
          <ListRow
            leading={
              <IconAvatar>
                <Upload />
              </IconAvatar>
            }
            title="Export my data"
            wrap
            subtitle="Cookers, rates and past cooks in one file"
            onPress={exportData}
          />
          <ListRow
            leading={
              <IconAvatar>
                <Download />
              </IconAvatar>
            }
            title="Restore from a file"
            wrap
            subtitle="Replaces the data on this phone"
            onPress={() => void restoreFromFile()}
          />
        </GroupCard>
      </Stack>

      <Stack gap={8}>
        <Heading label="App" />
        <GroupCard>
          {update ? (
            <ListRow
              leading={
                <IconAvatar tone="ok">
                  <AvatarText text="new" />
                </IconAvatar>
              }
              title="Update available"
              wrap
              subtitle={`Version ${update}. Download it in your browser, then open it to install.`}
              href={state.update?.url ?? RELEASES_PAGE}
            />
          ) : null}
          <ListRow
            leading={
              <IconAvatar tone={!status || allGranted(status) ? 'ok' : 'warn'}>
                <Bell />
              </IconAvatar>
            }
            title="Alerts"
            wrap
            subtitle={alertsSubtitle(status)}
            onPress={() => setOpen('alerts')}
          />
          <ListRow
            leading={
              <IconAvatar>
                <Thermo />
              </IconAvatar>
            }
            title="Units"
            wrap
            subtitle={`${units.temp === 'F' ? 'Fahrenheit' : 'Celsius'}, ${units.weight === 'lb' ? 'pounds' : 'kilograms'}`}
            onPress={() => setOpen('units')}
          />
          <ListRow
            leading={
              <IconAvatar>
                <HomeIcon />
              </IconAvatar>
            }
            title="Home Assistant"
            subtitle="Coming later"
          />
          <ListRow
            leading={
              <IconAvatar tone="gold">
                <Cup />
              </IconAvatar>
            }
            title="Buy me a bag of pellets"
            wrap
            subtitle="If the app saved your brisket"
            href={SUPPORT_URL}
          />
        </GroupCard>
      </Stack>

      {/* Tap the version 5 times for the hidden test screen. */}
      <FootLine text={`Pit Planner ${version}`} onPress={tapVersion} />

      {open === 'add' ? (
        <AddCooker onClose={close} hide={KINDS.filter(k => gear[k])} onPick={k => onCooker?.(k)} />
      ) : null}
      {open === 'alerts' ? (
        <Sheet title="Alerts" onClose={close}>
          {status ? <AlertChecks status={status} permissions={permissions} onChange={refresh} /> : null}
          <BatteryNote />
          <TestAlertButton alarms={alarms} reserve />
        </Sheet>
      ) : null}
      {open === 'units' ? <UnitsSheet units={units} onChange={setUnits} onClose={close} /> : null}
      {typeof open === 'object' && open?.kind === 'confirm' ? (
        <ReplaceSheet check={open.check} onReplace={() => replace(open.check)} onClose={close} />
      ) : null}
      {typeof open === 'object' && open?.kind === 'notice' ? (
        <ImportNotice title={open.title} body={open.body} onClose={close} />
      ) : null}
    </Screen>
  );
}

function Heading({ label }: { label: string }) {
  return (
    <Text variant="section" tone="secondary" role="heading">
      {label}
    </Text>
  );
}

/**
 * Letters in place of an icon in an IconAvatar ("hr", "new"; ui.css .avatar-text). Decoration, like an icon:
 * hidden from TalkBack, so the row reads as its title and line.
 */
function AvatarText({ text }: { text: string }) {
  return (
    <Text variant="tile" weight="700" tone="ok" aria-hidden>
      {text}
    </Text>
  );
}

/** A temp, weight, size or rate with its unit, as the format helpers write them. */
const VALUE = /(\d+(?:\.\d+)? (?:hr\/lb|hr\/kg|hr|lb|kg|in)\b|\d+[FC]\b)/;

/** A subtitle with each value in it as a Num, so none breaks across lines. Goes inside a row's Text. */
function Values({ text }: { text: string }) {
  return <>{text.split(VALUE).map((part, i) => (i % 2 ? <Num key={i}>{part}</Num> : part))}</>;
}

function smokerSubtitle(gear: Cookers, units: Units): string {
  const s = gear.smoker!;
  const type = smokerTypeInfo(s.type).title;
  if (!hasHopper(s.type) || s.hopperLb == null) return type;
  const hopper =
    units.weight === 'lb' ? `${Math.round(s.hopperLb)} lb` : `${Math.round(lbToKg(s.hopperLb) * 10) / 10} kg`;
  return `${type}, ${hopper} hopper`;
}

function alertsSubtitle(s: AlarmStatus | null): string {
  if (!s) return 'Checking';
  if (allGranted(s)) return 'All set: exact alarms on, battery saver off';
  const off = [
    !s.notifications && 'notifications',
    !s.exactAlarms && 'exact alarms',
    !s.batteryUnrestricted && 'battery limits',
  ].filter(Boolean);
  return `Needs a fix: ${off.join(', ')}`;
}

/**
 * "Replace your data?" (Jason, 2026-11-16): what the file holds and when it was made, and a line when parts
 * of it were left out. Laid out as Start over? in Cook options: the text, then Cancel and Replace side by side.
 */
function ReplaceSheet({ check, onReplace, onClose }: { check: Checked; onReplace: () => void; onClose: () => void }) {
  const date = check.exportedAt == null ? null : fmtMonthDay(check.exportedAt);
  const leftOut = leftOutText(check.dropped);
  return (
    <Sheet title="Replace your data?" onClose={onClose} footer={<ReplaceButtons onReplace={onReplace} />}>
      <Text variant="bodyM" tone="secondary" relaxed>
        {confirmText(check.counts, date)}
      </Text>
      {leftOut ? (
        <Text variant="bodyM" tone="secondary" relaxed>
          {leftOut}
        </Text>
      ) : null}
    </Sheet>
  );
}

/**
 * The sheet footer is a row, and `block` alone is `w-full` with React Native's flexShrink 0: two of them are
 * each as wide as the row and the second starts off screen (T-036, emulator at 115%). As ui.css
 * `.sheet-foot .btn.block`, the two share the row: width auto, flex 1, free to shrink below their text.
 */
const SHARE_ROW = 'w-auto min-w-0 flex-1';

function ReplaceButtons({ onReplace }: { onReplace: () => void }) {
  const sheet = useSheet();
  return (
    <>
      <Button kind="text" block className={SHARE_ROW} onPress={() => sheet.close()}>
        <Text>Cancel</Text>
      </Button>
      <Button block className={SHARE_ROW} onPress={() => sheet.close(onReplace)}>
        <Text>Replace</Text>
      </Button>
    </>
  );
}

function UnitsSheet({ units, onChange, onClose }: { units: Units; onChange: (u: Units) => void; onClose: () => void }) {
  return (
    <Sheet title="Units" onClose={onClose}>
      <Field label="Temperature">
        <Segmented
          label="Temperature unit"
          value={units.temp}
          onChange={v => onChange({ ...units, temp: v as Units['temp'] })}
          options={[
            { id: 'F', label: 'Fahrenheit' },
            { id: 'C', label: 'Celsius' },
          ]}
        />
      </Field>
      <Field label="Weight">
        <Segmented
          label="Weight unit"
          value={units.weight}
          onChange={v => onChange({ ...units, weight: v as Units['weight'] })}
          options={[
            { id: 'lb', label: 'Pounds' },
            { id: 'kg', label: 'Kilograms' },
          ]}
        />
      </Field>
    </Sheet>
  );
}
