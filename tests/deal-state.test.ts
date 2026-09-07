import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ALLOWED_TRANSITIONS,
  assertTransition,
  canTransition,
  DEAL_STAGES,
  DealTransitionError,
  isActive,
  isTerminal,
} from "../services/deal-state";

describe("deal pipeline transitions", () => {
  it("walks the happy path", () => {
    assert.ok(canTransition("AVAILABLE", "VIEWING"));
    assert.ok(canTransition("VIEWING", "VERIFICATION"));
    assert.ok(canTransition("VERIFICATION", "CLOSING"));
    assert.ok(canTransition("CLOSING", "CLOSED_SUCCESSFUL"));
  });

  it("never lets a deal skip a stage", () => {
    assert.equal(canTransition("AVAILABLE", "VERIFICATION"), false);
    assert.equal(canTransition("AVAILABLE", "CLOSING"), false);
    assert.equal(canTransition("AVAILABLE", "CLOSED_SUCCESSFUL"), false);
    assert.equal(canTransition("VIEWING", "CLOSING"), false);
    assert.equal(canTransition("VIEWING", "CLOSED_SUCCESSFUL"), false);
    assert.equal(canTransition("VERIFICATION", "CLOSED_SUCCESSFUL"), false);
  });

  it("returns a failed deal to viewing instead of destroying it", () => {
    assert.ok(canTransition("VERIFICATION", "VIEWING"), "failed verification reopens viewing");
    assert.ok(canTransition("CLOSING", "VIEWING"), "a deal that did not close stays alive");
    assert.ok(canTransition("VIEWING", "VIEWING"), "another viewing can be attempted");
  });

  it("treats a completed sale as terminal", () => {
    assert.equal(isTerminal("CLOSED_SUCCESSFUL"), true);
    for (const stage of DEAL_STAGES) {
      assert.equal(
        canTransition("CLOSED_SUCCESSFUL", stage),
        false,
        `a closed sale must not move to ${stage}`,
      );
    }
  });

  it("allows an abandoned deal to be revived", () => {
    assert.ok(canTransition("CLOSED_UNSUCCESSFUL", "VIEWING"));
    assert.equal(canTransition("CLOSED_UNSUCCESSFUL", "CLOSED_SUCCESSFUL"), false);
  });

  it("throws a readable error on an illegal move", () => {
    assert.throws(() => assertTransition("AVAILABLE", "CLOSED_SUCCESSFUL"), DealTransitionError);
    assert.throws(
      () => assertTransition("AVAILABLE", "CLOSED_SUCCESSFUL"),
      /cannot move from Available to Closed Successful/,
    );
  });

  it("identifies the live pipeline stages", () => {
    assert.deepEqual(
      DEAL_STAGES.filter(isActive),
      ["VIEWING", "VERIFICATION", "CLOSING"],
    );
  });

  it("defines a transition list for every stage", () => {
    for (const stage of DEAL_STAGES) {
      assert.ok(Array.isArray(ALLOWED_TRANSITIONS[stage]), `${stage} has no transition list`);
    }
  });
});
