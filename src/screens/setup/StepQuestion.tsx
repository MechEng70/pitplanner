// The temp step question (T-082, Jason 2026-11-17; proposal docs/proposals/2026-11-17-temp-step): on Setup's
// smoker card and in Gear's Smoker sheet, under the model. Five choices in the display unit, stored as F;
// Other opens a two-field sheet (Temp step, Dial settings). Only the smoker's step or dial settings change.
import { useState } from 'react';
import type { SmokerProfile } from '../../../engine/types';
import { Field, Segmented } from '@/components/kit';
import type { Units } from '@/lib/format';
import { STEP_CHOICES, stepChoice, stepChoiceF, stepNote, withTemps } from '@/lib/gear';
import { StepSheet } from './SmokerPicker';

export const STEP_QUESTION = 'What steps does your smoker set in?';

/**
 * The saved step shows as its choice; a step that is none of the four, or dial settings, shows as Other with
 * a line saying what is saved; in Celsius an F step (a 5F catalog smoker) shows none and stays as it is.
 * While the Other sheet is open Other shows selected; closing it without saving puts back what was there.
 */
export function StepQuestion({
  smoker,
  units,
  onChange,
}: {
  smoker: SmokerProfile;
  units: Units;
  onChange: (s: SmokerProfile) => void;
}) {
  const [other, setOther] = useState(false);
  const unit = units.temp;
  return (
    <>
      <Field label={STEP_QUESTION} note={stepNote(smoker, unit) ?? undefined}>
        <Segmented
          label={STEP_QUESTION}
          value={other ? 'other' : stepChoice(smoker, unit)}
          onChange={id =>
            id === 'other' ? setOther(true) : onChange(withTemps(smoker, { tempStepF: stepChoiceF(+id, unit) }))
          }
          options={[
            ...STEP_CHOICES.map(n => ({ id: String(n), label: `${n}${unit}` })),
            { id: 'other', label: 'Other' },
          ]}
        />
      </Field>
      {other ? <StepSheet smoker={smoker} units={units} onSave={onChange} onClose={() => setOther(false)} /> : null}
    </>
  );
}
