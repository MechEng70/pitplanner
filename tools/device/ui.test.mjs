import assert from 'node:assert/strict';
import { test } from 'node:test';
import { findByLabel, keyboardProblems, movedAbove, notAbove, parseDump, unequalWidths } from './ui.mjs';

const node = (attrs, kids = '') =>
  `<node class="${attrs.cls ?? 'android.view.View'}" text="${attrs.text ?? ''}" content-desc="${attrs.desc ?? ''}" ` +
  `clickable="${attrs.click ? 'true' : 'false'}" focused="${attrs.focused ? 'true' : 'false'}" ` +
  `bounds="${attrs.b}"${kids ? `>${kids}</node>` : ' />'}`;
const dump = body =>
  `<?xml version='1.0' encoding='UTF-8' standalone='yes' ?><hierarchy rotation="0">${body}</hierarchy>`;

// A stepper screen: title, a value row above the stepper, the stepper (Less, value, More), a note below.
const screen = ({
  value = '0.75',
  valueB = '[200,500][1240,600]',
  moreB = '[1240,500][1376,600]',
  title = '[64,100][1376,200]',
  note = '',
} = {}) =>
  dump(
    node(
      { b: '[0,0][1440,3168]' },
      node({ text: 'Plan', b: title }) +
        node(
          { b: '[64,480][1376,620]' },
          node({ desc: 'Less', click: true, b: '[64,500][200,600]' }) +
            node({ text: value, b: valueB }) +
            node({ desc: 'More', click: true, b: moreB }),
        ) +
        (note ? node({ text: note, b: '[64,700][1376,780]' }) : ''),
    ),
  );

test('parseDump gives tree paths, labels and bounds', () => {
  const nodes = parseDump(screen());
  assert.deepEqual(
    nodes.map(n => n.path),
    ['0', '0/0', '0/1', '0/1/0', '0/1/1', '0/1/2'],
  );
  const more = findByLabel(nodes, 'More');
  assert.equal(more.path, '0/1/2');
  assert.deepEqual(more.b, { l: 1240, t: 500, r: 1376, b: 600 });
});

test('findByLabel prefers the clickable node or the text field over a label with the same text', () => {
  const nodes = parseDump(
    dump(
      node({ text: 'Weight', b: '[0,0][10,10]' }) +
        node({ cls: 'android.widget.EditText', desc: 'Weight', b: '[0,20][10,30]' }),
    ),
  );
  assert.equal(findByLabel(nodes, 'Weight').cls, 'android.widget.EditText');
});

test('stable-controls: a changed value with the same bounds passes; text is not identity', () => {
  assert.deepEqual(movedAbove(parseDump(screen()), parseDump(screen({ value: '1.00' })), 'More'), []);
});

test('stable-controls: a note appearing below the control passes', () => {
  assert.deepEqual(movedAbove(parseDump(screen()), parseDump(screen({ note: 'Long cook' })), 'More'), []);
});

test('stable-controls: the tapped control moving fails', () => {
  const moved = movedAbove(parseDump(screen()), parseDump(screen({ moreB: '[1260,500][1376,600]' })), 'More');
  assert.deepEqual(moved, ['moved: More [1240,500][1376,600] -> [1260,500][1376,600]']);
});

test('stable-controls: something above the control moving fails', () => {
  const moved = movedAbove(parseDump(screen()), parseDump(screen({ title: '[64,100][1376,260]' })), 'More');
  assert.deepEqual(moved, ['moved: Plan [64,100][1376,200] -> [64,100][1376,260]']);
});

test('stable-controls: a value in the same row changing width fails (proportional digits recentering)', () => {
  // The value text is shorter than the buttons, so it starts below their top edge but is in their row.
  const moved = movedAbove(
    parseDump(screen({ valueB: '[600,520][840,580]' })),
    parseDump(screen({ value: '1.00', valueB: '[596,520][844,580]' })),
    'More',
  );
  assert.deepEqual(moved, ['moved: 0.75 [600,520][840,580] -> [596,520][844,580]']);
});

test('stable-controls: a clamp jump names the nodes that really moved, even when the tree shifts', () => {
  // Scrolled to the end; the content shrinks, the view clamps and everything drops 188 px. A node that was cut
  // off at the top comes back into the tree first, so tree paths no longer line up.
  const before = dump(
    node(
      { b: '[0,0][1440,3168]' },
      node({ text: 'Plan', b: '[64,160][1376,200]' }) +
        node({ desc: 'Less', click: true, b: '[64,1382][200,1574]' }) +
        node({ desc: 'More', click: true, b: '[1096,1382][1288,1574]' }),
    ),
  );
  const after = dump(
    node(
      { b: '[0,0][1440,3168]' },
      node({ text: 'Smoker temp', b: '[64,160][1376,240]' }) +
        node({ text: 'Plan', b: '[64,348][1376,388]' }) +
        node({ desc: 'Less', click: true, b: '[64,1570][200,1762]' }) +
        node({ desc: 'More', click: true, b: '[1096,1570][1288,1762]' }),
    ),
  );
  assert.deepEqual(movedAbove(parseDump(before), parseDump(after), 'More'), [
    'moved: Plan [64,160][1376,200] -> [64,348][1376,388]',
    'moved: Less [64,1382][200,1574] -> [64,1570][200,1762]',
    'moved: More [1096,1382][1288,1574] -> [1096,1570][1288,1762]',
    'new: Smoker temp [64,160][1376,240]',
  ]);
});

