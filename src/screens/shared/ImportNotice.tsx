// One-time notice after the import from 0.2.0 when something could not be moved (TECH-DESIGN section 5).
// A kit Sheet with the sentence and OK; closing it (OK, back or the scrim) marks it seen.
import { Button, Sheet, Text, useSheet } from '@/components/kit';

function Ok() {
  const sheet = useSheet();
  return (
    <Button block onPress={() => sheet.close()}>
      <Text>OK</Text>
    </Button>
  );
}

export function ImportNotice({ title, body, onClose }: { title: string; body: string; onClose: () => void }) {
  return (
    <Sheet title={title} onClose={onClose} footer={<Ok />}>
      <Text variant="bodyL">{body}</Text>
    </Sheet>
  );
}
