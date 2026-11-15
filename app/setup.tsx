// First run (T-024): Setup, while no cookers are saved. Once they are (Finish, or a 0.2.0 import) this route
// hands over to the tabs. The alerts step (mockup 03, T-025) is Setup's `alertsStep`, given its services here.
import { Redirect } from 'expo-router';
import { BackHandler } from 'react-native';
import { alarmService } from '@/platform/alarms';
import { permissionService } from '@/platform/permissions';
import { onResume } from '@/platform/resume';
import { AlertsStep } from '@/screens/setup/AlertsStep';
import { Setup, type AlertsStep as AlertsStepSlot } from '@/screens/setup/Setup';
import { SetupGate } from '@/screens/setup/SetupGate';

const onBackPress = (handler: () => boolean) => {
  const sub = BackHandler.addEventListener('hardwareBackPress', handler);
  return () => sub.remove();
};

const alertsStep: AlertsStepSlot = ({ onBack, onFinish }) => (
  <AlertsStep
    permissions={permissionService}
    alarms={alarmService}
    onResume={onResume}
    onBack={onBack}
    onFinish={onFinish}
  />
);

export default function SetupRoute() {
  return (
    <SetupGate done={<Redirect href="/" />}>
      <Setup alertsStep={alertsStep} onBackPress={onBackPress} />
    </SetupGate>
  );
}
