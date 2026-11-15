import * as Clipboard from 'expo-clipboard';
import { copyText } from './clipboard';

jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn(async () => true) }));

test('copyText puts the text on the clipboard', async () => {
  await copyText('someone@example.com');
  expect(Clipboard.setStringAsync).toHaveBeenCalledTimes(1);
  expect(Clipboard.setStringAsync).toHaveBeenCalledWith('someone@example.com');
});

test('copyText rejects when the clipboard does not take the text', async () => {
  jest.mocked(Clipboard.setStringAsync).mockResolvedValueOnce(false);
  await expect(copyText('a')).rejects.toThrow('not copied');
  jest.mocked(Clipboard.setStringAsync).mockRejectedValueOnce(new Error('no clipboard'));
  await expect(copyText('a')).rejects.toThrow('no clipboard');
});
