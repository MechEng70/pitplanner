// Kit gallery (T-005, dev builds only): every kit component once, with sample values from the mockups.
// Open with: adb shell am start -d pitplanner://dev/kit <dev package>. Not a screen of the app.
import { Redirect } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Avatar,
  Banner,
  Bell,
  Button,
  Calendar,
  Card,
  CheckRow,
  Chips,
  Cup,
  Divider,
  EmptyState,
  Field,
  Fill,
  Fixed,
  Flame,
  GroupCard,
  IconAvatar,
  IconButton,
  InfoBox,
  ListRow,
  MoreVert,
  Num,
  ResultCard,
  Row,
  Segmented,
  ShareIcon,
  Sheet,
  Stack,
  StatusRow,
  Stepper,
  Text,
  Thermo,
  Tile,
  Tiles,
  Timer,
  useSheet,
  Warn,
} from '@/components/kit';

export default function KitRoute() {
  if (!__DEV__) return <Redirect href="/plan" />;
  return <Gallery />;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Stack gap={12}>
      <Text variant="overline" tone="accentHi">
        {title}
      </Text>
      {children}
    </Stack>
  );
}

function SheetSave() {
  const sheet = useSheet();
  return (
    <Button block onPress={() => sheet.close()}>
      <Text>Save</Text>
    </Button>
  );
}

