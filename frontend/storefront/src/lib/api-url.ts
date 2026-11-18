/** Browser requests stay same-origin so refresh cookies keep their existing behavior. */
export const API_PROXY_PATH = '/api/v1';

/** Shared upstream for the Next.js proxy, server rendering, and middleware. */
export function backendUrl(path: string): string {
  const configured = process.env.NEXT_PUBLIC_API_URL?.trim().replace(/\/+$/, '');
  if (!configured) throw new Error('NEXT_PUBLIC_API_URL must be configured');
  const url = new URL(configured);
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== API_PROXY_PATH
  ) {
    throw new Error('NEXT_PUBLIC_API_URL must be an HTTP(S) URL ending in /api/v1');
  }
  return `${configured}${path.startsWith('/') ? path : `/${path}`}`;
}
