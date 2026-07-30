/**
 * Seed merchant keywords → category slug map (REQ-TC-001, REQ-TC-009).
 *
 * The categorizer's first short-circuit layer. The keys are matched as
 * case-insensitive substrings against the normalized merchant string, so
 * `'Shell OIL'` matches the `'shell'` key and resolves to the
 * `'transporte'` slug without touching the LLM.
 *
 * Pure data + a pure matcher. No IO, no Drizzle, no env access — safe to
 * import from any layer (use case, composition root, test).
 */
export const KEYWORDS: ReadonlyMap<string, string> = new Map<string, string>([
  ['shell', 'transporte'],
  ['ypf', 'transporte'],
  ['nafta', 'transporte'],
  ['spotify', 'entretenimiento'],
  ['netflix', 'entretenimiento'],
  ['cinemark', 'entretenimiento'],
  ['edesur', 'servicios'],
  ['personal', 'servicios'],
  ['aysa', 'servicios'],
  ['osde', 'salud'],
  ['swissmedical', 'salud'],
  ['farmacity', 'salud'],
  ['mercadolibre', 'compras'],
  ['zara', 'compras'],
  ['coderhouse', 'educacion'],
  ['cuspide', 'educacion'],
]);

/**
 * Case-insensitive substring match of `merchant` against every key in
 * {@link KEYWORDS}.
 *
 * @returns The category slug for the first matching keyword, or `null` when
 *   no key is a substring of `merchant`.
 */
export function matchKeyword(merchant: string): string | null {
  const needle = merchant.toLowerCase();
  for (const [keyword, slug] of KEYWORDS) {
    if (needle.includes(keyword)) {
      return slug;
    }
  }
  return null;
}