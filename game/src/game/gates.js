// Kapije: šta svaka radi sa brojem vojnika.

export const GOOD_OPS = [
  { type: 'add', value: 10 },
  { type: 'add', value: 20 },
  { type: 'mul', value: 2 },
  { type: 'mul', value: 3 },
];

export const BAD_OPS = [
  { type: 'sub', value: 5 },
  { type: 'sub', value: 10 },
  { type: 'div', value: 2 },
];

export function isGood(op) {
  return op.type === 'add' || op.type === 'mul';
}

export function applyOp(count, op) {
  switch (op.type) {
    case 'add':
      return count + op.value;
    case 'sub':
      return Math.max(0, count - op.value);
    case 'mul':
      return count * op.value;
    case 'div':
      return Math.floor(count / op.value);
    default:
      return count;
  }
}

// Tekst na kapiji. Koristimo znakove koje naš "pikselni" font zna da nacrta.
export function opLabel(op) {
  const sign = { add: '+', sub: '-', mul: 'x', div: '/' }[op.type];
  return sign + op.value;
}
