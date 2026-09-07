import "server-only";
import { and, count, desc, eq, ilike, isNull, or, sql as raw, type SQL } from "drizzle-orm";
import { db, executeRows } from "@/db";
import type { DbExecutor, Transaction } from "@/db";
import {
  closings,
  collaborations,
  commissions,
  dealStageHistory,
  deals,
  landlords,
  properties,
  propertyRooms,
  sales,
  tenants,
  verifications,
  viewings,
  type Deal,
  type Viewing,
} from "@/db/schema";
import { formatReference, REFERENCE_PREFIX } from "@/lib/reference";
import {
  calculateCommission,
  resolveAgreedCommissionPence,
  type CommissionBreakdown,
} from "./commission-engine";
import {
  assertTransition,
  canTransition,
  humanStage,
  type DealStage,
} from "./deal-state";
import { ENTITY, recordActivity } from "./audit";
import { notifyMany } from "./notifications";
import { loadPeopleMap } from "./landlords";
import { dealVisibilityFilter, type AccessContext } from "./permissions";
import {
  getCrossSellSplit,
  getEffectiveCommissionRule,
  getExchangeRateX100,
} from "./settings";

/**
 * The letting pipeline. Every stage change in the system goes through this
 * module so that:
 *
 *  - illegal transitions are rejected server-side,
 *  - nothing is ever deleted (a failure moves the deal back a stage and keeps
 *    every previous attempt),
 *  - closing a deal is one atomic transaction that either produces a complete
 *    sale with commission snapshots, or produces nothing at all.
 */

export { canTransition, humanStage };
export type { DealStage };

export class DealError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DealError";
  }
}

/**
 * Move a deal and write the immutable history row. Callers must already hold a
 * transaction when the move accompanies other writes.
 */
async function transition(
  executor: DbExecutor,
  deal: Pick<Deal, "id" | "stage">,
  to: DealStage,
  userId: string,
  reason: string | null,
  notes: string | null,
): Promise<void> {
  assertTransition(deal.stage, to);

  await executor
    .update(deals)
    .set({
      stage: to,
      updatedAt: new Date(),
      ...(to === "CLOSED_SUCCESSFUL" || to === "CLOSED_UNSUCCESSFUL"
        ? { closedAt: new Date(), closeReason: reason }
        : {}),
    })
    .where(eq(deals.id, deal.id));

  await executor.insert(dealStageHistory).values({
    dealId: deal.id,
    fromStage: deal.stage,
    toStage: to,
    reason,
    notes,
    changedById: userId,
  });
}

/* ------------------------------------------------------------- start deal */

export type StartViewingInput = {
  propertyId: string;
  roomId: string | null;
  tenantId: string;
  agentId: string;
  scheduledFor: Date;
  notes?: string | null;
  /** Set when the viewing comes from an accepted cross-sell. */
  collaborationId?: string | null;
  actorId: string;
};

/**
 * Begin a deal by scheduling the first viewing. Reuses the live deal for the
 * same tenant and property when one already exists, so a rescheduled viewing
 * extends the existing history instead of starting a parallel deal.
 */
