import { Avatar, Card, Fill, Stack, Text, Sheet, useSheet } from '../../ui/components.tsx';
import { ChevronRight } from '../../ui/icons.tsx';

export type CookerKind = 'smoker' | 'griddle' | 'oven';
const ROWS: { kind: CookerKind; title: string; subtitle: string }[] = [
  { kind: 'smoker', title: 'Smoker', subtitle: 'Pellet, kamado, offset, drum, gravity, electric' },
  { kind: 'griddle', title: 'Griddle', subtitle: 'Searing, chicken, wings' },
  { kind: 'oven', title: 'Oven', subtitle: 'Holding food warm until serve' },
];

/** Add a cooker (mockup 17). Setup and Gear decide what each choice opens. */
export function AddCooker({ onPick, onClose, hide = [] }: { onPick: (k: CookerKind) => void; onClose: () => void; hide?: CookerKind[] }) {
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
      <Text v="bodyM" tone="secondary">What are you adding?</Text>
      {ROWS.filter(r => !hide.includes(r.kind)).map(r => (
        <Card key={r.kind} tone="inset" onClick={() => close(() => onPick(r.kind))} label={r.title}>
          <Avatar kind={r.kind} />
          <Fill>
            <Stack gap={2}>
              <Text v="bodyL" weight={500}>{r.title}</Text>
              <Text v="label" tone="secondary">{r.subtitle}</Text>
            </Stack>
          </Fill>
          <ChevronRight color="var(--text-2)" />
        </Card>
      ))}
    </Stack>
  );
}
