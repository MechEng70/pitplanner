// Every migration, in order. Version N is at index N - 1 (checked by the runner).
import type { Migration } from '../migrate.ts';
import { init } from './0001_init.ts';

export const migrations: readonly Migration[] = [init];