export async function startViewing(input: StartViewingInput): Promise<{ dealId: string; viewingId: string }> {
  return db.transaction(async (tx) => {
    const propertyRows = await tx
      .select({
        id: properties.id,
        landlordId: properties.landlordId,
        assignedAgentId: properties.assignedAgentId,
        originatingFronterId: properties.originatingFronterId,
        propertyType: properties.propertyType,
        dealStage: properties.dealStage,
      })
      .from(properties)
      .where(and(eq(properties.id, input.propertyId), isNull(properties.deletedAt)))
      .limit(1);

    const property = propertyRows[0];
    if (!property) throw new DealError("That property no longer exists.");

    if (property.propertyType === "SHARED" && !input.roomId) {
      throw new DealError("Choose which room the viewing is for.");
    }
    if (property.propertyType === "FULL" && input.roomId) {
      throw new DealError("A full property viewing cannot be attached to a room.");
    }

    if (input.roomId) {
      const roomRows = await tx
        .select({ id: propertyRooms.id, status: propertyRooms.status })
        .from(propertyRooms)
        .where(and(eq(propertyRooms.id, input.roomId), isNull(propertyRooms.deletedAt)))
        .limit(1);

      const room = roomRows[0];
      if (!room) throw new DealError("That room no longer exists.");
      if (room.status === "LET") throw new DealError("That room has already been let.");
    }

    const existingRows = await tx
      .select()
      .from(deals)
      .where(
        and(
          eq(deals.propertyId, input.propertyId),
          input.roomId ? eq(deals.roomId, input.roomId) : isNull(deals.roomId),
          eq(deals.tenantId, input.tenantId),
          raw`${deals.stage} in ('VIEWING','VERIFICATION','CLOSING')`,
        ),
      )
      .limit(1);

    let deal = existingRows[0];

    if (!deal) {
      const inserted = await tx
        .insert(deals)
        .values({
          propertyId: input.propertyId,
          roomId: input.roomId,
          tenantId: input.tenantId,
          landlordId: property.landlordId,
          stage: "VIEWING",
          propertyAgentId: property.assignedAgentId ?? input.agentId,
          tenantAgentId: input.collaborationId ? input.agentId : null,
          originatingFronterId: property.originatingFronterId,
          collaborationId: input.collaborationId ?? null,
          createdBy: input.actorId,
        })
        .returning();

      deal = inserted[0];

      await tx.insert(dealStageHistory).values({
        dealId: deal.id,
        fromStage: "AVAILABLE",
        toStage: "VIEWING",
        reason: "Viewing scheduled",
        changedById: input.actorId,
      });
    } else if (deal.stage !== "VIEWING") {
      // Rescheduling after a failed verification or closing walks the deal back.
      await transition(tx, deal, "VIEWING", input.actorId, "Further viewing scheduled", null);
      deal = { ...deal, stage: "VIEWING" };
    }

    const [attemptRow] = await tx
      .select({ value: count() })
      .from(viewings)
      .where(eq(viewings.dealId, deal.id));

    const insertedViewing = await tx
      .insert(viewings)
      .values({
        dealId: deal.id,
        propertyId: input.propertyId,
        roomId: input.roomId,
        tenantId: input.tenantId,
        agentId: input.agentId,
        attemptNumber: Number(attemptRow?.value ?? 0) + 1,
        scheduledFor: input.scheduledFor,
        notes: input.notes ?? null,
        createdBy: input.actorId,
      })
      .returning({ id: viewings.id });

    const viewing = insertedViewing[0];

    await setPipelineStatus(tx, input.propertyId, input.roomId, "VIEWING");

    await tx.update(tenants).set({ status: "VIEWING" }).where(eq(tenants.id, input.tenantId));

    await recordActivity(
      {
        type: "VIEWING_SCHEDULED",
        entityType: ENTITY.property,
        entityId: input.propertyId,
        relatedEntityType: ENTITY.deal,
        relatedEntityId: deal.id,
        actorId: input.actorId,
        summary: "Viewing scheduled",
      },
      tx,
    );

    await notifyMany(
      [deal.propertyAgentId, deal.tenantAgentId, deal.originatingFronterId],
      {
        type: "VIEWING_SCHEDULED",
        title: "Viewing scheduled",
        body: "A viewing has been booked on one of your properties.",
        href: `/properties/${input.propertyId}`,
        entityType: ENTITY.deal,
        entityId: deal.id,
      },
      tx,
    );

    return { dealId: deal.id, viewingId: viewing.id };
  });
}

/* -------------------------------------------------------- viewing outcome */

export type CompleteViewingInput = {
  viewingId: string;
  successful: boolean;
  reason?: string | null;
  notes?: string | null;
  actorId: string;
};

/**
 * Record how a viewing went. Success advances the deal into verification; a
 * failure leaves the deal alive in VIEWING so another viewing or another
 * tenant can be tried without losing anything.
 */
