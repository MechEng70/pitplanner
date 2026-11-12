// Unit test for the num-text-size ESLint rule (T-005). Runs under node --test (npm run test:gate).
import { describe, it } from 'node:test';
import { RuleTester } from 'eslint';
import { parser } from 'typescript-eslint';
import rule from './num-text-size.js';

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const tester = new RuleTester({
  languageOptions: { parser, parserOptions: { ecmaFeatures: { jsx: true } } },
});

tester.run('num-text-size', rule, {
  valid: [
    { code: '<Num>6:20 AM</Num>' },
    { code: '<Text variant="tile"><Num>{value}</Num></Text>' },
    { code: '<Text numberOfLines={1}>Brisket, 12 lb packer</Text>', name: 'secondary text may be clamped' },
    { code: '<Text clamp>{subtitle}</Text>' },
    { code: '<Num allowFontScaling>225F</Num>', name: 'allowFontScaling true is the default' },
    {
      code: '<View><Text clamp>{name}</Text><Text><Num>{time}</Num></Text></View>',
      name: 'a clamped sibling does not cut the Num',
    },
  ],
  invalid: [
    { code: '<Num numberOfLines={1}>6:20 AM</Num>', errors: [{ messageId: 'onNum' }] },
    { code: '<Num adjustsFontSizeToFit>6:20 AM</Num>', errors: [{ messageId: 'onNum' }] },
    { code: '<Num ellipsizeMode="tail">6:20 AM</Num>', errors: [{ messageId: 'onNum' }] },
    { code: '<Num maxFontSizeMultiplier={1.2}>6:20 AM</Num>', errors: [{ messageId: 'onNum' }] },
    { code: '<Num allowFontScaling={false}>6:20 AM</Num>', errors: [{ messageId: 'onNum' }] },
    { code: '<Num clamp>6:20 AM</Num>', errors: [{ messageId: 'onNum' }] },
    {
      code: '<Text numberOfLines={1}>Fire at <Num>{time}</Num></Text>',
      errors: [{ messageId: 'aroundNum', data: { attr: 'numberOfLines', el: 'Text' } }],
    },
    {
      code: '<Text adjustsFontSizeToFit><Num>{a}</Num> to <Num>{b}</Num></Text>',
      errors: [{ messageId: 'aroundNum' }],
      name: 'one report per attribute, however many Nums',
    },
    {
      code: '<Card><Text clamp>{items.map(i => <Num key={i}>{i}</Num>)}</Text></Card>',
      errors: [{ messageId: 'aroundNum', data: { attr: 'clamp', el: 'Text' } }],
    },
  ],
});
