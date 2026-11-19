import cookers from '../../data/cookers.json';
import {
  catalogSmokers,
  hasTempStep,
  smokerFromCatalog,
  smokerTypes,
  stepChoice,
  stepNote,
  stepSheetStart,
} from './gear';

describe('the smoker catalog (data/cookers.json)', () => {
  // A pin: a verified model with no step and fewer than two presets would give an empty temp menu.
  test('every verified entry has a range and a temp step or at least two presets', () => {
    for (const e of catalogSmokers.filter(s => s.verified)) {
      expect({ id: e.id, min: typeof e.minTempF, max: typeof e.maxTempF }).toEqual({
        id: e.id,
        min: 'number',
        max: 'number',
      });
      expect([e.id, e.minTempF! < e.maxTempF!]).toEqual([e.id, true]);
      const temps = (e.tempStepF ?? 0) > 0 || (e.tempPresetsF?.length ?? 0) >= 2;
      expect([e.id, temps]).toEqual([e.id, true]);
    }
  });

  // Jason, 2026-11-17: the 820's temp setting depends on its controller (a dial with presets on the PB820SC
  // board), so it has no checked step and the user fills it in.
  test('the Pit Boss 820 is not verified and has no temp step', () => {
    const e = cookers.smokers.find(s => s.id === 'pitboss-820')!;
    expect(e.verified).toBe(false);
    expect(e).not.toHaveProperty('tempStepF');
    expect(smokerFromCatalog('pitboss-820')).toBeNull();
  });

  // T-082: the temp step question.
  test('the question is asked for every type but kamado, drum and offset', () => {
    expect(smokerTypes.filter(([t]) => hasTempStep(t)).map(([t]) => t)).toEqual([
      'pellet',
      'gravity',
      'electric',
      'other',
    ]);
  });

  test('stepChoice and stepNote: the four in the display unit, Other with a line, none for the catalog step in C', () => {
    const s = smokerFromCatalog('pitboss-sportsman-850')!;
    const at = (tempStepF: number | null, tempPresetsF?: number[]) => ({ ...s, tempStepF, tempPresetsF });
    expect([5, 10, 15, 25, 20, 9].map(n => stepChoice(at(n), 'F'))).toEqual(['5', '10', '15', '25', 'other', 'other']);
    // Jason, 2026-11-17 (the branch read): in Celsius only the catalog's own F step shows none. A step the
    // user typed there (20C is stored as 36F) is Other with its line, as in Fahrenheit.
    expect([9, 18, 27, 45, 5, 36].map(n => stepChoice(at(n), 'C'))).toEqual(['5', '10', '15', '25', '', 'other']);
    expect(stepNote(at(36), 'C')).toBe('Sets in 20C steps.');
    const own = { ...at(36), id: 'custom', name: 'My smoker' };
    expect([stepChoice(own, 'C'), stepNote(own, 'C')]).toEqual(['other', 'Sets in 20C steps.']);
    expect(stepChoice({ ...own, tempStepF: 5 }, 'C')).toBe('other');
    expect(stepNote(at(20), 'F')).toBe('Sets in 20F steps.');
    expect(stepNote(at(9), 'F')).toBe('Sets in 9F steps.');
    expect(stepNote(at(5), 'F')).toBeNull();
    expect(stepNote(at(5), 'C')).toBeNull();
    expect(stepNote(at(null, [250, 180, 225]), 'F')).toBe('Has fixed settings: 180, 225, 250F.');
    // Whole degrees, not the 2C set point rounding (82, 108, 122C): dial settings are real dial marks.
    expect(stepNote(at(null, [180, 225, 250]), 'C')).toBe('Has fixed settings: 82, 107, 121C.');
    expect(stepNote(at(null, [176, 221, 248]), 'C')).toBe('Has fixed settings: 80, 105, 120C.');
    expect(stepChoice(at(null, [180, 225]), 'C')).toBe('other');
  });

  // Jason, 2026-11-17 (the branch read): the Other sheet opens with what is saved, when Other is what is saved.
  test('stepSheetStart: a typed step or the dial settings in the display unit; blank for one of the choices', () => {
    const s = smokerFromCatalog('pitboss-sportsman-850')!;
    const at = (tempStepF: number | null, tempPresetsF?: number[]) => ({ ...s, tempStepF, tempPresetsF });
    expect(stepSheetStart(at(20), 'F')).toEqual({ step: '20', presets: '' });
    expect(stepSheetStart(at(36), 'C')).toEqual({ step: '20', presets: '' });
    expect(stepSheetStart(at(null, [250, 180, 225]), 'F')).toEqual({ step: '', presets: '180, 225, 250' });
    expect(stepSheetStart(at(null, [176, 221, 248]), 'C')).toEqual({ step: '', presets: '80, 105, 120' });
    // One of the four, or the catalog step that shows none in Celsius: blank, as mocked (picture 01b).
    expect(stepSheetStart(at(5), 'F')).toEqual({ step: '', presets: '' });
    expect(stepSheetStart(at(9), 'C')).toEqual({ step: '', presets: '' });
    expect(stepSheetStart(at(5), 'C')).toEqual({ step: '', presets: '' });
  });

  test('an unknown or unverified id gives no profile', () => {
    expect(smokerFromCatalog('nope')).toBeNull();
    expect(smokerFromCatalog('traeger-pro-780')).toBeNull();
  });
});
