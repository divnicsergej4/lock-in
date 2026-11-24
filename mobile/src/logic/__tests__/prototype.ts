// Runs the real prototype code (index.html at the repo root, same as on `razvoj`) inside Node,
// so tests can check that the TypeScript port gives the same results.
// Functions are cut out of the prototype's <script> by name; the DOM is replaced by small stubs.
// Text the prototype shows goes through its own translator (trT, applied per text node), exactly
// like its MutationObserver does in the browser.

import fs from 'fs';
import path from 'path';
import vm from 'vm';

const HTML = fs.readFileSync(path.join(__dirname, '../../../../index.html'), 'utf8').replace(/\r\n/g, '\n');
const SCRIPT = (() => {
  const a = HTML.indexOf('// Okvirni kursevi');
  const b = HTML.indexOf('</script>', a);
  if (a < 0 || b < 0) throw new Error('prototype script not found');
  return HTML.slice(a, b);
})();

// ---- a small JS scanner: skips strings, comments and regex literals while matching brackets ----

function skipString(s: string, i: number): number {
  const q = s[i];
  for (i++; i < s.length; i++) {
    if (s[i] === '\\') i++;
    else if (s[i] === q) return i;
  }
  throw new Error('unterminated string');
}

function skipRegex(s: string, i: number): number {
  let cls = false;
  for (i++; i < s.length; i++) {
    const c = s[i];
    if (c === '\\') i++;
    else if (c === '[') cls = true;
    else if (c === ']') cls = false;
    else if (c === '/' && !cls) break;
  }
  while (/[a-z]/.test(s[i + 1])) i++;
  return i;
}

/** Scans from `i` and returns the index just past the end: the closing bracket of the first bracket
 *  opened (mode 'block'), or the first `;` at depth 0 (mode 'statement'). */
function scan(s: string, i: number, mode: 'block' | 'statement'): number {
  let depth = 0;
  let prev = ';';
  let word = '';
  for (; i < s.length; i++) {
    const c = s[i];
    if (c === '"' || c === "'" || c === '`') {
      i = skipString(s, i);
      prev = 'a';
      word = '';
      continue;
    }
    if (c === '/' && s[i + 1] === '/') {
      i = s.indexOf('\n', i);
      continue;
    }
    if (c === '/' && s[i + 1] === '*') {
      i = s.indexOf('*/', i) + 1;
      continue;
    }
    if (c === '/' && ('(,=:[!&|?{};+-*%<>~^'.includes(prev) || word === 'return' || word === 'typeof')) {
      i = skipRegex(s, i);
      prev = 'a';
      word = '';
      continue;
    }
    if (c === '{' || c === '(' || c === '[') depth++;
    else if (c === '}' || c === ')' || c === ']') {
      depth--;
      if (mode === 'block' && depth === 0 && c === '}') return i + 1;
    } else if (c === ';' && depth === 0 && mode === 'statement') return i + 1;
    if (/[A-Za-z0-9_$]/.test(c)) {
      word = prev === 'w' ? word + c : c;
      prev = 'w';
    } else if (!/\s/.test(c)) {
      prev = c;
      word = '';
    }
  }
  throw new Error('unbalanced code');
}

/** `function name(...){...}` */
export function fnSource(name: string): string {
  const re = new RegExp('(?:^|[^\\w$.])(function ' + name.replace(/\$/g, '\\$') + '\\()', 'm');
  const m = re.exec(SCRIPT);
  if (!m) throw new Error('prototype: no function ' + name);
  const start = m.index + m[0].indexOf('function');
  const body = SCRIPT.indexOf('{', SCRIPT.indexOf(')', start));
  return SCRIPT.slice(start, scan(SCRIPT, body, 'block'));
}

/** A statement starting with `prefix` (e.g. "var TIERS=" or "M.soft="), up to its `;`. */
export function stmtSource(prefix: string): string {
  const i = SCRIPT.indexOf(prefix);
  if (i < 0) throw new Error('prototype: no statement ' + prefix);
  return SCRIPT.slice(i, scan(SCRIPT, i, 'statement'));
}

/** `$('id').prop=function(...){...}` as a function expression. */
export function handlerSource(id: string, prop = 'onclick'): string {
  const head = "$('" + id + "')." + prop + '=';
  const i = SCRIPT.indexOf(head);
  if (i < 0) throw new Error('prototype: no handler ' + id);
  const start = i + head.length;
  const body = SCRIPT.indexOf('{', SCRIPT.indexOf(')', start));
  return SCRIPT.slice(start, scan(SCRIPT, body, 'block'));
}

// ---- DOM stubs ----

