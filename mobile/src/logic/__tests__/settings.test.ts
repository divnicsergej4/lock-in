// More tab: Settings and Backup behave like the prototype's handlers (n-go, st-c2, st-age, bk-in, reset, remChk).

import { backupText, importBackup, reminderDue, resetAll, setAge, setIncome, setReminder, setReminderTime, setSecondCurrency } from '../settings';
import { initialState } from '../types';

import { at, exp, state } from './helpers';

describe('Settings', () => {
  test('monthly salary: only a positive amount', () => {
    expect(setIncome(state(), '')).toEqual({ ok: false, error: 'Enter income amount' });
    expect(setIncome(state(), '0')).toEqual({ ok: false, error: 'Enter income amount' });
    const r = setIncome(state(), '1,800');
    expect(r.ok && r.state.income).toBe(1800);
    expect(r.ok && r.toast).toBe('Income saved 💰');
  });

  test('second currency: different from the main one, new one starts at the typed balance', () => {
    expect(setSecondCurrency(state({ cur: 'EUR' }), 'EUR', '10')).toEqual({ ok: false, error: 'Pick a currency different from your main one' });
    const a = setSecondCurrency(state({ cur: 'EUR' }), 'RSD', '');
    expect(a.ok && [a.state.cur2, a.state.start2]).toEqual(['RSD', 0]);
    const b = setSecondCurrency(state({ cur: 'EUR' }), 'RSD', '12000');
    expect(b.ok && [b.state.cur2, b.state.start2]).toEqual(['RSD', 12000]);
    // same currency again: the balance changes only when one is typed
    const c = setSecondCurrency(state({ cur: 'EUR', cur2: 'RSD', start2: 500 }), 'RSD', '');
    expect(c.ok && c.state.start2).toBe(500);
    const d = setSecondCurrency(state({ cur: 'EUR', cur2: 'RSD', start2: 500 }), 'RSD', '700');
    expect(d.ok && d.state.start2).toBe(700);
    const e = setSecondCurrency(state({ cur: 'EUR', cur2: 'RSD', start2: 500 }), '', '');
    expect(e.ok && e.state.cur2).toBeNull();
    expect(e.ok && e.toast).toBe('Second currency saved');
  });

  test('age: 10–119 kept, anything else cleared', () => {
    expect(setAge(state(), '24').state.age).toBe(24);
    expect(setAge(state(), '24').field).toBe('24');
    expect(setAge(state({ age: 30 }), '9').state.age).toBeUndefined();
    expect(setAge(state({ age: 30 }), '').field).toBe('');
    expect(setAge(state(), '120').state.age).toBeUndefined();
  });

  test('backup: export and import round-trip, bad text refused', () => {
    const s = state({ exp: [exp(12, 'Coffee', at(2026, 10, 2))], income: 900 });
    const r = importBackup(backupText(s));
    expect(r.ok && r.state).toEqual({ ...s, v: 1 });
    expect(importBackup('hello')).toEqual({ ok: false, error: "That text isn't a valid backup" });
    expect(importBackup('{"start":"5","exp":[]}').ok).toBe(false);
    expect(importBackup('{"start":5}').ok).toBe(false);
    // an older backup gets the fields it lacks
    const old = importBackup('{"start":5,"exp":[]}');
    expect(old.ok && old.state.plan).toEqual(initialState.plan);
  });

  test('reset: a brand-new app', () => {
    const r = resetAll();
    expect(r.ok && r.state).toEqual(initialState);
    expect(r.ok && r.toast).toBe('Everything deleted. Fresh start!');
  });

  test('reminder: shown after its time when nothing was logged today', () => {
    const on = setReminder(state(), true);
    expect(on.ok && on.state.rem).toEqual({ on: true, time: '20:00' });
    expect(on.ok && on.toast).toBe('Reminder on');
    const s = setReminderTime(on.ok ? on.state : state(), '19:30');
    expect(reminderDue(s, at(2026, 10, 22, 19, 29))).toBe(false);
    expect(reminderDue(s, at(2026, 10, 22, 19, 30))).toBe(true);
    // something logged today, checked in, answered, or switched off: not shown
    expect(reminderDue({ ...s, exp: [exp(3, 'Coffee', at(2026, 10, 22, 9))] }, at(2026, 10, 22, 21))).toBe(false);
    expect(reminderDue({ ...s, chk: { '2026-10-22': 1 } }, at(2026, 10, 22, 21))).toBe(false);
    expect(reminderDue({ ...s, remDis: '2026-10-22' }, at(2026, 10, 22, 21))).toBe(false);
    const off = setReminder(s, false);
    expect(off.ok && reminderDue(off.state, at(2026, 10, 22, 21))).toBe(false);
    expect(off.ok && off.state.rem!.time).toBe('19:30');
  });
});
