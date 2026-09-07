import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canAccessTenant,
  canContinueFollowUp,
  canDriveDeal,
  canOverrideLock,
  canPublish,
  canSeeCommission,
  canSeeDeal,
  canSeeFollowUp,
  canUseCrossSell,
  canUseCustomerChat,
  ownsRecord,
  type Actor,
} from "../services/access-rules";

/* A small, fixed cast so every assertion reads unambiguously. */
const ADMIN_ID = "admin";
const AGENT_A_ID = "agent-a";
const AGENT_B_ID = "agent-b";
const FRONTER_1_ID = "fronter-1";
const FRONTER_2_ID = "fronter-2";
const FRONTER_X_ID = "fronter-x";

const admin: Actor = {
  id: ADMIN_ID,
  role: "SUPER_ADMIN",
  teamFronterIds: [],
  managingAgentId: null,
};

/** Agent A leads fronters 1 and 2. */
const agentA: Actor = {
  id: AGENT_A_ID,
  role: "AGENT",
  teamFronterIds: [FRONTER_1_ID, FRONTER_2_ID],
  managingAgentId: null,
};

/** Agent B leads nobody relevant. */
const agentB: Actor = {
  id: AGENT_B_ID,
  role: "AGENT",
  teamFronterIds: [FRONTER_X_ID],
  managingAgentId: null,
};

const fronter1: Actor = {
  id: FRONTER_1_ID,
  role: "FRONTER",
  teamFronterIds: [],
  managingAgentId: AGENT_A_ID,
};

/** Fronter 2 is on the same team as fronter 1. */
const fronter2: Actor = {
  id: FRONTER_2_ID,
  role: "FRONTER",
  teamFronterIds: [],
  managingAgentId: AGENT_A_ID,
};

/** A landlord won by fronter 1, under agent A. */
const teamRecord = {
  createdBy: FRONTER_1_ID,
  originatingFronterId: FRONTER_1_ID,
  assignedAgentId: AGENT_A_ID,
};

describe("record ownership", () => {
  it("lets an admin see everything", () => {
    assert.equal(ownsRecord(admin, teamRecord), true);
    assert.equal(ownsRecord(admin, { createdBy: "someone-else" }), true);
  });

  it("lets an agent see their own records and their team's", () => {
    assert.equal(ownsRecord(agentA, teamRecord), true);
    assert.equal(
      ownsRecord(agentA, { createdBy: AGENT_A_ID, assignedAgentId: AGENT_A_ID }),
      true,
    );
  });

  it("does not let an agent see another team's records", () => {
    assert.equal(ownsRecord(agentB, teamRecord), false);
  });

  it("lets a fronter see only their own work", () => {
    assert.equal(ownsRecord(fronter1, teamRecord), true);
  });

  it("does not let a fronter see a colleague's record on the same team", () => {
    assert.equal(
      ownsRecord(fronter2, teamRecord),
      false,
      "same team is not the same as same owner",
    );
  });
});

describe("publishing", () => {
  it("is available to the owning agent and to an admin", () => {
    assert.equal(canPublish(agentA, teamRecord), true);
    assert.equal(canPublish(admin, teamRecord), true);
  });

  it("is never available to a fronter, even on their own property", () => {
    assert.equal(
      canPublish(fronter1, teamRecord),
      false,
      "a fronter must not put a listing on the public website",
    );
  });

  it("is not available to an unrelated agent", () => {
    assert.equal(canPublish(agentB, teamRecord), false);
  });
});

describe("follow-up locking", () => {
  const followUp = { createdById: FRONTER_1_ID, agentId: AGENT_A_ID };

  it("lets the owner continue their own follow-up", () => {
    assert.equal(canContinueFollowUp(fronter1, followUp), true);
  });

  it("stops another fronter taking it - the rule the whole lock exists for", () => {
    assert.equal(canContinueFollowUp(fronter2, followUp), false);
    assert.equal(canOverrideLock(fronter2, followUp), false);
  });

  it("stops an unrelated agent taking it", () => {
    assert.equal(canOverrideLock(agentB, followUp), false);
    assert.equal(canContinueFollowUp(agentB, followUp), false);
  });

  it("lets the managing agent override, and an admin", () => {
    assert.equal(canOverrideLock(agentA, followUp), true);
    assert.equal(canOverrideLock(admin, followUp), true);
  });

  it("lets the managing agent and admin see it, but not a peer fronter", () => {
    assert.equal(canSeeFollowUp(agentA, followUp), true);
    assert.equal(canSeeFollowUp(admin, followUp), true);
    assert.equal(canSeeFollowUp(fronter1, followUp), true);
    assert.equal(canSeeFollowUp(fronter2, followUp), false);
  });
});

describe("tenants", () => {
  const tenant = { ownerAgentId: AGENT_A_ID };

  it("belongs to the agent who registered them", () => {
    assert.equal(canAccessTenant(agentA, tenant), true);
    assert.equal(canAccessTenant(agentB, tenant), false);
    assert.equal(canAccessTenant(admin, tenant), true);
  });

  it("is closed to fronters entirely", () => {
    assert.equal(canAccessTenant(fronter1, tenant), false);
  });
});

describe("deals", () => {
  const crossSellDeal = {
    propertyAgentId: AGENT_A_ID,
    tenantAgentId: AGENT_B_ID,
    originatingFronterId: FRONTER_1_ID,
  };

  it("is visible to both agents on a cross-sell", () => {
    assert.equal(canSeeDeal(agentA, crossSellDeal), true);
    assert.equal(canSeeDeal(agentB, crossSellDeal), true);
  });

  it("is visible to the fronter who originated the property", () => {
    assert.equal(
      canSeeDeal(fronter1, crossSellDeal),
      true,
      "a fronter follows the progress of what they won",
    );
    assert.equal(canSeeDeal(fronter2, crossSellDeal), false);
  });

  it("can only be driven by an agent on the deal", () => {
    assert.equal(canDriveDeal(agentA, crossSellDeal), true);
    assert.equal(canDriveDeal(agentB, crossSellDeal), true);
    assert.equal(
      canDriveDeal(fronter1, crossSellDeal),
      false,
      "watching a deal is not the same as running it",
    );
  });
});

describe("commission visibility", () => {
  it("shows a person their own commission", () => {
    assert.equal(canSeeCommission(fronter1, { beneficiaryUserId: FRONTER_1_ID }), true);
  });

  it("hides someone else's commission", () => {
    assert.equal(canSeeCommission(fronter1, { beneficiaryUserId: AGENT_A_ID }), false);
    assert.equal(canSeeCommission(agentA, { beneficiaryUserId: AGENT_B_ID }), false);
  });

  it("hides the company retained share from everyone but an admin", () => {
    assert.equal(canSeeCommission(agentA, { beneficiaryUserId: null }), false);
    assert.equal(canSeeCommission(admin, { beneficiaryUserId: null }), true);
  });
});

describe("feature access", () => {
  it("keeps customer chat away from fronters", () => {
    assert.equal(canUseCustomerChat(admin), true);
    assert.equal(canUseCustomerChat(agentA), true);
    assert.equal(
      canUseCustomerChat(fronter1),
      false,
      "website enquiries must never reach a fronter directly",
    );
  });

  it("keeps cross-sell to agents and admins", () => {
    assert.equal(canUseCrossSell(agentA), true);
    assert.equal(canUseCrossSell(fronter1), false);
  });
});