export class El {
  innerHTML = '';
  value = '';
  checked = false;
  className = '';
  dataset: Record<string, string> = {};
  style: Record<string, unknown> = { setProperty() {} };
  parentNode: { style: { setProperty(): void } } = { style: { setProperty() {} } };
  private cls = new Set<string>();
  classList = {
    add: (c: string) => void this.cls.add(c),
    remove: (c: string) => void this.cls.delete(c),
    toggle: (c: string, on?: boolean) => {
      const v = on === undefined ? !this.cls.has(c) : on;
      if (v) this.cls.add(c);
      else this.cls.delete(c);
      return v;
    },
    contains: (c: string) => this.cls.has(c),
  };
  constructor(public id: string) {}
  get textContent() {
    return this.innerHTML;
  }
  set textContent(t: string) {
    this.innerHTML = String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  }
  clientWidth = 292;
  querySelector() {
    // enough of an element for code that wires up events on what it just drew
    return { addEventListener() {}, setAttribute() {}, getBoundingClientRect: () => ({ left: 0, top: 0 }), querySelector: () => null, style: {} };
  }
  querySelectorAll() {
    return [];
  }
  setAttribute() {}
  getAttribute() {
    return null;
  }
  focus() {}
  select() {}
  get isConnected() {
    return true;
  }
}

// ---- translation, exactly as the prototype shows text ----

const translator = (() => {
  const ctx: Record<string, unknown> = {};
  vm.createContext(ctx);
  vm.runInContext(stmtSource('var TR=') + stmtSource('TR.forEach(') + fnSource('trT') + ';this.trT=trT;', ctx);
  return ctx.trT as (t: string) => string;
})();

export const trT = translator;

const decode = (t: string) => t.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');

/**
 * What the user sees for a piece of prototype HTML: every text node translated on its own
 * (text inside [data-nt] is left as is), <br> and block ends become line breaks, spaces collapse
 * like in the browser. Returns the non-empty lines.
 */
export function shown(html: string): string[] {
  const out: string[] = [];
  const nt: boolean[] = [];
  const re = /<(\/?)([a-zA-Z0-9]+)([^>]*)>|([^<]+)/g;
  let m: RegExpExecArray | null;
  let ntDepth = 0;
  while ((m = re.exec(html))) {
    if (m[4] != null) {
      const t = decode(m[4]);
      out.push(ntDepth ? t : translator(t));
      continue;
    }
    const [, close, tag, attrs] = m;
    const lower = tag.toLowerCase();
    const voidTag = ['br', 'input', 'img', 'path', 'circle', 'rect', 'polyline'].includes(lower) || attrs.trim().endsWith('/');
    if (lower === 'br') {
      out.push('\n');
      continue;
    }
    if (close) {
      const was = nt.pop();
      if (was) ntDepth--;
      if (['div', 'p', 'li', 'ul'].includes(lower)) out.push('\n');
    } else if (!voidTag) {
      const isNt = /\sdata-nt\b/.test(attrs);
      nt.push(isNt);
      if (isNt) ntDepth++;
    }
  }
  return out
    .join('')
    .split('\n')
    .map((l) => l.replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean);
}

/** Plain text shown for a textContent value (one text node). */
export const shownText = (t: string) => translator(t);

// ---- the prototype sandbox ----

const DATA = [
  'var R=',
  'var BASE=',
  'var M=',
  'M.Ostalo=',
  'M.C=',
  'M.soft=',
  'M.hard=',
  'var NEC=',
  'var TIERS=',
  'var CC=',
].map(stmtSource);

const FUNCS = [
  'L', 'fmt', 'fmt0', 'esc', 'pick', 'day0', 'dAdd', 'dk', 'mk', 'dn', 'den', 'tkStart', 'tank', 'streakInfo', 'streak',
  'catStreak', 'checkIn', 'curBal', 'envSum', 'freeBal', 'getInc', 'totalSpent', 'dys', 'isNeed', 'mcat', 'monthSpent',
  'todayCount', 'pickM', 'ageDec', 'upcomingFixed', 'rateTo', 'rateTxt', 'dd', 'tierOf', 'streakCard', 'extra', 'more',
  'lims', 'todayCard', 'dayIO', 'dnRender', 'lnRender', 'cal', 'txRender', 'cc', 'recProcess', 'planCalc', 'planRender', 'conv', 'bal2', 'envGoal', 'pace', 'envCard', 'num', 'cats', 'migrate',
  'demoData',
].map(fnSource);

const HANDLERS: [string, string][] = [
  ['e-go', 'onclick'],
  ['a-go', 'onclick'],
  ['w-go', 'onclick'],
  ['l-go', 'onclick'],
  ['r-go', 'onclick'],
  ['en-go', 'onclick'],
  ['env-list', 'onclick'],
  ['hist', 'onclick'],
  ['ed-ok', 'onclick'],
  ['s-go', 'onclick'],
];

