// Shown instead of the app when the database could not be brought up to date (TECH-DESIGN section 5):
// never a silent reset. The kit empty state (Jason, 2026-11-12): icon, title, body, the primary button,
// and the error details behind a text button.
import { useState } from 'react';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Banner, Button, EmptyState, InfoBox, Text, Warn } from '@/components/kit';

export interface MigrationFailure {
  kind: 'failed' | 'newer';
  version: number;
  message: string;
  cause?: unknown;
}

export const TITLE = "Pit Planner couldn't update";
export const BODY = 'Your data is safe. Tap Export my data and send the file to Jason.';

export function errorDetails(e: MigrationFailure): string {
  const cause = e.cause instanceof Error ? e.cause.message : e.cause == null ? '' : String(e.cause);
  return cause ? `${e.message}: ${cause}` : e.message;
}

interface Props {
  error: MigrationFailure;
  /** Shares the data: the JSON export, or the database file itself when it could not be opened. */
  onExport: () => Promise<void>;
}

export function MigrationErrorScreen({ error, onExport }: Props) {
  const [details, setDetails] = useState(false);
  const [busy, setBusy] = useState(false);
  const [exportFailed, setExportFailed] = useState(false);
  const run = async () => {
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
      <ScrollView contentContainerClassName="grow p-4">
        <EmptyState icon={<Warn size={48} />} title={TITLE} body={BODY}>
          {exportFailed ? <Banner>The export did not work. Try again.</Banner> : null}
          <Button block disabled={busy} onPress={() => void run()}>
            <Text>Export my data</Text>
          </Button>
          {/* Centered like the body text above it. */}
          <Button kind="text" className="self-center" aria-expanded={details} onPress={() => setDetails(d => !d)}>
            <Text>{details ? 'Hide details' : 'Show details'}</Text>
          </Button>
          {details ? <InfoBox>{errorDetails(error)}</InfoBox> : null}
        </EmptyState>
      </ScrollView>
    </SafeAreaView>
  );
}
