/**
 * joinUrl — base + path with a single slash separator (REQ-FFC-FE-URL-HELPER).
 *
 * Fixes the CORS double-slash bug (REQ-FFC-FE-CORS-FIX) by collapsing the
 * boundary slash: a base ending in "/" and a path starting with "/" must
 * NOT produce "//path". The helper preserves multi-segment paths and query
 * strings verbatim so the caller never has to think about the separator.
 *
 * Trim rules:
 *  - Base: a single trailing "/" is removed.
 *  - Path: a single leading "/" is removed.
 *  - Interior slashes are NOT touched (a caller that passes "transactions/"
 *    gets the trailing slash back on the segment).
 *
 * Edge cases:
 *  - path === "" returns base as-is (caller may want a directory URL).
 *  - path === undefined returns base as-is.
 *  - Non-string inputs throw TypeError so misuse surfaces immediately.
 */
export function joinUrl(base: string, path?: string): string {
  if (typeof base !== 'string') {
    throw new TypeError('joinUrl: base must be a string');
  }
  if (path !== undefined && typeof path !== 'string') {
    throw new TypeError('joinUrl: path must be a string when provided');
  }
  if (path === undefined || path === '') {
    return base;
  }
  const trimmedBase = base.endsWith('/') ? base.slice(0, -1) : base;
  const trimmedPath = path.startsWith('/') ? path.slice(1) : path;
  return `${trimmedBase}/${trimmedPath}`;
}