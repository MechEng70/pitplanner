// ESLint rule num-text-size (TECH-DESIGN section 8, font scale rule): times, temps, weights and countdowns
// (`<Num>`) never truncate, shrink or ellipsize at any system font size. Reports the props that would cut
// one, on the Num itself or on any element around it (a clamped Text would cut the Num inside it too).
// Only secondary text may use numberOfLines / clamp.

const CUTS = new Set(['numberOfLines', 'adjustsFontSizeToFit', 'ellipsizeMode', 'maxFontSizeMultiplier', 'clamp']);

const isFalse = value =>
  value?.type === 'JSXExpressionContainer' && value.expression.type === 'Literal' && value.expression.value === false;

/** The attributes of a JSX opening element that would cut or shrink its text. */
function cuts(opening) {
  return opening.attributes.filter(
    a =>
      a.type === 'JSXAttribute' &&
      a.name.type === 'JSXIdentifier' &&
      (CUTS.has(a.name.name) || (a.name.name === 'allowFontScaling' && isFalse(a.value))),
  );
}

const elementName = opening => (opening.name.type === 'JSXIdentifier' ? opening.name.name : 'element');

export default {
  meta: {
    type: 'problem',
    docs: { description: 'Num (times, temps, weights, countdowns) must never truncate or shrink' },
    schema: [],
    messages: {
      onNum: '`{{attr}}` on <Num>: times, temps, weights and countdowns never truncate or shrink (TECH-DESIGN 8).',
      aroundNum:
        '`{{attr}}` on <{{el}}> would cut the <Num> inside it: times, temps, weights and countdowns never truncate (TECH-DESIGN 8).',
    },
  },
  create(context) {
    const reported = new Set();
    const report = (attr, messageId, data) => {
      if (reported.has(attr)) return;
      reported.add(attr);
      context.report({ node: attr, messageId, data });
    };
    return {
      JSXElement(node) {
        const opening = node.openingElement;
        if (elementName(opening) !== 'Num') return;
        for (const a of cuts(opening)) report(a, 'onNum', { attr: a.name.name });
        for (let p = node.parent; p; p = p.parent) {
          if (p.type !== 'JSXElement') continue;
          for (const a of cuts(p.openingElement))
            report(a, 'aroundNum', { attr: a.name.name, el: elementName(p.openingElement) });
        }
      },
    };
  },
};
