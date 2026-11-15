import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Button, Text } from '@/components/kit';
import { fakeShare } from '@/platform/fakes';
import { OpenedPlanProvider, useOpenedPlan } from './OpenedPlan';

/** Stands in for the Plan tab: shows what is held and can say it is done. */
function Reader() {
  const { file, done } = useOpenedPlan();
  return (
    <>
      <Text>{file ? (file.text ?? `error ${file.error}`) : 'nothing'}</Text>
      <Button onPress={done}>
        <Text>Done</Text>
      </Button>
    </>
  );
}

async function show() {
  const share = fakeShare();
  const onArrive = jest.fn();
  const view = await render(
    <OpenedPlanProvider onPlanOpened={share.onPlanOpened} onArrive={onArrive}>
      <Reader />
    </OpenedPlanProvider>,
  );
  return { share, onArrive, view };
}

test('nothing is held until a file is opened', async () => {
  const { onArrive } = await show();
  expect(screen.getByText('nothing')).toBeOnTheScreen();
  expect(onArrive).not.toHaveBeenCalled();
});

test('an opened file is held for the Plan tab, and the Plan tab is asked for', async () => {
  const { share, onArrive } = await show();
  await act(async () => share.open({ text: '{"app":"pit-planner"}', name: 'cook.pitplan' }));
  expect(screen.getByText('{"app":"pit-planner"}')).toBeOnTheScreen();
  expect(onArrive).toHaveBeenCalledTimes(1);
});

test('a file that could not be read is held too, so the Plan tab can say why', async () => {
  const { share, onArrive } = await show();
  await act(async () => share.open({ error: 'tooBig' }));
  expect(screen.getByText('error tooBig')).toBeOnTheScreen();
  expect(onArrive).toHaveBeenCalledTimes(1);
});

test('done lets go of the file; the next one is held in its place', async () => {
  const { share } = await show();
  await act(async () => share.open({ text: 'one' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Done' }));
  expect(screen.getByText('nothing')).toBeOnTheScreen();
  await act(async () => share.open({ text: 'two' }));
  await act(async () => share.open({ text: 'three' }));
  expect(screen.getByText('three')).toBeOnTheScreen();
});

test('it stops listening when it goes away', async () => {
  const { share, onArrive, view } = await show();
  await view.unmount();
  share.open({ text: 'late' });
  expect(onArrive).not.toHaveBeenCalled();
});

test('outside the provider nothing is held', async () => {
  await render(<Reader />);
  expect(screen.getByText('nothing')).toBeOnTheScreen();
});