export async function completeViewing(input: CompleteViewingInput): Promise<{ dealId: string }> {
  if (!input.successful && !input.reason?.trim()) {
    throw new DealError("Give a reason why the viewing was not successful.");
  }

  return db.transaction(async (tx) => {
    const rows = await tx.select().from(viewings).where(eq(viewings.id, input.viewingId)).limit(1);
    const viewing = rows[0];
    if (!viewing) throw new DealError("That viewing no longer exists.");
    if (viewing.status !== "SCHEDULED") {
      throw new DealError("That viewing has already been completed.");
    }

    const dealRows = await tx.select().from(deals).where(eq(deals.id, viewing.dealId)).limit(1);
    const deal = dealRows[0];
    if (!deal) throw new DealError("That deal no longer exists.");

    await tx
      .update(viewings)
      .set({
        status: input.successful ? "COMPLETED_SUCCESSFUL" : "COMPLETED_UNSUCCESSFUL",
        outcomeReason: input.reason ?? null,
        notes: input.notes ?? viewing.notes,
        completedAt: new Date(),
        completedById: input.actorId,
        updatedAt: new Date(),
      })
      .where(eq(viewings.id, input.viewingId));

    if (input.successful) {
      await transition(tx, deal, "VERIFICATION", input.actorId, "Viewing successful", input.notes ?? null);

      const [attemptRow] = await tx
        .select({ value: count() })
        .from(verifications)
        .where(eq(verifications.dealId, deal.id));

      await tx.insert(verifications).values({
        dealId: deal.id,
        attemptNumber: Number(attemptRow?.value ?? 0) + 1,
        startedById: input.actorId,
      });

      await setPipelineStatus(tx, deal.propertyId, deal.roomId, "VERIFICATION");
      await tx.update(tenants).set({ status: "NEGOTIATING" }).where(eq(tenants.id, deal.tenantId));
    } else {
      // Deal stays in VIEWING. The property becomes viewable again.
      await setPipelineStatus(tx, deal.propertyId, deal.roomId, "AVAILABLE");
      await tx.insert(dealStageHistory).values({
        dealId: deal.id,
        fromStage: deal.stage,
        toStage: "VIEWING",
        reason: input.reason ?? "Viewing unsuccessful",
        notes: input.notes ?? null,
        changedById: input.actorId,
      });
    }

    await recordActivity(
      {
        type: "VIEWING_COMPLETED",
        entityType: ENTITY.property,
        entityId: deal.propertyId,
        relatedEntityType: ENTITY.deal,
        relatedEntityId: deal.id,
        actorId: input.actorId,
        summary: input.successful ? "Viewing marked successful" : "Viewing marked unsuccessful",
        metadata: input.reason ? { reason: input.reason } : undefined,
      },
      tx,
    );

    await notifyMany(
      [deal.propertyAgentId, deal.tenantAgentId, deal.originatingFronterId],
      {
        type: "VIEWING_UPDATED",
        title: input.successful ? "Viewing successful" : "Viewing unsuccessful",
        body: input.successful
          ? "The deal has moved to verification."
          : input.reason ?? "The viewing did not go ahead.",
        href: `/properties/${deal.propertyId}`,
        entityType: ENTITY.deal,
        entityId: deal.id,
      },
      tx,
    );

    return { dealId: deal.id };
  });
}

/* --------------------------------------------------- verification outcome */

export type CompleteVerificationInput = {
  dealId: string;
  successful: boolean;
  reason?: string | null;
  notes?: string | null;
  actorId: string;
};

export async function completeVerification(
  input: CompleteVerificationInput,
): Promise<{ dealId: string }> {
  if (!input.successful && !input.reason?.trim()) {
    throw new DealError("Give a reason why verification was not successful.");
  }

  return db.transaction(async (tx) => {
    const dealRows = await tx.select().from(deals).where(eq(deals.id, input.dealId)).limit(1);
    const deal = dealRows[0];
    if (!deal) throw new DealError("That deal no longer exists.");
    if (deal.stage !== "VERIFICATION") {
      throw new DealError("This deal is not currently in verification.");
    }

    const openRows = await tx
      .select()
      .from(verifications)
      .where(and(eq(verifications.dealId, deal.id), eq(verifications.status, "IN_PROGRESS")))
      .orderBy(desc(verifications.startedAt))
      .limit(1);

    const open = openRows[0];
    if (open) {
      await tx
        .update(verifications)
        .set({
          status: input.successful ? "SUCCESSFUL" : "UNSUCCESSFUL",
          reason: input.reason ?? null,
          notes: input.notes ?? null,
          completedAt: new Date(),
          completedById: input.actorId,
        })
        .where(eq(verifications.id, open.id));
    }

    if (input.successful) {
      await transition(tx, deal, "CLOSING", input.actorId, "Verification successful", input.notes ?? null);

      const [attemptRow] = await tx
        .select({ value: count() })
        .from(closings)
        .where(eq(closings.dealId, deal.id));

      await tx.insert(closings).values({
        dealId: deal.id,
        attemptNumber: Number(attemptRow?.value ?? 0) + 1,
        startedById: input.actorId,
      });

      await setPipelineStatus(tx, deal.propertyId, deal.roomId, "CLOSING");
    } else {
      // Back to viewing rather than lost. Every attempt stays on record.
      await transition(tx, deal, "VIEWING", input.actorId, input.reason ?? "Verification unsuccessful", input.notes ?? null);
      await setPipelineStatus(tx, deal.propertyId, deal.roomId, "AVAILABLE");
    }

    await recordActivity(
      {
        type: "VERIFICATION_COMPLETED",
        entityType: ENTITY.property,
        entityId: deal.propertyId,
        relatedEntityType: ENTITY.deal,
        relatedEntityId: deal.id,
        actorId: input.actorId,
        summary: input.successful ? "Verification successful" : "Verification unsuccessful",
        metadata: input.reason ? { reason: input.reason } : undefined,
      },
      tx,
    );

    await notifyMany(
      [deal.propertyAgentId, deal.tenantAgentId, deal.originatingFronterId],
      {
        type: "VERIFICATION_UPDATED",
        title: input.successful ? "Verification successful" : "Verification unsuccessful",
        body: input.successful ? "The deal has moved to closing." : input.reason ?? null,
        href: `/properties/${deal.propertyId}`,
        entityType: ENTITY.deal,
        entityId: deal.id,
      },
      tx,
    );

    return { dealId: deal.id };
  });
}

