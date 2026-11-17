import cookers from '../../data/cookers.json';
import { catalogSmokers, smokerFromCatalog } from './gear';

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

  test('an unknown or unverified id gives no profile', () => {
    expect(smokerFromCatalog('nope')).toBeNull();
    expect(smokerFromCatalog('traeger-pro-780')).toBeNull();
  });
});
