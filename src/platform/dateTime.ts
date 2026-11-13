// Date and time for the plan (Ready by / Start at): Android's own date dialog, then its time dialog
// (what the 0.2.0 WebView's datetime-local input opened). iOS gets its own implementation of PickDateTime.
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import type { PickDateTime } from './types';

export const pickDateTime: PickDateTime = initial =>
  new Promise(resolve => {
    DateTimePickerAndroid.open({
      value: new Date(initial),
      mode: 'date',
      onDismiss: () => resolve(null),
      onValueChange: (_event, day) => {
        DateTimePickerAndroid.open({
          value: day,
          mode: 'time',
          onDismiss: () => resolve(null),
          onValueChange: (_e, time) => {
            const picked = new Date(time);
            picked.setSeconds(0, 0);
            resolve(picked.getTime());
          },
        });
      },
    });
  });
