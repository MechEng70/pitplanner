// Keep serve or Move serve: two outcomes of one change to a running cook, and the user picks one (a port of
// `AskSheet` in legacy/src/screens/cook/CookScreen.tsx). Asked after a Done that is early or late and after
// Back up to temp. Each card says what the choice does to the food's hold or to serve time; when keeping
// serve would leave a food on the heat past serve it reads "Brisket: off heat 45 min after serve." and Move
// serve is the one selected (live test of 2026-11-11).
import { useState, type ReactNode } from 'react';
import { Button, ChoiceCards, Num, Nums, Sheet, Text, useSheet } from '@/components/kit';
import type { ActiveCook } from '@/lib/cook';
import { holdImpact, holdMin } from '@/lib/cookView';
import { fmtTime } from '@/lib/format';
import { holdsCover } from '../../../engine/live';

export interface Ask {
  title: string;
  /** A Text: what happened and the question. */
  body: ReactNode;
  keep: ActiveCook;
  move: ActiveCook;
  /** The food the change is about. Without one, the food whose hold changes most is named. */
  itemId?: string;
}

export function KeepMoveSheet({
  ask,
  before,
  onPick,
  onClose,
}: {
  ask: Ask;
  /** The plan as it stands, before either outcome. */
  before: ActiveCook['plan'];
  /** The chosen cook, after the sheet has closed. */
  onPick: (c: ActiveCook) => void;
  onClose: () => void;
}) {
  // Keep serve is preselected only when the holds absorb the change.
  const [pick, setPick] = useState<'keep' | 'move'>(() => (holdsCover(ask.keep.plan) ? 'keep' : 'move'));
  const change = (id: string) => Math.abs(holdMin(ask.keep.plan, id) - holdMin(before, id));
  const itemId = ask.itemId ?? [...before.items].sort((a, b) => change(b.input.id) - change(a.input.id))[0]?.input.id;
  return (
    <Sheet
      title={ask.title}
      onClose={onClose}
      footer={<Apply onApply={() => onPick(pick === 'keep' ? ask.keep : ask.move)} />}
    >
      <Text variant="bodyM" tone="secondary" relaxed>
        {ask.body}
      </Text>
      <ChoiceCards
        label="Serve time"
        value={pick}
        onChange={id => setPick(id === 'move' ? 'move' : 'keep')}
        options={[
          {
            id: 'keep',
            title: (
              <Text>
                Keep serve <Num>{fmtTime(ask.keep.plan.serveAt)}</Num>
              </Text>
            ),
            subtitle: itemId ? <Nums text={holdImpact(before, ask.keep.plan, itemId)} /> : undefined,
          },
          {
            id: 'move',
            title: <Text>Move serve</Text>,
            subtitle: itemId ? <Nums text={holdImpact(before, ask.move.plan, itemId)} /> : undefined,
          },
        ]}
      />
    </Sheet>
  );
}

function Apply({ onApply }: { onApply: () => void }) {
  const { close } = useSheet();
  return (
    <Button block onPress={() => close(onApply)}>
      <Text>Apply</Text>
    </Button>
  );
}
