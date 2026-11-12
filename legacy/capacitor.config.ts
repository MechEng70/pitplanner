import type { CapacitorConfig } from '@capacitor/cli';

// appId is permanent once an APK is released: changing it later makes a different app.
const config: CapacitorConfig = {
  appId: 'io.github.mecheng70.pitplanner',
  appName: 'Pit Planner',
  webDir: 'dist',
  backgroundColor: '#131211',
  android: { allowMixedContent: false },
};

export default config;
