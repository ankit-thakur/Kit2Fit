/**
 * Tile ordering for the group board (docs/v2-spec.md §5).
 *
 * Position rotates daily so no member is permanently buried, and content never
 * affects position — a photo tile is visually richer but does not jump the
 * queue. Ranking by content would hand the top slots permanently to whoever
 * posts photos, which is the last-place dynamic reappearing in layout after
 * being removed from scoring.
 */

/**
 * Order members for a given day: `position = (index + dayNumber) mod N`.
 *
 * Stable for the whole day, so nothing reshuffles while someone is scrolling,
 * and over N days every member occupies every position exactly once. Pass
 * members in a stable order (sorted by userId) or the rotation is not
 * reproducible between requests.
 */
export function rotatedOrder<T>(members: readonly T[], dayNumber: number): T[] {
  const n = members.length;
  if (n === 0) return [];

  const out = new Array<T>(n);
  for (let i = 0; i < n; i++) {
    // Double modulo keeps a negative dayNumber (a date before the challenge
    // started) in range rather than producing an undefined slot.
    const position = (((i + dayNumber) % n) + n) % n;
    out[position] = members[i];
  }
  return out;
}
