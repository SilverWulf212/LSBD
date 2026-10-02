// Response-header values shared with next.config.ts. Keep this file free of
// imports: next.config.ts loads it by relative path through Next's own loader.

const WILDCARD_BLOB_HOST = "*.public.blob.vercel-storage.com";

// A Vercel Blob read-write token is `vercel_blob_rw_<storeId>_<secret>`; the
// store's public host is `<storeId lower-cased>.public.blob.vercel-storage.com`.
// Anything else falls back to the wildcard host. Never log the token.
export function blobHostFromToken(token: string | undefined): string {
  if (!token || !token.startsWith("vercel_blob_rw_")) return WILDCARD_BLOB_HOST;
  const parts = token.split("_");
  const storeId = parts[3];
  if (parts.length < 5 || !storeId || !/^[A-Za-z0-9]+$/.test(storeId)) return WILDCARD_BLOB_HOST;
  return `${storeId.toLowerCase()}.public.blob.vercel-storage.com`;
}

export function buildCsp(opts: { isDev: boolean; blobHost: string }): string {
  // Next's dev tooling needs eval; production pages do not.
  const scriptSrc = `script-src 'self' 'unsafe-inline'${opts.isDev ? " 'unsafe-eval'" : ""}`;
  return [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: https://${opts.blobHost}`,
    "font-src 'self' https://fonts.gstatic.com",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

export const PERMISSIONS_POLICY = "camera=(), microphone=(), geolocation=()";
