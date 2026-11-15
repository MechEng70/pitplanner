import { BATTERY_HELP_LINKS, batteryHelpLink, makerKey } from './maker';

// Stand-in links: the real list is not approved yet (T-025 question for Jason).
const links = { samsung: 'https://example.invalid/samsung', oneplus: 'https://example.invalid/oneplus' };

describe('batteryHelpLink', () => {
  test('a Samsung gets its help link, however the phone spells the maker', () => {
    expect(batteryHelpLink('samsung', links)).toBe(links.samsung);
    expect(batteryHelpLink('SAMSUNG', links)).toBe(links.samsung);
    expect(batteryHelpLink(' Samsung ', links)).toBe(links.samsung);
    expect(batteryHelpLink('OnePlus', links)).toBe(links.oneplus);
  });

  test('a Pixel (Google) gets none', () => {
    expect(batteryHelpLink('Google', links)).toBeNull();
  });

  test('an unknown or missing maker gets none', () => {
    expect(batteryHelpLink('Acme', links)).toBeNull();
    expect(batteryHelpLink('', links)).toBeNull();
    expect(batteryHelpLink(null, links)).toBeNull();
    expect(batteryHelpLink(undefined, links)).toBeNull();
    expect(batteryHelpLink('constructor', links)).toBeNull();
    expect(batteryHelpLink('toString', links)).toBeNull();
  });

  test('no link ships until the list is approved', () => {
    expect(BATTERY_HELP_LINKS).toEqual({});
    expect(batteryHelpLink('samsung')).toBeNull();
    expect(batteryHelpLink('Google')).toBeNull();
  });

  test('makerKey trims and lowercases', () => {
    expect(makerKey('  HUAWEI ')).toBe('huawei');
    expect(makerKey(null)).toBe('');
  });
});