/* ------------------------------------------------------------- closing */

export type CloseDealInput = {
  dealId: string;
  closed: boolean;
  reason?: string | null;
  notes?: string | null;
  actorId: string;
};

export type CloseDealResult =
  | { closed: true; dealId: string; saleId: string; breakdown: CommissionBreakdown }
  | { closed: false; dealId: string };

/**
 * The most important transaction in the system. When a deal closes it must
 * atomically:
 *
 *   1. close the deal and write its stage history,
 *   2. create the sale,
 *   3. calculate commission with the rules live *right now*,
 *   4. store those figures as an immutable snapshot,
 *   5. mark the property or room let,
 *   6. record the timeline entries,
 *   7. notify everybody who earned something.
 *
 * If any step fails, none of it happened.
 */
export async function closeDeal(input: CloseDealInput): Promise<CloseDealResult> {
  if (!input.closed && !input.reason?.trim()) {
    throw new DealError("Give a reason why the deal did not close.");
  }

  return db.transaction(async (tx): Promise<CloseDealResult> => {
    const dealRows = await tx.select().from(deals).where(eq(deals.id, input.dealId)).limit(1);
    const deal = dealRows[0];
    if (!deal) throw new DealError("That deal no longer exists.");
    if (deal.stage !== "CLOSING") throw new DealError("This deal is not currently closing.");

    const openRows = await tx
      .select()
      .from(closings)
      .where(and(eq(closings.dealId, deal.id), eq(closings.status, "IN_PROGRESS")))
      .orderBy(desc(closings.startedAt))
      .limit(1);

    const open = openRows[0];
    if (open) {
      await tx
        .update(closings)
        .set({
          status: input.closed ? "CLOSED" : "NOT_CLOSED",
          reason: input.reason ?? null,
          notes: input.notes ?? null,
          completedAt: new Date(),
          completedById: input.actorId,
        })
        .where(eq(closings.id, open.id));
    }

    /* ------------------------------------------------- did not close */
    if (!input.closed) {
      await transition(tx, deal, "VIEWING", input.actorId, input.reason ?? "Did not close", input.notes ?? null);
      await setPipelineStatus(tx, deal.propertyId, deal.roomId, "AVAILABLE");

      await recordActivity(
        {
          type: "CLOSING_COMPLETED",
          entityType: ENTITY.property,
          entityId: deal.propertyId,
          relatedEntityType: ENTITY.deal,
          relatedEntityId: deal.id,
          actorId: input.actorId,
          summary: "Closing unsuccessful - deal returned to the pipeline",
          metadata: { reason: input.reason },
        },
        tx,
      );

      return { closed: false, dealId: deal.id };
    }

    /* ----------------------------------------------------- closed */

    const propertyRows = await tx
      .select()
      .from(properties)
      .where(eq(properties.id, deal.propertyId))
      .limit(1);
    const property = propertyRows[0];
    if (!property) throw new DealError("That property no longer exists.");

    let room = null;
    if (deal.roomId) {
      const roomRows = await tx
        .select()
        .from(propertyRooms)
        .where(eq(propertyRooms.id, deal.roomId))
        .limit(1);
      room = roomRows[0] ?? null;
      if (!room) throw new DealError("That room no longer exists.");
    }

    // The agreed landlord commission for whichever unit is being let.
    const agreed = room
      ? room.commissionType
        ? { type: room.commissionType, value: room.commissionValue ?? 0 }
        : null
      : property.commissionType
        ? { type: property.commissionType, value: property.commissionValue ?? 0 }
        : null;

    const explicitAmount = room?.commissionAmountPence ?? property.commissionAmountPence ?? null;
    const monthlyRent = room?.rentPerMonthPence ?? property.rentPerMonthPence ?? null;
    const grossCommissionPence =
      explicitAmount ?? resolveAgreedCommissionPence(agreed, monthlyRent);

    if (grossCommissionPence <= 0) {
      throw new DealError(
        "This property has no agreed commission recorded. Add it before closing the deal.",
      );
    }

    // Snapshot the rules that are live at this instant.
    const [fronterRule, agentRule, split, pkrRateX100] = await Promise.all([
      getEffectiveCommissionRule(deal.originatingFronterId, "FRONTER", tx),
      getEffectiveCommissionRule(deal.propertyAgentId, "AGENT", tx),
      getCrossSellSplit(tx),
      getExchangeRateX100(tx),
    ]);

    const isCrossSell = Boolean(deal.tenantAgentId && deal.tenantAgentId !== deal.propertyAgentId);

    let crossSellSplit = isCrossSell ? split : null;
    if (isCrossSell && deal.collaborationId) {
      // Prefer the split frozen when the collaboration was accepted.
      const collabRows = await tx
        .select({
          propertyAgentSplitBp: collaborations.propertyAgentSplitBp,
          tenantAgentSplitBp: collaborations.tenantAgentSplitBp,
        })
        .from(collaborations)
        .where(eq(collaborations.id, deal.collaborationId))
        .limit(1);

      const collab = collabRows[0];
      if (collab?.propertyAgentSplitBp != null && collab.tenantAgentSplitBp != null) {
        crossSellSplit = {
          propertyAgentBp: collab.propertyAgentSplitBp,
          tenantAgentBp: collab.tenantAgentSplitBp,
        };
      }
    }

    const breakdown = calculateCommission({
      grossCommissionPence,
      fronterRule,
      agentRule,
      crossSell: crossSellSplit,
      pkrRateX100,
    });

    await transition(tx, deal, "CLOSED_SUCCESSFUL", input.actorId, "Deal closed", input.notes ?? null);

    const reference = await nextReference(tx, "sale_reference_seq", REFERENCE_PREFIX.sale);

    const insertedSale = await tx
      .insert(sales)
      .values({
        reference,
        dealId: deal.id,
        propertyId: deal.propertyId,
        roomId: deal.roomId,
        landlordId: deal.landlordId,
        tenantId: deal.tenantId,
        propertyAgentId: deal.propertyAgentId,
        tenantAgentId: deal.tenantAgentId,
        originatingFronterId: deal.originatingFronterId,
        collaborationId: deal.collaborationId,
        grossCommissionPence: breakdown.grossCommissionPence,
        fronterCommissionPence: breakdown.fronter.amountPence,
        agentPoolPence: breakdown.agentPool.amountPence,
        propertyAgentCommissionPence: breakdown.propertyAgent.amountPence,
        tenantAgentCommissionPence: breakdown.tenantAgent?.amountPence ?? 0,
        companyNetPence: breakdown.companyRetainedPence,
        pkrRateAtClose: pkrRateX100,
        calculationSnapshot: breakdown as never,
        notes: input.notes ?? null,
        createdBy: input.actorId,
      })
      .returning({ id: sales.id });

    const sale = insertedSale[0];

    const commissionRows = [
      deal.originatingFronterId && breakdown.fronter.amountPence > 0
        ? {
            saleId: sale.id,
            beneficiary: "FRONTER" as const,
            beneficiaryUserId: deal.originatingFronterId,
            amountPence: breakdown.fronter.amountPence,
            basisPence: breakdown.fronter.basisPence,
            ruleType: fronterRule?.type ?? null,
            ruleValue: fronterRule?.value ?? null,
            pkrRateAtClose: pkrRateX100,
            pkrAmount: breakdown.fronter.pkrAmount,
          }
        : null,
      breakdown.propertyAgent.amountPence > 0
        ? {
            saleId: sale.id,
            beneficiary: "PROPERTY_AGENT" as const,
            beneficiaryUserId: deal.propertyAgentId,
            amountPence: breakdown.propertyAgent.amountPence,
            basisPence: breakdown.propertyAgent.basisPence,
            ruleType: agentRule?.type ?? null,
            ruleValue: agentRule?.value ?? null,
            pkrRateAtClose: pkrRateX100,
            pkrAmount: breakdown.propertyAgent.pkrAmount,
          }
        : null,
      breakdown.tenantAgent && deal.tenantAgentId && breakdown.tenantAgent.amountPence > 0
        ? {
            saleId: sale.id,
            beneficiary: "TENANT_AGENT" as const,
            beneficiaryUserId: deal.tenantAgentId,
            amountPence: breakdown.tenantAgent.amountPence,
            basisPence: breakdown.tenantAgent.basisPence,
            ruleType: agentRule?.type ?? null,
            ruleValue: agentRule?.value ?? null,
            pkrRateAtClose: pkrRateX100,
            pkrAmount: breakdown.tenantAgent.pkrAmount,
          }
        : null,
      {
        saleId: sale.id,
        beneficiary: "COMPANY" as const,
        beneficiaryUserId: null,
        amountPence: breakdown.companyRetainedPence,
        basisPence: breakdown.afterFronterPence,
        ruleType: null,
        ruleValue: null,
        pkrRateAtClose: pkrRateX100,
        pkrAmount: breakdown.companyRetainedPkr,
      },
    ].filter((row): row is NonNullable<typeof row> => row !== null);

    await tx.insert(commissions).values(commissionRows);

    /* Availability: letting one room must not withdraw the others. */
    if (deal.roomId) {
      await tx
        .update(propertyRooms)
        .set({ status: "LET", updatedAt: new Date() })
        .where(eq(propertyRooms.id, deal.roomId));

      const remaining = await tx
        .select({ value: count() })
        .from(propertyRooms)
        .where(
          and(
            eq(propertyRooms.propertyId, deal.propertyId),
            isNull(propertyRooms.deletedAt),
            raw`${propertyRooms.status} <> 'LET'`,
          ),
        );

      const roomsLeft = Number(remaining[0]?.value ?? 0);
      await tx
        .update(properties)
        .set({
          dealStage: roomsLeft > 0 ? "AVAILABLE" : "CLOSED_SUCCESSFUL",
          listingStatus: roomsLeft > 0 ? property.listingStatus : "LET_AGREED",
          updatedAt: new Date(),
        })
        .where(eq(properties.id, deal.propertyId));
    } else {
      await tx
        .update(properties)
        .set({
          dealStage: "CLOSED_SUCCESSFUL",
          listingStatus: "LET_AGREED",
          availableRooms: 0,
          updatedAt: new Date(),
        })
        .where(eq(properties.id, deal.propertyId));
    }

    await tx.update(tenants).set({ status: "PLACED" }).where(eq(tenants.id, deal.tenantId));

    if (deal.collaborationId) {
      await tx
        .update(collaborations)
        .set({ status: "CLOSED", updatedAt: new Date() })
        .where(eq(collaborations.id, deal.collaborationId));
    }

    await tx
      .update(landlords)
      .set({ lastContactAt: new Date() })
      .where(eq(landlords.id, deal.landlordId));

    await recordActivity(
      {
        type: "SALE_CREATED",
        entityType: ENTITY.property,
        entityId: deal.propertyId,
        relatedEntityType: ENTITY.sale,
        relatedEntityId: sale.id,
        actorId: input.actorId,
        summary: `Deal closed successfully (${reference})`,
        metadata: { grossCommissionPence: breakdown.grossCommissionPence },
      },
      tx,
    );

    await notifyMany(
      [deal.propertyAgentId, deal.tenantAgentId, deal.originatingFronterId],
      {
        type: "SALE_COMPLETED",
        title: "Deal closed successfully",
        body: `Sale ${reference} has been created and commission recorded.`,
        href: `/sales/${sale.id}`,
        entityType: ENTITY.sale,
        entityId: sale.id,
      },
      tx,
    );

    return { closed: true, dealId: deal.id, saleId: sale.id, breakdown };
  });
}