test('stable-controls: an unlabeled view moving (an empty avatar) still fails, as one line', () => {
  const before = dump(
    node({ b: '[64,100][200,200]' }) + node({ desc: 'More', click: true, b: '[1240,500][1376,600]' }),
  );
  const after = dump(node({ b: '[64,120][200,220]' }) + node({ desc: 'More', click: true, b: '[1240,500][1376,600]' }));
  assert.deepEqual(movedAbove(parseDump(before), parseDump(after), 'More'), ['moved: 1 unlabeled view(s)']);
});

test('stable-controls: a control that is not on screen is reported', () => {
  assert.deepEqual(movedAbove(parseDump(screen()), parseDump(screen()), 'Nope'), ['"Nope" is not on screen']);
});

// A sheet with the keyboard open at y=2056.
const sheet = ({ fieldB = '[64,1400][1376,1608]', saveB = '[64,1768][1376,1992]', focused = 'Weight' } = {}) =>
  parseDump(
    dump(
      node({ cls: 'android.widget.EditText', desc: 'Name', focused: focused === 'Name', b: '[64,568][1376,776]' }) +
        node({ cls: 'android.widget.EditText', desc: 'Weight', focused: focused === 'Weight', b: fieldB }) +
        node({ cls: 'android.widget.Button', desc: 'Save', click: true, b: saveB }),
    ),
  );
const kb = { field: 'Weight', footer: 'Save', imeTop: 2056, topPx: 160 };

test('sheet-keyboard: field and footer above the keyboard pass', () => {
  assert.deepEqual(keyboardProblems(sheet(), kb), []);
});

test('sheet-keyboard: a footer under the keyboard fails', () => {
  assert.match(
    keyboardProblems(sheet({ saveB: '[64,2880][1376,3104]' }), kb)[0],
    /footer "Save" .* under the keyboard/,
  );
});

test('sheet-keyboard: a field behind the footer fails (the first device result before the fix)', () => {
  assert.match(keyboardProblems(sheet({ fieldB: '[64,1848][1376,2056]' }), kb)[0], /field "Weight" .* hidden/);
});

test('sheet-keyboard: the wrong field focused, or no keyboard, fails', () => {
  assert.match(keyboardProblems(sheet({ focused: 'Name' }), kb)[0], /focused field is "Name"/);
  assert.deepEqual(keyboardProblems(sheet(), { ...kb, imeTop: undefined }), ['the keyboard is not open']);
});

// T-017: the Plan tiles (PR-4) and what fits above the pinned Start cook.
const plan = ({ pellets = '[504,2000][936,2180]', addFood = '[96,1500][1344,1644]' } = {}) =>
  parseDump(
    dump(
      node(
        { b: '[0,0][1440,3168]' },
        node({ desc: 'Brisket, edit', click: true, b: '[96,900][1344,1116]' }) +
          node({ desc: 'Add food', click: true, b: addFood }) +
          node(
            { desc: 'Fire smoker 6:20 AM', b: '[48,2000][480,2180]' },
            node({ text: 'Fire smoker', b: '[84,2036][300,2090]' }),
          ) +
          node({ desc: 'Pellets ~18 lb', b: pellets }) +
          node({ desc: 'Conflicts None', click: true, b: '[960,2000][1392,2180]' }) +
          node({ desc: 'Start cook', click: true, b: '[96,1700][1344,1868]' }),
      ),
    ),
  );
const TILES = ['Fire smoker', 'Pellets', 'Conflicts'];

test('widths: three tiles in equal thirds pass, whatever their values', () => {
  assert.deepEqual(unequalWidths(plan(), TILES, 3), []);
});

test('widths: a tile wider than the others, on another row, or missing is reported', () => {
  assert.match(
    unequalWidths(plan({ pellets: '[504,2000][990,2180]' }), TILES, 3).join(),
    /widths differ: .*Pellets 486 px/,
  );
  assert.match(unequalWidths(plan({ pellets: '[504,2200][936,2380]' }), TILES, 3).join(), /not on one row/);
  assert.deepEqual(unequalWidths(plan(), [...TILES, 'Serve'], 3), ['"Serve" is not on screen']);
});

test('widths: 1 dp of rounding is allowed, more is not', () => {
  assert.deepEqual(unequalWidths(plan({ pellets: '[504,2000][939,2180]' }), TILES, 3), []);
  assert.equal(unequalWidths(plan({ pellets: '[504,2000][940,2180]' }), TILES, 3).length, 1);
});

test('above: controls that end above the pinned button pass; one that runs under it is reported', () => {
  assert.deepEqual(notAbove(plan(), ['Brisket, edit', 'Add food'], 'Start cook'), []);
  assert.deepEqual(notAbove(plan({ addFood: '[96,1600][1344,1744]' }), ['Brisket, edit', 'Add food'], 'Start cook'), [
    '"Add food" ends at 1744 px, below the top of "Start cook" (1700 px)',
  ]);
  assert.deepEqual(notAbove(plan(), ['Chicken wings, edit'], 'Start cook'), ['"Chicken wings, edit" is not on screen']);
});
