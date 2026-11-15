import { summarize } from '../finish';
import { logsOf } from '../history';
import { pending } from '../cook';
import { rules } from '../rules';
import { BLEND_RECORDS, finishedCook, MOCKUP_MENU } from './finishedCook';
import { saturday } from './saturday';

const input = { ...saturday, items: MOCKUP_MENU };

describe('finishedCook (the dev seeds for Cook finished)', () => {
  it('leaves only Serve to do', () => {
    const left = pending(finishedCook(input, { b: -25, c: 3 }));
    expect(left.map(k => k.event.kind)).toEqual(['serve']);
    expect(left[0]!.event.at).toBe(saturday.at);
  });

  it('reads as mockup 15: brisket 25 min ahead, wings on plan, breasts 3 min behind, the saved rate held', () => {
    const s = summarize(rules, finishedCook(input, { b: -25, c: 3 }), saturday.at);
    expect(s.rows.map(r => [r.name, r.plannedMin, r.actualMin, r.verdict.text])).toEqual([
      ['Brisket', 540, 515, '25 min ahead'],
      ['Chicken wings', 100, 100, 'On plan'],
      ['Chicken breasts', 12, 15, '3 min behind'],
    ]);
    expect(s.rates).toHaveLength(1);
    expect(s.rates[0]).toMatchObject({ foodName: 'Brisket', kind: 'waiting', before: 0.75, after: 0.75 });
  });

  it('with three logged briskets and this one an hour early the rate moves', () => {
    const cook = finishedCook({ ...input, history: logsOf(BLEND_RECORDS) }, { b: -60, c: 3 });
    const [rate] = summarize(rules, cook, saturday.at).rates;
    expect(rate).toMatchObject({ kind: 'blended', cooksLogged: 4 });
    expect(rate!.before.toFixed(2)).toBe('0.75');
    expect(rate!.after.toFixed(2)).toBe('0.74');
  });
});