/* ------------------------------------------------------------- helpers */

/**
 * Keep the property (or room) pipeline status in step with the deal. This is
 * the deal pipeline only - the website listing status is never touched here.
 */
async function setPipelineStatus(
  executor: DbExecutor,
  propertyId: string,
  roomId: string | null,
  stage: "AVAILABLE" | "VIEWING" | "VERIFICATION" | "CLOSING",
): Promise<void> {
  if (roomId) {
    await executor
      .update(propertyRooms)
      .set({ status: stage, updatedAt: new Date() })
      .where(eq(propertyRooms.id, roomId));
    return;
  }

  await executor
    .update(properties)
    .set({ dealStage: stage, updatedAt: new Date() })
    .where(eq(properties.id, propertyId));
}

/** Sequence-backed reference so concurrent closings cannot collide. */
export async function nextReference(
  executor: DbExecutor,
  sequence: string,
  prefix: string,
): Promise<string> {
  const rows = await executeRows<{ value: string }>(
    executor,
    raw`select nextval(${sequence})::text as value`,
  );
  const value = Number(rows[0]?.value ?? 1);
  return formatReference(prefix, value);
}

/** Admin-only: put a closed-unsuccessful deal back into the pipeline. */
export async function reopenDeal(
  dealId: string,
  actorId: string,
  reason: string,
): Promise<void> {
  await db.transaction(async (tx: Transaction) => {
    const rows = await tx.select().from(deals).where(eq(deals.id, dealId)).limit(1);
    const deal = rows[0];
    if (!deal) throw new DealError("That deal no longer exists.");
    if (deal.stage === "CLOSED_SUCCESSFUL") {
      throw new DealError("A completed sale cannot be reopened. Record a correction instead.");
    }

    await transition(tx, deal, "VIEWING", actorId, reason, null);
    await setPipelineStatus(tx, deal.propertyId, deal.roomId, "AVAILABLE");
  });
}