function Gallery() {
  const [units, setUnits] = useState('f');
  const [anchor, setAnchor] = useState('readyBy');
  const [mode, setMode] = useState('rate');
  const [rate, setRate] = useState(0.75);
  const [griddle, setGriddle] = useState(true);
  const [oven, setOven] = useState(false);
  const [sheet, setSheet] = useState<null | 'one' | 'two'>(null);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'left', 'right', 'bottom']}>
      <ScrollView contentContainerClassName="gap-6 px-4 pb-10 pt-4">
        <Text variant="title" role="heading">
          Kit
        </Text>

        <Section title="TEXT AND NUM">
          <Text variant="display">Display 28</Text>
          <Text variant="when">
            Serve <Num>5:00 PM</Num>
          </Text>
          <Num variant="countdown">45 hr 50 min</Num>
          <Text variant="bodyM" tone="secondary">
            Fire the smoker to <Num>225F</Num> at <Num>6:20 AM</Num>.
          </Text>
          <Text variant="label" tone="secondary" clamp>
            A long secondary line may be cut with an ellipsis when it does not fit on one line.
          </Text>
        </Section>

        <Section title="BUTTONS">
          <Button block>
            <Text>Start cook</Text>
          </Button>
          <Button block disabled>
            <Text>Start cook</Text>
          </Button>
          <Row gap={8} wrap>
            <Button kind="outline">
              <Text>Back</Text>
            </Button>
            <Button kind="outline" tone="accent">
              <Text>Add food</Text>
            </Button>
            <Button kind="tonal">
              <Text>Allow</Text>
            </Button>
            <Button kind="text">
              <Text>Skip</Text>
            </Button>
            <Button kind="text" tone="danger">
              <Text>Remove</Text>
            </Button>
          </Row>
          <Row gap={0}>
            <IconButton label="Share" onPress={() => {}}>
              <ShareIcon />
            </IconButton>
            <IconButton label="More" onPress={() => {}}>
              <MoreVert />
            </IconButton>
            <IconButton label="Calendar" onPress={() => {}}>
              <Calendar />
            </IconButton>
          </Row>
        </Section>

        <Section title="CHIPS, SEGMENTED, STEPPER, FIELD">
          <Chips
            label="Units"
            value={units}
            onChange={setUnits}
            options={[
              { id: 'f', label: 'Fahrenheit' },
              { id: 'c', label: 'Celsius' },
              { id: 'x', label: 'Kelvin', disabled: true },
            ]}
          />
          <Chips
            label="Anchor"
            small
            value={anchor}
            onChange={setAnchor}
            options={[
              { id: 'readyBy', label: 'Ready by' },
              { id: 'startAt', label: 'Start at' },
            ]}
          />
          <Chips
            label="Scroll"
            scroll
            value="brisket"
            onChange={() => {}}
            options={['Brisket', 'Pork butt', 'Ribs', 'Chicken', 'Turkey', 'Tri-tip'].map(l => ({
              id: l.toLowerCase(),
              label: l,
            }))}
          />
          <Segmented
            label="Timing"
            value={mode}
            onChange={setMode}
            options={[
              { id: 'rate', label: 'Hours per pound' },
              { id: 'total', label: 'Total hours' },
            ]}
          />
          <Field label="Hours per pound" note="Your rate from 3 cooks.">
            <Stepper
              label="Hours per pound"
              value={rate.toFixed(2)}
              unit="hr/lb"
              onDec={() => setRate(r => Math.max(0.3, r - 0.05))}
              onInc={() => setRate(r => Math.min(2.5, r + 0.05))}
              decDisabled={rate <= 0.3}
              incDisabled={rate >= 2.5}
            />
          </Field>
        </Section>

        <Section title="CARDS AND TILES">
          <Card onPress={() => {}} label="Brisket">
            <Avatar kind="smoker" />
            <Fill>
              <Text variant="bodyL" weight="500">
                Brisket
              </Text>
              <Text variant="label" tone="secondary">
                <Num>12 lb</Num>, Sportsman 850
              </Text>
            </Fill>
            <Fixed>
              <Num variant="bodyL" weight="500">
                6:20 AM
              </Num>
            </Fixed>
          </Card>
          <Row gap={8} wrap>
            <Avatar kind="smoker" size={40} />
            <Avatar kind="griddle" />
            <Avatar kind="oven" />
            <Avatar kind="smoker" size={72} />
            <IconAvatar>
              <Timer />
            </IconAvatar>
            <IconAvatar tone="ok">
              <Bell />
            </IconAvatar>
            <IconAvatar tone="gold">
              <Cup />
            </IconAvatar>
          </Row>
          <Tiles>
            <Tile label="Fire" value="6:20 AM" sub="Sat" />
            <Tile label="Pellets" value="14 lb" tone="warn" onPress={() => {}} />
            <Tile label="Serve" value="5:00 PM" />
          </Tiles>
          <Card tone="surface" col>
            <Text variant="section">Inset tiles</Text>
            <Tiles inset>
              <Tile label="On heat" value="9 hr" />
              <Tile label="Rest" value="1 hr" />
            </Tiles>
          </Card>
          <ResultCard overline="FIRE THE SMOKER" title={<Num>6:20 AM</Num>}>
            <Text variant="bodyM" tone="soft">
              Off heat <Num>3:20 PM</Num>, rest, slice, serve <Num>5:00 PM</Num>.
            </Text>
          </ResultCard>
          <InfoBox lead="Smoker busy">Ribs wait 30 min for the brisket to come off.</InfoBox>
          <Card tone="inset">
            <Thermo />
            <Text>Inset card</Text>
          </Card>
          <Card tone="outline">
            <Text>Outline card</Text>
          </Card>
        </Section>

        <Section title="BANNERS">
          <Banner
            action={
              <Button kind="text">
                <Text>Fix</Text>
              </Button>
            }
          >
            Alerts are off. Steps will not ring.
          </Banner>
          <Banner tone="warn" action={<Warn />}>
            Pit went out at 2:10 PM.
          </Banner>
        </Section>

        <Section title="ROWS">
          <GroupCard>
            <StatusRow title="Notifications" subtitle="Step alerts and reminders" ok />
            <StatusRow
              title="Alarms and reminders"
              subtitle="Rings on time, even asleep"
              ok={false}
              action={
                <Button kind="tonal">
                  <Text>Allow</Text>
                </Button>
              }
            />
          </GroupCard>
          <GroupCard>
            <CheckRow leading={<Avatar kind="griddle" />} title="Griddle" checked={griddle} onChange={setGriddle} />
            <CheckRow
              leading={<Avatar kind="oven" />}
              title="Oven"
              subtitle="For sides and warming"
              checked={oven}
              onChange={setOven}
            />
          </GroupCard>
          <GroupCard>
            <ListRow
              leading={<Avatar kind="smoker" />}
              title="Sportsman 850"
              subtitle="Pellet grill"
              onPress={() => {}}
            />
            <ListRow
              leading={
                <IconAvatar>
                  <Timer />
                </IconAvatar>
              }
              title="Cook rates"
              subtitle="Your hours per pound, by food and cooker"
              onPress={() => {}}
            />
            <ListRow title="Add a cooker" tone="accent" onPress={() => {}} />
            <ListRow title="Version 0.3.0" subtitle="Plain row, no chevron" wrap />
          </GroupCard>
          <Divider />
        </Section>

        <Section title="SHEET AND EMPTY STATE">
          <Button kind="outline" onPress={() => setSheet('one')}>
            <Text>Open sheet</Text>
          </Button>
          <Card col>
            <EmptyState icon={<Flame size={48} />} title="Nothing planned" body="Add food to plan a cook.">
              <Button block>
                <Text>Add food</Text>
              </Button>
            </EmptyState>
          </Card>
        </Section>
      </ScrollView>

      {sheet && (
        <Sheet title="Alerts" onClose={() => setSheet(null)} footer={<SheetSave />}>
          <Text variant="bodyM" tone="secondary">
            Back closes the top sheet first.
          </Text>
          <Button kind="outline" onPress={() => setSheet('two')}>
            <Text>Open a second sheet</Text>
          </Button>
          {Array.from({ length: 12 }, (_, i) => (
            <Text key={i}>Row {i + 1}</Text>
          ))}
        </Sheet>
      )}
      {sheet === 'two' && (
        <Sheet title="Second" onClose={() => setSheet('one')}>
          <Text>On top of the first sheet.</Text>
        </Sheet>
      )}
    </SafeAreaView>
  );
}
