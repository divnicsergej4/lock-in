// Lock In's own domain (bought on Cloudflare Registrar, see docs/DOMEN.md): a plain host name, no https://, no
// slash. The web pages (folder web/, Cloudflare Pages) and the Turnstile page live here.
export const DOMAIN: string | null = 'lockintracker.app';

/** Pages on the domain (folder web/, Cloudflare Pages). */
export const webUrl = (path: string) => (DOMAIN ? `https://${DOMAIN}/${path.replace(/^\//, '')}` : null);
