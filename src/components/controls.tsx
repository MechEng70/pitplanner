// Small form controls from the mockups: stepper, chips, segmented switch.

import { Minus, Plus } from './icons.tsx';

export function Stepper({ value, unit, onDec, onInc, decDisabled, incDisabled, label }: {
  value: string; unit?: string; onDec: () => void; onInc: () => void;
  decDisabled?: boolean; incDisabled?: boolean; label: string;
}) {
  return (
    <div class="stepper" role="group" aria-label={label}>
      <button class="step-btn" aria-label={`Less ${label.toLowerCase()}`} disabled={decDisabled} onClick={onDec}><Minus /></button>
      <span class="step-val"><b>{value}</b>{unit && <span> {unit}</span>}</span>
      <button class="step-btn" aria-label={`More ${label.toLowerCase()}`} disabled={incDisabled} onClick={onInc}><Plus /></button>
    </div>
  );
}

export interface ChipOpt { id: string; label: string; disabled?: boolean; hint?: string }

export function Chips({ options, value, onChange, label }: {
  options: ChipOpt[]; value: string; onChange: (id: string) => void; label: string;
}) {
  return (
    <div class="chips" role="radiogroup" aria-label={label}>
      {options.map(o => (
        <button key={o.id} role="radio" aria-checked={o.id === value} disabled={o.disabled}
          class={`chip ${o.id === value ? 'chip-on' : ''}`} onClick={() => onChange(o.id)}>
          {o.label}{o.hint && <span class="chip-hint">{o.hint}</span>}
        </button>
      ))}
    </div>
  );
}

export function Segmented({ options, value, onChange, label }: {
  options: ChipOpt[]; value: string; onChange: (id: string) => void; label: string;
}) {
  return (
    <div class="segmented" role="radiogroup" aria-label={label}>
      {options.map(o => (
        <button key={o.id} role="radio" aria-checked={o.id === value} disabled={o.disabled}
          class={o.id === value ? 'seg-on' : ''} onClick={() => onChange(o.id)}>{o.label}</button>
      ))}
    </div>
  );
}
