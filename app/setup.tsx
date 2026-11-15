// First run (T-024): Setup, while no cookers are saved. Once they are (Finish, or a 0.2.0 import) this route
// hands over to the tabs. The alerts step (mockup 03) joins in T-025 as Setup's `alertsStep`.
import { Redirect } from 'expo-router';
import { BackHandler } from 'react-native';
import { Setup } from '@/screens/setup/Setup';
import { SetupGate } from '@/screens/setup/SetupGate';

const onBackPress = (handler: () => boolean) => {
  const sub = BackHandler.addEventListener('hardwareBackPress', handler);
  return () => sub.remove();
};

export default function SetupRoute() {
  return (
    <SetupGate done={<Redirect href="/" />}>
      <Setup onBackPress={onBackPress} />
    </SetupGate>
  );
}
