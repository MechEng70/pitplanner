// Step alarms through the pit-alarms native module (T-013). The annotation is the check that the module's
// JS API matches AlarmService. The app wiring (one replaceAll after every cook change, notification taps
// drained on start and resume) is in src/lib/store.tsx and src/lib/alarmWiring.ts; they take this service
// as a parameter, so tests pass the fake (src/platform/fakes.ts).
import { pitAlarms } from '../../modules/pit-alarms';
import type { AlarmService } from './types';

export const alarmService: AlarmService = pitAlarms;
