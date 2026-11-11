import fs from 'fs';
import path from 'path';

import { isHostname } from '@/auth/turnstile';

import { DOMAIN, webUrl } from '../domain';

const WEB = path.resolve(__dirname, '../../../../web');

test('the domain is a plain host name', () => {
  expect(DOMAIN).toBe('lockintracker.app');
  expect(isHostname(DOMAIN!)).toBe(true);
});

test('Settings links point to the pages that exist in web/', () => {
  for (const p of ['privacy/', 'terms/', 'support/']) {
    expect(webUrl(p)).toBe(`https://lockintracker.app/${p}`);
    expect(fs.existsSync(path.join(WEB, p, 'index.html'))).toBe(true);
  }
  expect(webUrl('/support/')).toBe('https://lockintracker.app/support/');
});

test('no placeholder is left on the public pages', () => {
  for (const p of ['index.html', 'privacy/index.html', 'terms/index.html', 'support/index.html']) {
    const html = fs.readFileSync(path.join(WEB, p), 'utf8').replace(/<!--[\s\S]*?-->/g, ''); // the lawyer note is a comment
    expect(html).not.toMatch(/__DOMAIN__|\[OWNER|\[COUNTRY\]|\[SUPABASE/);
  }
  const privacy = fs.readFileSync(path.join(WEB, 'privacy/index.html'), 'utf8');
  expect(privacy).toContain('Andrija Dmitrović, Serbia');
  expect(privacy).toContain('Frankfurt, Germany (EU)');
  expect(privacy).toContain('mailto:support@lockintracker.app');
});
