/**
 * Short human references (LP-1042, LPS-0007) shown in tables and used in URLs
 * and conversations. Sequence values come from the database so they cannot
 * collide under concurrency.
 */

export function formatReference(prefix: string, sequence: number): string {
  return `${prefix}-${String(sequence).padStart(4, "0")}`;
}

export const REFERENCE_PREFIX = {
  property: "LP",
  sale: "LPS",
} as const;
