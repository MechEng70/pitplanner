// node capture2.mjs <outdir>: mockup scenario, Plan + Brisket screenshots with visibility measurements.
import { connect, prefs, screencap } from './phone.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
const out = process.argv[2];
mkdirSync(out, { recursive: true });
const { b, p } = await connect();
const settle = () => p.waitForTimeout(800);
const serve = await p.evaluate(() => new Date(2026, 10, 14, 17, 0).getTime());
const gear = {
  smoker: {
    id: 'pitboss-820',
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
  griddle: { id: 'griddle', name: 'Griddle', sizeIn: 36, burners: 4, hasDome: false, preheatMin: 15 },
};
const items = [
  { id: 'b', foodId: 'brisket', methodId: 'smoked', quantity: 12, options: { wrap: 'paper' }, restMin: 60 },
  { id: 'w', foodId: 'wings', methodId: 'smokeCrisp', quantity: 2, options: { drybrine: 'yes' }, restMin: 5 },
  {
    id: 'c',
    foodId: 'breasts',
    methodId: 'griddle',
    quantity: 4,
    options: { thickness: 'pounded', brine: 'none' },
    restMin: 8,
  },
];
await prefs(p, 'set', 'gear', JSON.stringify(gear));
await prefs(p, 'set', 'rates', JSON.stringify({ brisket: 0.75 }));
await prefs(p, 'set', 'settings', JSON.stringify({ temp: 'F', weight: 'lb' }));
await prefs(p, 'set', 'draft', JSON.stringify({ mode: 'readyBy', at: serve, pitTempF: 225, items }));
await prefs(p, 'remove', 'activeCook'); // the app opens on Cook when one is saved; run.sh restores it
await p.reload();
await p.getByText('On the menu').waitFor();
await settle();

const measure = () =>
  p.evaluate(() => {
    const vis = (el, limit) => {
      const r = el.getBoundingClientRect();
      return r.top >= 0 && r.bottom <= limit + 0.5;
    };
    const foot = document.querySelector('.screen .float-foot').getBoundingClientRect().top;
    const cards = [...document.querySelectorAll('.screen-body > .card')].filter(c => c.querySelector('.avatar'));
    const add = [...document.querySelectorAll('.screen-body .btn')].find(x => x.textContent.includes('Add food'));
    return {
      fontPx: getComputedStyle(document.querySelector('.appbar h1')).fontSize,
      cardsVisible: cards.filter(c => vis(c, foot)).length,
      cards: cards.length,
      addFoodVisible: vis(add, foot),
    };
  });
const plan = await measure();
screencap(`${out}/plan.png`);

await p.getByRole('button', { name: /^Brisket/ }).click();
await settle();
screencap(`${out}/brisket-open.png`);
await p.getByRole('button', { name: 'More trimmed weight' }).click();
await settle();
const brisket = await p.evaluate(() => {
  const body = document.querySelector('.sheet .scroll-body');
  const foot = document.querySelector('.sheet .float-foot').getBoundingClientRect().top;
  const card = document.querySelector('.sheet .card-result').getBoundingClientRect();
  const step = document.querySelector('.sheet .stepper').getBoundingClientRect();
  const top = body.getBoundingClientRect().top;
  return {
    resultFullyVisible: card.top >= top && card.bottom <= foot + 0.5,
    stepperVisible: step.top >= top && step.bottom <= foot,
    stepperOnScreenPx: Math.max(0, Math.min(step.bottom, foot) - Math.max(step.top, top)),
  };
});
screencap(`${out}/brisket-after-plus.png`);
writeFileSync(`${out}/measure.json`, JSON.stringify({ plan, brisket }, null, 1));
console.log(JSON.stringify({ plan, brisket }));
await b.close();
