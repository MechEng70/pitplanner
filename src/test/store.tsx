// Test helpers: a migrated in-memory database, its repositories, and a StoreProvider over them.
import type { ReactNode } from 'react';
import type { Db } from '@/db/db';
import { openMigrated } from '@/db/migrate';
import { migrations } from '@/db/migrations';
import { repos, type Repos } from '@/db/repos';
import { testDb } from '@/db/testDb';
import { StoreProvider } from '@/lib/store';
import type { AlarmService } from '@/platform/types';

export const NOW = 1794500000000;

export function testRepos(): { db: Db; repos: Repos } {
  const db = testDb();
  const r = openMigrated(db, migrations);
  if (!r.ok) throw r.error;
  return { db, repos: repos(db) };
}

/** `wrapper` for RNTL `render` and `renderHook`. */
export function storeWrapper(r: Repos = testRepos().repos, clock: () => number = () => NOW, alarms?: AlarmService) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <StoreProvider repos={r} clock={clock} alarms={alarms}>
        {children}
      </StoreProvider>
    );
  };
}
