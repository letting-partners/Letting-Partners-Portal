import assert from "node:assert/strict";
import test from "node:test";
import { canEditLandlord } from "../server/policies/landlord";
import { canViewProperty } from "../server/policies/property";

type MockLandlord = {
  id: string;
  phoneLast10: string;
};

class MockLandlordStore {
  private rows: MockLandlord[] = [];

  create(record: Omit<MockLandlord, "id">): MockLandlord {
    if (this.rows.some((existing) => existing.phoneLast10 === record.phoneLast10)) {
      throw new Error("PHONE_LAST10_CONFLICT");
    }

    const created: MockLandlord = {
      id: `${this.rows.length + 1}`,
      phoneLast10: record.phoneLast10,
    };
    this.rows.push(created);
    return created;
  }
}

const ownerAgent = {
  id: "agent-owner",
  email: "owner@example.com",
  role: "AGENT" as const,
  isActive: true,
  agentDisplayName: "Owner Agent",
};

const otherAgent = {
  id: "agent-other",
  email: "other@example.com",
  role: "AGENT" as const,
  isActive: true,
  agentDisplayName: "Other Agent",
};

const adminUser = {
  id: "admin-user",
  email: "admin@example.com",
  role: "ADMIN" as const,
  isActive: true,
  agentDisplayName: "Admin User",
};

test("mock rule: cannot create 2 landlords with same phoneLast10", () => {
  const store = new MockLandlordStore();

  store.create({ phoneLast10: "0712345678" });
  assert.throws(() => store.create({ phoneLast10: "0712345678" }), /PHONE_LAST10_CONFLICT/);
});

test("owner agent can edit their own landlord", () => {
  const landlord = { ownerAgentId: ownerAgent.id };
  assert.equal(canEditLandlord(ownerAgent, landlord), true);
});

test("admin can edit any landlord", () => {
  const landlord = { ownerAgentId: ownerAgent.id };
  assert.equal(canEditLandlord(adminUser, landlord), true);
});

test("agent cannot edit another agent landlord", () => {
  const landlord = { ownerAgentId: ownerAgent.id };
  assert.equal(canEditLandlord(otherAgent, landlord), false);
});

test("properties are visible only to owning agent or admin", () => {
  const property = {
    ownerAgentId: ownerAgent.id,
    landlordOwnerAgentId: ownerAgent.id,
  };

  assert.equal(canViewProperty(ownerAgent, property), true);
  assert.equal(canViewProperty(adminUser, property), true);
  assert.equal(canViewProperty(otherAgent, property), false);
});