const CODE =
  DATA.join('\n') +
  '\n' +
  FUNCS.join('\n') +
  '\nvar __h={};' +
  HANDLERS.map(([id, p]) => '__h[' + JSON.stringify(id) + ']=' + handlerSource(id, p) + ';').join('\n') +
  '\nthis.__h=__h;';

export interface Proto {
  /** The prototype's S (its state). Set it before calling anything. */
  S: Record<string, any>;
  /** Calls a prototype function by name. */
  call: (name: string, ...args: unknown[]) => any;
  /** Fills inputs (by id) and runs a button handler. */
  click: (id: string, inputs?: Record<string, string | boolean>, event?: unknown) => void;
  /** An element the prototype wrote to. */
  el: (id: string) => El;
  toasts: string[];
  set: (name: string, v: unknown) => void;
}

export function prototype(now: number, rand: () => number = Math.random): Proto {
  const els = new Map<string, El>();
  const el = (id: string) => {
    let e = els.get(id);
    if (!e) els.set(id, (e = new El(id)));
    return e;
  };
  const toasts: string[] = [];
  const RealDate = Date;
  class FakeDate extends RealDate {
    constructor(...a: any[]) {
      if (a.length === 0) super(now);
      else super(...(a as [number]));
    }
    static now() {
      return now;
    }
  }
  const noop = () => {};
  const ctx: Record<string, any> = {
    console,
    $: el,
    Date: FakeDate,
    Math: Object.assign(Object.create(Math), { random: rand }),
    toast: (t: string) => toasts.push(t),
    save: noop,
    track: noop,
    render: noop,
    sheet: noop,
    envRender: noop,
    setTimeout: (f: () => void) => f(),
    clearTimeout: noop,
    requestAnimationFrame: noop,
    navigator: {},
    document: { documentElement: { getAttribute: () => 'dark' }, querySelector: () => null, querySelectorAll: () => [] },
    qa: () => [],
    em: () => '<span class="ei"></span>',
    tile: () => '<span class="ic"></span>',
    flameSVG: () => '',
    isLight: () => false,
    TCL: {},
    TCD: {},
    LV: [],
    DN: ['nedelja', 'ponedeljak', 'utorak', 'sreda', 'četvrtak', 'petak', 'subota'],
    DEMO: false,
    RM: true,
    eCur: 'm',
    aCur: 'm',
    envMode: {},
    envOpen: -1,
    fpAnim: false,
    pks: [],
    edK: '',
    // extra() calls these first; they are tested on their own
    incInfo: noop,
    dnRender: noop,
    hFit: noop,
    recRender: noop,
    remChk: noop,
    cur2Render: noop,
    closeEnv: noop,
    flyBusy: null,
    isvg: () => '<svg></svg>',
    dsel: null,
    dks: [],
    lnH: 176,
    lnLen: 0,
    lnHold: null,
    tf: 'all',
    cy: 2026,
    cm0: 0,
    pw: noop,
    // translation happens in shown() / trT, like the browser's MutationObserver
    trDom: noop,
    fxDom: noop,
  };
  vm.createContext(ctx);
  vm.runInContext(CODE, ctx);
  // the prototype's own extra() would also run these; keep them as stubs unless a test calls them directly
  const real = { more: ctx.more, lims: ctx.lims, streakCard: ctx.streakCard, planRender: ctx.planRender };
  return {
    get S() {
      return ctx.S;
    },
    set S(v) {
      ctx.S = v;
    },
    call: (name, ...args) => (name in real ? (real as any)[name] : ctx[name])(...args),
    click: (id, inputs = {}, event) => {
      Object.entries(inputs).forEach(([k, v]) => {
        if (typeof v === 'boolean') el(k).checked = v;
        else el(k).value = v;
      });
      ctx.__h[id](event);
    },
    el,
    toasts,
    set: (name, v) => {
      ctx[name] = v;
    },
  } as Proto;
}

/** English category names of the app → the prototype's internal (Serbian) ones. */
export const TO_PROTO: Record<string, string> = {
  Groceries: 'Namirnice',
  Food: 'Hrana',
  Coffee: 'Kafić',
  Clothes: 'Odeća',
  Shoes: 'Obuća',
  Gym: 'Teretana',
  Transportation: 'Prevoz',
  Bills: 'Računi',
  Rent: 'Kirija',
  'Nights out': 'Izlasci',
  Gaming: 'Igrice',
  Other: 'Ostalo',
  Subscription: 'Pretplata',
  Salary: 'Plata',
  Gift: 'Poklon',
};
