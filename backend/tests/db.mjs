// A throwaway Postgres in memory (PGlite) with the Supabase stand-in and every migration applied, plus the helpers
// the tests share. Runs on Windows, macOS and Linux with only Node installed.
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = path.join(HERE, '..', 'supabase', 'migrations');

export async function freshDb() {
  const db = new PGlite();
  await db.exec(fs.readFileSync(path.join(HERE, 'supabase_shim.sql'), 'utf8'));
  for (const f of fs.readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
    await db.exec(fs.readFileSync(path.join(MIGRATIONS, f), 'utf8'));
  }
  return db;
}

// Output the way `psql -At` prints it: columns joined by |, rows by new lines.
function text(results) {
  const fmt = (v) => (v === null || v === undefined ? '' : v === true ? 't' : v === false ? 'f' : String(v));
  return results.flatMap((r) => r.rows.map((row) => Object.values(row).map(fmt).join('|'))).join('\n');
}

export function helpers(db) {
  let fails = 0;

  // Run sql as the database owner (like the SQL editor or the server). Returns [ok, out, err].
  async function psql(sql) {
    try { return [true, text(await db.exec(sql)), '']; } catch (e) { return [false, '', e.message]; }
  }

  // Run sql the way the app would: role 'authenticated' with that user's id in the token.
  async function asUser(uid, sql, role = 'authenticated') {
    await db.exec(`begin; set local role ${role}; select set_config('request.jwt.claim.sub', '${uid ?? ''}', true);`);
    try {
      const out = text(await db.exec(sql));
      await db.exec('commit');
      return [true, out, ''];
    } catch (e) {
      await db.exec('rollback');
      return [false, '', e.message + (e.hint ? ` (hint: ${e.hint})` : '')];
    }
  }

  function ok(cond, msg, extra = '') {
    console.log((cond ? '  PASS ' : '  FAIL ') + msg + (extra && !cond ? `   [${extra}]` : ''));
    if (!cond) fails += 1;
  }

  async function signup(email, paid = true) {
    const [, uid] = await psql(`insert into auth.users (email) values ('${email}') returning id`);
    if (paid) await psql(`insert into public.subscriptions (user_id, active_until) values ('${uid}', now() + interval '7 days')`);
    return uid;
  }

  return { psql, asUser, ok, signup, fails: () => fails };
}
