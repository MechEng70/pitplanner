// Add a cooker (mockup 17; a port of legacy/src/screens/shared/AddCooker.tsx). Setup and Gear decide what
// each choice opens: choosing one closes the sheet, then hands the kind over.
import { Avatar, Card, ChevronRight, Fill, Stack, Text, Sheet, useSheet } from '@/components/kit';
import { colors } from '@/theme/tokens';

export type CookerKind = 'smoker' | 'griddle' | 'oven';
const ROWS: { kind: CookerKind; title: string; subtitle: string }[] = [
  { kind: 'smoker', title: 'Smoker', subtitle: 'Pellet, kamado, offset, drum, gravity, electric' },
  { kind: 'griddle', title: 'Griddle', subtitle: 'Searing, chicken, wings' },
  { kind: 'oven', title: 'Oven', subtitle: 'Holding food warm until serve' },
];

export function AddCooker({
  onPick,
  onClose,
  hide = [],
}: {
  onPick: (k: CookerKind) => void;
  onClose: () => void;
  /** Kinds left out (Setup: the griddle and oven that are already switched on). */
  hide?: CookerKind[];
}) {
  return (
    <Sheet title="Add a cooker" onClose={onClose}>
      <Rows onPick={onPick} hide={hide} />
    </Sheet>
  );
}

function Rows({ onPick, hide }: { onPick: (k: CookerKind) => void; hide: CookerKind[] }) {
  const { close } = useSheet();
  return (
    <Stack gap={12}>
      <Text variant="bodyM" tone="secondary">
        What are you adding?
      </Text>
      {ROWS.filter(r => !hide.includes(r.kind)).map(r => (
        <Card key={r.kind} tone="inset" onPress={() => close(() => onPick(r.kind))} label={r.title}>
          <Avatar kind={r.kind} />
          <Fill>
            <Stack gap={2}>
              <Text variant="bodyL" weight="500">
                {r.title}
              </Text>
              <Text variant="label" tone="secondary">
                {r.subtitle}
              </Text>
            </Stack>
          </Fill>
          <ChevronRight color={colors.text2} />
        </Card>
      ))}
    </Stack>
  );
}
