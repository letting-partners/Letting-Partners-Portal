import assert from "node:assert/strict";
import { randomInt } from "node:crypto";
import test from "node:test";
import { ensureTestEnv, hasPostgresTestDatabase, usePostgresTestDatabase } from "./helpers/test-env";

ensureTestEnv();
usePostgresTestDatabase();

const hasPg = hasPostgresTestDatabase();

test(
  "postgres integration: phoneLast10 must stay unique for landlords",
  { skip: !hasPg },
  async () => {
    const [{ db }, { Prisma }] = await Promise.all([
      import("../server/db"),
      import("@prisma/client"),
    ]);

    const suffix = randomInt(100000, 999999).toString();
    const phoneLast10 = `07${suffix}${suffix.slice(0, 2)}`;
    const agentEmail = `agent-${suffix}@example.com`;

    const agent = await db.user.create({
      data: {
        email: agentEmail,
        passwordHash: "not-used-in-this-test",
        role: "AGENT",
        agentDisplayName: `Agent ${suffix}`,
        isActive: true,
      },
      select: { id: true },
    });

    try {
      await db.landlord.create({
        data: {
          landlordName: "Primary Landlord",
          landlordNumber: phoneLast10,
          phoneLast10,
          phoneE164: `+44${phoneLast10}`,
          createdByUserId: agent.id,
          updatedByUserId: agent.id,
          ownerAgentId: agent.id,
        },
      });

      await assert.rejects(
        async () =>
          db.landlord.create({
            data: {
              landlordName: "Duplicate Phone",
              landlordNumber: phoneLast10,
              phoneLast10,
              phoneE164: `+44${phoneLast10}`,
              createdByUserId: agent.id,
              updatedByUserId: agent.id,
              ownerAgentId: agent.id,
            },
          }),
        (error: unknown) =>
          error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002",
      );
    } finally {
      await db.landlord.deleteMany({
        where: { ownerAgentId: agent.id },
      });
      await db.user.delete({
        where: { id: agent.id },
      });
    }
  },
);