/* ------------------------------------------------------------ read paths */

/** Every deal on a property, with its tenant and agents, newest first. */
export async function listDealsForProperty(propertyId: string) {
  return db
    .select({
      id: deals.id,
      stage: deals.stage,
      roomId: deals.roomId,
      roomName: propertyRooms.name,
      tenantId: deals.tenantId,
      tenantName: tenants.name,
      propertyAgentId: deals.propertyAgentId,
      tenantAgentId: deals.tenantAgentId,
      startedAt: deals.startedAt,
      closedAt: deals.closedAt,
      closeReason: deals.closeReason,
      updatedAt: deals.updatedAt,
      collaborationId: deals.collaborationId,
    })
    .from(deals)
    .innerJoin(tenants, eq(tenants.id, deals.tenantId))
    .leftJoin(propertyRooms, eq(propertyRooms.id, deals.roomId))
    .where(eq(deals.propertyId, propertyId))
    .orderBy(desc(deals.updatedAt));
}

/** The immutable stage history for a deal, oldest first. */
export async function listDealStageHistory(dealId: string) {
  return db
    .select()
    .from(dealStageHistory)
    .where(eq(dealStageHistory.dealId, dealId))
    .orderBy(dealStageHistory.changedAt);
}

/** Viewings on a property, across every deal, newest first. */
export async function listViewingsForProperty(propertyId: string) {
  return db
    .select({
      id: viewings.id,
      dealId: viewings.dealId,
      attemptNumber: viewings.attemptNumber,
      scheduledFor: viewings.scheduledFor,
      status: viewings.status,
      outcomeReason: viewings.outcomeReason,
      notes: viewings.notes,
      tenantName: tenants.name,
      roomName: propertyRooms.name,
      completedAt: viewings.completedAt,
    })
    .from(viewings)
    .innerJoin(tenants, eq(tenants.id, viewings.tenantId))
    .leftJoin(propertyRooms, eq(propertyRooms.id, viewings.roomId))
    .where(eq(viewings.propertyId, propertyId))
    .orderBy(desc(viewings.scheduledFor));
}

