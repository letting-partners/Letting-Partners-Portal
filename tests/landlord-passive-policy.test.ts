import assert from "node:assert/strict";
import test from "node:test";
import type { RequestUser } from "../server/auth/requireUser";
import { canEditLandlord, type LandlordPolicyResource } from "../server/policies/landlord";

const ownerAgent: RequestUser = {
  id: "agent-owner",
  email: "owner@example.com",
  role: "AGENT",
  isActive: true,
  agentDisplayName: "Owner Agent",
};

const otherAgent: RequestUser = {
  id: "agent-other",
  email: "other@example.com",
  role: "AGENT",
  isActive: true,
  agentDisplayName: "Other Agent",
};

const adminUser: RequestUser = {
  id: "admin-user",
  email: "admin@example.com",
  role: "ADMIN",
  isActive: true,
  agentDisplayName: "Admin",
};

const passiveLandlord: LandlordPolicyResource = {
  ownerAgentId: ownerAgent.id,
};

test("owner agent can still edit a passive landlord record", () => {
  assert.equal(canEditLandlord(ownerAgent, passiveLandlord), true);
});

test("non-owner agent still cannot edit a passive landlord record", () => {
  assert.equal(canEditLandlord(otherAgent, passiveLandlord), false);
});

test("admin can edit a passive landlord record", () => {
  assert.equal(canEditLandlord(adminUser, passiveLandlord), true);
});
