// __DOMAIN__ : Lock In's own domain (bought by Sergej, see docs/DOMEN.md). Not bought yet, so it is null and
// everything that needs it stays off (Turnstile sends no token). When Sergej gives the domain, write it here as
// a plain host name, e.g. 'lockintracker.com' (no https://, no slash), and replace every other "__DOMAIN__" in the
// repo (docs/DOMEN.md, part 6 lists where).
export const DOMAIN: string | null = null;

/** Pages on the domain (folder web/, Cloudflare Pages). */
export const webUrl = (path: string) => (DOMAIN ? `https://${DOMAIN}/${path.replace(/^\//, '')}` : null);
