import { revealOffset } from './reveal';

// A scroll view on screen from y=100 to y=700, a 100 dp footer floating over its bottom: visible to y=600.
const view = { top: 100, visibleHeight: 500 };

describe('revealOffset', () => {
  test('a field fully in the visible part needs no scroll', () => {
    expect(revealOffset({ contentTop: 300, winTop: 200, height: 52 }, view, 16)).toBeNull();
  });

  test('a field under the footer scrolls up until its bottom clears it by the margin', () => {
    // contentTop 860 shown at winTop 560: offset 400.
    // Its bottom (612) is 12 below the visible end (600): scroll by 12 + 16 to 428.
    expect(revealOffset({ contentTop: 860, winTop: 560, height: 52 }, view, 16)).toBe(428);
  });

  test('a field above the top edge scrolls down to show its top with the margin', () => {
    // contentTop 200 at winTop 80: offset 220. Show it at 100 + 16: offset 184.
    expect(revealOffset({ contentTop: 200, winTop: 80, height: 52 }, view, 16)).toBe(184);
  });

  test('never scrolls above the start of the content', () => {
    expect(revealOffset({ contentTop: 4, winTop: 90, height: 52 }, view, 16)).toBe(0);
  });

  test('a field taller than the visible part shows its top', () => {
    expect(revealOffset({ contentTop: 1000, winTop: 400, height: 600 }, view, 16)).toBe(984);
  });
});
