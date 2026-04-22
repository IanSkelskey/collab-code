/**
 * Cryptographically-secure random utilities. Preferred over `Math.random()`
 * for any value that ends up associated with a user or session (display
 * names, avatar colors, run ids) — not because these values are secrets,
 * but because CodeQL flags `Math.random()` in those contexts and using
 * `crypto.getRandomValues` is strictly better with no real cost.
 *
 * `crypto` is available in every browser collab-code targets, so there is
 * no runtime fallback; a thrown error here would indicate a broken host.
 */

/** Return a uniformly-distributed integer in [0, max). */
export function secureRandomInt(max: number): number {
  if (max <= 0 || !Number.isFinite(max)) {
    throw new RangeError('secureRandomInt: max must be a positive finite number');
  }
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  // Unbiased modulo would require rejection sampling; with max <= a few
  // dozen (our only use case) the modulo bias is negligible.
  return buffer[0] % Math.floor(max);
}

/** Pick a random element of a non-empty array. */
export function securePick<T>(items: readonly T[]): T {
  if (items.length === 0) {
    throw new RangeError('securePick: cannot pick from an empty array');
  }
  return items[secureRandomInt(items.length)];
}

/**
 * Return a base36 token of roughly the given length, sourced from
 * `crypto.getRandomValues`. Replaces the `Math.random().toString(36)` idiom.
 */
export function secureRandomToken(length = 8): string {
  const bytes = new Uint8Array(Math.ceil(length * 0.75));
  crypto.getRandomValues(bytes);
  let out = '';
  for (const byte of bytes) {
    out += byte.toString(36).padStart(2, '0');
  }
  return out.slice(0, length);
}
