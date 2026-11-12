// Seed UI test: proves the Vitest + Testing Library setup works on a kit component.
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/preact';
import { Stepper } from './components.tsx';

describe('Stepper', () => {
  it('shows the value and unit and calls the handlers', () => {
    const onDec = vi.fn();
    const onInc = vi.fn();
    render(<Stepper value="0.75" unit="hr/lb" label="Rate" onDec={onDec} onInc={onInc} />);
    expect(screen.getByRole('group', { name: 'Rate' })).toHaveTextContent('0.75 hr/lb');
    fireEvent.click(screen.getByRole('button', { name: 'More rate' }));
    fireEvent.click(screen.getByRole('button', { name: 'Less rate' }));
    expect(onInc).toHaveBeenCalledOnce();
    expect(onDec).toHaveBeenCalledOnce();
  });

  it('disables a button at its limit', () => {
    render(<Stepper value="2.50" label="Rate" onDec={() => {}} onInc={() => {}} incDisabled />);
    expect(screen.getByRole('button', { name: 'More rate' })).toBeDisabled();
  });
});
