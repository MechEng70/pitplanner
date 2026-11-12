// The Saturday fixture from engine/plan.test.ts: serve Sat Nov 14, 2026, 5:00 PM Eastern; a 12 lb brisket at
// 0.75 hr/lb fires the smoker at 6:20 AM. Used by the T-002 Plan placeholder and app tests.
import type { PlanInput } from '../../../engine/types.ts';

export const saturday: PlanInput = {
  mode: 'readyBy',
  at: Date.UTC(2026, 10, 14, 22, 0),
  pitTempF: 225,
  cookers: {
    smoker: {
      id: 'pb820',
      name: 'Pit Boss 820',
      type: 'pellet',
      tempStepF: 5,
      minTempF: 180,
      maxTempF: 500,
      hopperLb: 21,
      mainGrateSqIn: 593,
      upperRackSqIn: 256,
      pelletLbPerHrLow: 1.5,
      pelletLbPerHrHigh: 3,
      preheatMin: 20,
    },
  },
  rateOverrides: { brisket: 0.75 },
  items: [{ id: 'b', foodId: 'brisket', methodId: 'smoked', quantity: 12, options: { wrap: 'paper' }, restMin: 60 }],
};
