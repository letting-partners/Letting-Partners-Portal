/**
 * The deal pipeline as pure data.
 *
 * Kept free of database and server-only imports so the rules can be unit
 * tested directly and reused on the client for enabling/disabling actions.
 * The server still enforces them - this is the shared definition, not a
 * client-side permission.
 */

export const DEAL_STAGES = [
  "AVAILABLE",
  "VIEWING",
  "VERIFICATION",
  "CLOSING",
  "CLOSED_SUCCESSFUL",
  "CLOSED_UNSUCCESSFUL",
] as const;

export type DealStage = (typeof DEAL_STAGES)[number];

/**
 * The only transitions the business allows.
 *
 * Note what is deliberately possible: a failure at any stage walks the deal
 * back to VIEWING rather than ending it, because an unsuccessful viewing,
 * verification or closing must never destroy the deal or its history.
 */
export const ALLOWED_TRANSITIONS: Record<DealStage, readonly DealStage[]> = {
  AVAILABLE: ["VIEWING"],
  VIEWING: ["VIEWING", "VERIFICATION", "CLOSED_UNSUCCESSFUL"],
  VERIFICATION: ["VIEWING", "CLOSING", "CLOSED_UNSUCCESSFUL"],
  CLOSING: ["VIEWING", "VERIFICATION", "CLOSED_SUCCESSFUL", "CLOSED_UNSUCCESSFUL"],
  /** Terminal. A completed sale is corrected, never reopened. */
  CLOSED_SUCCESSFUL: [],
  CLOSED_UNSUCCESSFUL: ["VIEWING"],
};

export function canTransition(from: DealStage, to: DealStage): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function isTerminal(stage: DealStage): boolean {
  return ALLOWED_TRANSITIONS[stage].length === 0;
}

export function isActive(stage: DealStage): boolean {
  return stage === "VIEWING" || stage === "VERIFICATION" || stage === "CLOSING";
}

export function humanStage(stage: DealStage): string {
  return stage
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/** Position in the forward pipeline, for progress indicators. */
export const STAGE_ORDER: Record<DealStage, number> = {
  AVAILABLE: 0,
  VIEWING: 1,
  VERIFICATION: 2,
  CLOSING: 3,
  CLOSED_SUCCESSFUL: 4,
  CLOSED_UNSUCCESSFUL: 4,
};

export class DealTransitionError extends Error {
  readonly from: DealStage;
  readonly to: DealStage;

  constructor(from: DealStage, to: DealStage) {
    super(`A deal cannot move from ${humanStage(from)} to ${humanStage(to)}.`);
    this.name = "DealTransitionError";
    this.from = from;
    this.to = to;
  }
}

export function assertTransition(from: DealStage, to: DealStage): void {
  if (!canTransition(from, to)) throw new DealTransitionError(from, to);
}
