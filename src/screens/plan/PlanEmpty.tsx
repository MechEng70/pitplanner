// Plan with nothing on the menu (mockup 04): the empty state with Add food and Cook a past plan again, and
// the notice for a saved plan that could not be loaded (Jason, 2026-11-12: never start empty without
// saying so).
import { useState } from 'react';
import { View } from 'react-native';
import { Avatar, Banner, Button, EmptyState, Text } from '@/components/kit';

export const DRAFT_LOST = 'Your saved plan could not be loaded.';

export function PlanEmpty({
  draftLost,
  hasHistory,
  onAddFood,
  onCookAgain,
}: {
  draftLost: boolean;
  hasHistory: boolean;
  onAddFood: () => void;
  onCookAgain: () => void;
}) {
  // The notice goes away when the plan is changed (the date, the mode), but its space stays while this
  // screen is open: it sits above the empty state, and nothing may move when a value changes (T-017 PR-3).
  const [lostAtOpen] = useState(draftLost);
  return (
    <>
      {lostAtOpen ? (
        <View
          className={draftLost ? undefined : 'opacity-0'}
          aria-hidden={!draftLost}
          importantForAccessibility={draftLost ? 'auto' : 'no-hide-descendants'}
        >
          <Banner tone="warn">{DRAFT_LOST}</Banner>
        </View>
      ) : null}
      <EmptyState
        icon={<Avatar kind="smoker" size={72} />}
        title="What are we cooking?"
        body="Add each food and Pit Planner works back from serve time to tell you when to fire the smoker."
      >
        <Button block onPress={onAddFood}>
          <Text>Add food</Text>
        </Button>
        <Button kind="text" block disabled={!hasHistory} onPress={onCookAgain}>
          <Text>Cook a past plan again</Text>
        </Button>
      </EmptyState>
    </>
  );
}