/* --------------------------------------------------- pipeline listings */

export type PipelineListOptions = {
  status?: string;
  search?: string;
  page?: number;
  pageSize?: number;
};

/** Viewings visible to this user, newest scheduled first. */
export async function listViewings(context: AccessContext, options: PipelineListOptions = {}) {
  const page = Math.max(options.page ?? 1, 1);
  const pageSize = Math.min(Math.max(options.pageSize ?? 25, 1), 100);

  const conditions: (SQL | undefined)[] = [dealVisibilityFilter(context)];

  if (options.status) {
    conditions.push(eq(viewings.status, options.status as Viewing["status"]));
  }
  if (options.search) {
    const term = `%${options.search.trim()}%`;
    conditions.push(
      or(ilike(tenants.name, term), ilike(properties.formattedAddress, term), ilike(properties.reference, term)),
    );
  }

  const where = and(...conditions);

  const [rows, totalRows] = await Promise.all([
    db
      .select({
        id: viewings.id,
        dealId: viewings.dealId,
        attemptNumber: viewings.attemptNumber,
        scheduledFor: viewings.scheduledFor,
        status: viewings.status,
        outcomeReason: viewings.outcomeReason,
        completedAt: viewings.completedAt,
        propertyId: viewings.propertyId,
        propertyReference: properties.reference,
        propertyAddress: properties.formattedAddress,
        propertyTitle: properties.title,
        roomName: propertyRooms.name,
        tenantId: viewings.tenantId,
        tenantName: tenants.name,
        agentId: viewings.agentId,
        originatingFronterId: deals.originatingFronterId,
        dealStage: deals.stage,
      })
      .from(viewings)
      .innerJoin(deals, eq(deals.id, viewings.dealId))
      .innerJoin(properties, eq(properties.id, viewings.propertyId))
      .innerJoin(tenants, eq(tenants.id, viewings.tenantId))
      .leftJoin(propertyRooms, eq(propertyRooms.id, viewings.roomId))
      .where(where)
      .orderBy(desc(viewings.scheduledFor))
      .limit(pageSize)
      .offset((page - 1) * pageSize),

    db
      .select({ value: count() })
      .from(viewings)
      .innerJoin(deals, eq(deals.id, viewings.dealId))
      .innerJoin(properties, eq(properties.id, viewings.propertyId))
      .innerJoin(tenants, eq(tenants.id, viewings.tenantId))
      .where(where),
  ]);

  const total = Number(totalRows[0]?.value ?? 0);
  const people = await loadPeopleMap(rows.flatMap((row) => [row.agentId, row.originatingFronterId]));

  return {
    rows: rows.map((row) => ({
      ...row,
      agent: people.get(row.agentId) ?? null,
      fronter: row.originatingFronterId ? (people.get(row.originatingFronterId) ?? null) : null,
    })),
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/** Deals currently sitting in one stage of the pipeline. */
export async function listDealsByStage(
  context: AccessContext,
  stage: DealStage,
  options: PipelineListOptions = {},
) {
  const page = Math.max(options.page ?? 1, 1);
  const pageSize = Math.min(Math.max(options.pageSize ?? 25, 1), 100);

  const conditions: (SQL | undefined)[] = [eq(deals.stage, stage), dealVisibilityFilter(context)];

  if (options.search) {
    const term = `%${options.search.trim()}%`;
    conditions.push(
      or(ilike(tenants.name, term), ilike(properties.formattedAddress, term), ilike(properties.reference, term)),
    );
  }

  const where = and(...conditions);

  const [rows, totalRows] = await Promise.all([
    db
      .select({
        id: deals.id,
        stage: deals.stage,
        startedAt: deals.startedAt,
        updatedAt: deals.updatedAt,
        propertyId: deals.propertyId,
        propertyReference: properties.reference,
        propertyAddress: properties.formattedAddress,
        propertyTitle: properties.title,
        roomName: propertyRooms.name,
        tenantId: deals.tenantId,
        tenantName: tenants.name,
        propertyAgentId: deals.propertyAgentId,
        tenantAgentId: deals.tenantAgentId,
        originatingFronterId: deals.originatingFronterId,
        collaborationId: deals.collaborationId,
      })
      .from(deals)
      .innerJoin(properties, eq(properties.id, deals.propertyId))
      .innerJoin(tenants, eq(tenants.id, deals.tenantId))
      .leftJoin(propertyRooms, eq(propertyRooms.id, deals.roomId))
      .where(where)
      .orderBy(desc(deals.updatedAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),

    db
      .select({ value: count() })
      .from(deals)
      .innerJoin(properties, eq(properties.id, deals.propertyId))
      .innerJoin(tenants, eq(tenants.id, deals.tenantId))
      .where(where),
  ]);

  const total = Number(totalRows[0]?.value ?? 0);
  const people = await loadPeopleMap(
    rows.flatMap((row) => [row.propertyAgentId, row.tenantAgentId, row.originatingFronterId]),
  );

  return {
    rows: rows.map((row) => ({
      ...row,
      propertyAgent: people.get(row.propertyAgentId) ?? null,
      tenantAgent: row.tenantAgentId ? (people.get(row.tenantAgentId) ?? null) : null,
      fronter: row.originatingFronterId ? (people.get(row.originatingFronterId) ?? null) : null,
    })),
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/** Rooms of a shared property that a viewing can be booked on. */
export async function listBookableRooms(propertyId: string) {
  return db
    .select({
      id: propertyRooms.id,
      name: propertyRooms.name,
      status: propertyRooms.status,
      rentPerMonthPence: propertyRooms.rentPerMonthPence,
      availabilityDate: propertyRooms.availabilityDate,
    })
    .from(propertyRooms)
    .where(and(eq(propertyRooms.propertyId, propertyId), isNull(propertyRooms.deletedAt)))
    .orderBy(propertyRooms.sortOrder);
}
