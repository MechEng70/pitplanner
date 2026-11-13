// Step alarms and alert permissions through the pit-alarms native module (T-013). The annotations are the
// check that the module's JS API matches the service interfaces. T-015 adds the app wiring (alarms synced
// after every cook change, notification actions drained on start and resume).
import { pitAlarms } from '../../modules/pit-alarms';
import type { AlarmService, PermissionService } from './types';

export const alarmService: AlarmService = pitAlarms;
export const permissionService: PermissionService = pitAlarms;
