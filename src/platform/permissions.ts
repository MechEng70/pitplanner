// Alert permissions (notifications, exact alarms, battery, full screen) through the pit-alarms native module.
// `allGranted` (src/platform/types.ts) says whether Start cook may go ahead.
import { pitAlarms } from '../../modules/pit-alarms';
import type { PermissionService } from './types';

export const permissionService: PermissionService = pitAlarms;
