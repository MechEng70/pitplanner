// Shown instead of the app when the database could not be brought up to date (TECH-DESIGN section 5):
// never a silent reset. Kit components only (Jason, 2026-11-12): one sentence, Export my data, and the
// error details behind a text button.
import { useState } from 'react';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Banner, Button, InfoBox, Stack, Text } from '@/components/kit';

export interface MigrationFailure {
  kind: 'failed' | 'newer';
  version: number;
  message: string;
  cause?: unknown;
}

const SENTENCE = {
  failed: 'The update failed, but your data is safe.',
  newer: 'Your data is from a newer version of Pit Planner, and it is safe.',
} as const;

export function errorDetails(e: MigrationFailure): string {
  const cause = e.cause instanceof Error ? e.cause.message : e.cause == null ? '' : String(e.cause);
  return cause ? `${e.message}: ${cause}` : e.message;
}

interface Props {
  error: MigrationFailure;
  /** Shares the data file; absent when the database could not be opened at all. */
  onExport?: () => Promise<void>;
}

export function MigrationErrorScreen({ error, onExport }: Props) {
  const [details, setDetails] = useState(false);
  const [busy, setBusy] = useState(false);
  const [exportFailed, setExportFailed] = useState(false);
  const run = async () => {
    if (!onExport) return;
    setBusy(true);
    setExportFailed(false);
    try {
      await onExport();
    } catch {
      setExportFailed(true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView contentContainerClassName="p-4">
        <Stack gap={16}>
          <Text variant="bodyL">{SENTENCE[error.kind]}</Text>
          {exportFailed ? <Banner>The export did not work. Try again.</Banner> : null}
          <Button block disabled={!onExport || busy} onPress={() => void run()}>
            <Text>Export my data</Text>
          </Button>
          <Button kind="text" aria-expanded={details} onPress={() => setDetails(d => !d)}>
            <Text>{details ? 'Hide details' : 'Show details'}</Text>
          </Button>
          {details ? <InfoBox>{errorDetails(error)}</InfoBox> : null}
        </Stack>
      </ScrollView>
    </SafeAreaView>
  );
}
