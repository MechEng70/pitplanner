// The app coming back to the front (AppLinks.onResume): notification taps made while it was in the
// background are applied then.
import { AppState } from 'react-native';
import type { AppLinks } from './types';

export const onResume: AppLinks['onResume'] = fn => {
  const sub = AppState.addEventListener('change', state => {
    if (state === 'active') fn();
  });
  return () => sub.remove();
};
