// Stored contact values are data, not trusted markup: only these shapes become an href.

/** http(s) URLs only; anything else (javascript:, data:, bare hosts) is shown as text. */
export function safeUrlHref(v: string | null): string | null {
  const s = v?.trim();
  if (!s) return null;
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:" ? u.href : null;
  } catch {
    return null;
  }
}

// No whitespace, scheme colon, header-injection (%, comma, semicolon, ? and &) or markup characters.
const EMAIL = /^[^\s@:?&#/<>"'%,;]+@[^\s@:?&#/<>"'%,;]+\.[^\s@:?&#/<>"'%,;]+$/;

/** A mailto: link built from a value that looks like a plain address, never the stored text itself. */
export function safeEmailHref(v: string | null): string | null {
  const s = v?.trim();
  return s && EMAIL.test(s) ? `mailto:${s}` : null;
}
