import fs from 'fs';
import path from 'path';

import { GRADE_LINES } from '../report';
import {
  ageDecade,
  expenseMessage,
  GENTLE,
  MSG_IN_THE_RED,
  MSG_OVER_30,
  MSG_OVER_80,
  MSG_THIRD_TODAY,
  MSG_WHOLE_INCOME,
  NO_MERCY_TAIL,
  pickRoast,
  ROASTS,
  ROASTS_ANY_CATEGORY,
} from '../roasts';
import { VERDICTS_BY_WORK } from '../afford';
import { at, exp, NOW, seq, state } from './helpers';

// Git on Windows may check the file out with CRLF line endings.
const FORE = fs.readFileSync(path.join(__dirname, '../../../../docs/FORE.md'), 'utf8').replace(/\r\n/g, '\n');

/** Bullet lines under a "### Heading" in FORE.md, with "**[No mercy]** " turned into the code's "!" prefix. */
function foreSection(heading: string): string[] {
  const start = FORE.indexOf('\n### ' + heading + '\n');
  if (start < 0) throw new Error('missing section ' + heading);
  const rest = FORE.slice(start + heading.length + 6);
  const end = rest.search(/\n#{2,3} /);
  return (end < 0 ? rest : rest.slice(0, end))
    .split('\n')
    .filter((l) => l.startsWith('- '))
    .map((l) => l.slice(2).replace(/^\*\*\[No mercy\]\*\* /, '!'));
}

describe('texts match docs/FORE.md exactly', () => {
  test.each(Object.keys(ROASTS))('%s', (cat) => {
    expect(ROASTS[cat]).toEqual(foreSection(cat));
  });

  test('categories without their own lines', () => {
    expect(ROASTS_ANY_CATEGORY).toEqual(foreSection('Categories without their own lines (Rent and user-made categories)').filter((l) => l.includes('{c}')));
  });

  test('special situations, gentle, no mercy, verdicts and grades are in FORE.md word for word', () => {
    const all = [MSG_IN_THE_RED, MSG_OVER_30, MSG_THIRD_TODAY, MSG_WHOLE_INCOME, MSG_OVER_80, ...GENTLE, ...NO_MERCY_TAIL, ...VERDICTS_BY_WORK, ...Object.values(GRADE_LINES)];
    all.forEach((t) => expect(FORE).toContain(t));
  });

  test('the double space in the drunk line is kept', () => {
    expect(ROASTS['Nights out']).toContain('!if you spent that much money i hope that you will  be drunk...at least');
  });
});

describe('ageDecade', () => {
  test.each([
    [24, 20],
    [34, 30],
    [20, 20],
    [19, 0],
    [undefined, 0],
    [150, 0],
  ])('%s -> %s', (age, dec) => expect(ageDecade(age)).toBe(dec));
});

describe('pickRoast', () => {
  test('Normal never shows No mercy lines', () => {
    for (let r = 0; r < 1; r += 0.05) {
      const m = pickRoast('Other', { roast: 1, age: 30 }, () => r);
      expect(m).not.toContain('shi');
      expect(m.startsWith('!')).toBe(false);
    }
  });

  test('No mercy shows a hard line when the 70% roll hits', () => {
    expect(pickRoast('Other', { roast: 2 }, seq(0.1, 0))).toBe("brooo you DON'T need that shi🥀🥀🥀");
  });

  test('No mercy falls back to normal lines 30% of the time', () => {
    expect(pickRoast('Other', { roast: 2 }, seq(0.9, 0))).toBe('you spent today like money grows in your backyard or sum');
  });

  test('age line uses the decade and needs an age of 20+', () => {
    expect(pickRoast('Gaming', { roast: 2, age: 34 }, seq(0.1, 0))).toBe(
      'a grown ahh man buying games at 30+ years old?😭✌️ just ask yourself what are you doing with your life and LOCK IN',
    );
    for (let r = 0; r < 1; r += 0.05) {
      expect(pickRoast('Gaming', { roast: 2, age: 17 }, () => r)).not.toContain('years old');
      expect(pickRoast('Gaming', { roast: 2 }, () => r)).not.toContain('years old');
    }
  });

  test('Rent and own categories use the generic lines with the name', () => {
    expect(pickRoast('Rent', { roast: 1 }, () => 0)).toBe("Rent? again? that's a permanent budget line by now 🥀");
    expect(pickRoast('Vinyl', { roast: 1 }, () => 0.3)).toBe('Vinyl is your favorite way to make money vanish');
  });
});

describe('expenseMessage', () => {
  const msg = (s: ReturnType<typeof state>, rand = () => 0) => expenseMessage(s, s.exp[s.exp.length - 1], NOW, rand);

  test('in the red wins', () => {
    expect(msg(state({ start: 100, exp: [exp(150, 'Food', NOW)] }))).toBe(MSG_IN_THE_RED);
  });

  test('over 30% of everything the user has', () => {
    expect(msg(state({ start: 1000, exp: [exp(301, 'Food', NOW)] }))).toBe(MSG_OVER_30);
    expect(msg(state({ start: 1000, exp: [exp(300, 'Groceries', NOW)] }))).toBe(ROASTS.Groceries[0]);
  });

  test('third expense of the day, but not the fourth', () => {
    const three = [exp(5, 'Coffee', NOW), exp(5, 'Coffee', NOW), exp(5, 'Coffee', NOW)];
    expect(msg(state({ exp: three }))).toBe(MSG_THIRD_TODAY);
    expect(msg(state({ exp: [...three, exp(5, 'Coffee', NOW)] }))).toBe(ROASTS.Coffee[0]);
  });

  test('automatic entries do not count toward the third expense', () => {
    expect(msg(state({ exp: [exp(5, 'Bills', NOW, { auto: true }), exp(5, 'Coffee', NOW), exp(5, 'Coffee', NOW)] }))).toBe(ROASTS.Coffee[0]);
  });

  test('80% and 100% of monthly income', () => {
    expect(msg(state({ start: 5000, income: 1000, exp: [exp(800, 'Food', NOW)] }))).toBe(MSG_OVER_80);
    expect(msg(state({ start: 5000, income: 1000, exp: [exp(600, 'Rent', at(2026, 10, 2)), exp(400, 'Food', NOW)] }))).toBe(MSG_WHOLE_INCOME);
  });

  test('last month does not count toward this month', () => {
    expect(msg(state({ start: 5000, income: 1000, exp: [exp(900, 'Rent', at(2026, 9, 30)), exp(10, 'Food', NOW)] }))).toBe(ROASTS.Food[0]);
  });

  test('Gentle replaces the roast, except in the red', () => {
    expect(GENTLE).toContain(msg(state({ roast: 0, exp: [exp(10, 'Clothes', NOW)] })));
    expect(msg(state({ roast: 0, start: 5, exp: [exp(10, 'Clothes', NOW)] }))).toBe(MSG_IN_THE_RED);
  });

  test('No mercy adds a closing line', () => {
    const m = msg(state({ roast: 2, exp: [exp(10, 'Groceries', NOW)] }));
    expect(m).toBe(ROASTS.Groceries[0] + ' ' + NO_MERCY_TAIL[0]);
  });

  test('category limit warning wins over everything', () => {
    const lim = { Coffee: 20 };
    expect(msg(state({ lim, exp: [exp(15, 'Coffee', NOW)] }))).toBe(ROASTS.Coffee[0]); // under 80%
    expect(msg(state({ lim, exp: [exp(16, 'Coffee', NOW)] }))).toBe('you\'re close to your limit for Coffee: 16 / 20 🥀');
    expect(msg(state({ lim, roast: 0, exp: [exp(15, 'Coffee', NOW), exp(6, 'Coffee', NOW)] }))).toBe('you went over your monthly limit for Coffee (21 / 20) 🥀🥀');
  });
});
