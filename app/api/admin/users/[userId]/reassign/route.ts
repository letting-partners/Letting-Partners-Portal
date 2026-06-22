import { Prisma, UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole, requireUser } from "@/server/auth";
import { db } from "@/server/db";

const userIdSchema = z.string().uuid("userId must be a valid UUID");
const reasonSchema = z.string().trim().min(3, "reason must be at least 3 characters").max(500, "reason is too long");

const transferCategorySchema = z.enum([
  "LANDLORDS",
  "PROPERTIES",
  "TENANTS",
  "POTENTIAL_TENANTS",
  "POTENTIAL_LANDLORDS",
]);

const transferEntityTypeSchema = z.enum([
  "LANDLORD",
  "PROPERTY",
  "TENANT",
  "POTENTIAL_TENANT",
  "POTENTIAL_LANDLORD",
]);

const transferPayloadSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("BULK"),
    targetAgentId: z.string().uuid("targetAgentId must be a valid UUID"),
    categories: z.array(transferCategorySchema).min(1, "Select at least one category."),
    reason: reasonSchema,
  }).strict(),
  z.object({
    mode: z.literal("SINGLE"),
    targetAgentId: z.string().uuid("targetAgentId must be a valid UUID"),
    entityType: transferEntityTypeSchema,
    entityId: z.string().uuid("entityId must be a valid UUID"),
    reason: reasonSchema,
  }).strict(),
]);

type Tx = Prisma.TransactionClient;
type TransferPayload = z.infer<typeof transferPayloadSchema>;
type TransferSummary = {
  landlordsMoved: number;
  propertiesMoved: number;
  standaloneTenantsMoved: number;
  potentialTenantsMoved: number;
  potentialLandlordsMoved: number;
  linkedSaleTenantsAffected: number;
  skippedProperties: number;
  skippedTenants: number;
  warnings: string[];
};

class TransferError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function createSummary(): TransferSummary {
  return {
    landlordsMoved: 0,
    propertiesMoved: 0,
    standaloneTenantsMoved: 0,
    potentialTenantsMoved: 0,
    potentialLandlordsMoved: 0,
    linkedSaleTenantsAffected: 0,
    skippedProperties: 0,
    skippedTenants: 0,
    warnings: [],
  };
}

function addWarning(summary: TransferSummary, warning: string) {
  if (!summary.warnings.includes(warning)) {
    summary.warnings.push(warning);
  }
}

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return count === 1 ? singular : plural;
}

async function moveLandlordPortfolios(
  tx: Tx,
  params: {
    landlordIds: string[];
    targetAgentId: string;
    adminUserId: string;
    summary: TransferSummary;
  },
) {
  if (params.landlordIds.length === 0) {
    return;
  }

  const propertyRows = await tx.property.findMany({
    where: { landlordId: { in: params.landlordIds } },
    select: { id: true, ownerAgentId: true },
  });
  const propertyIds = propertyRows.map((property) => property.id);

  const landlordResult = await tx.landlord.updateMany({
    where: {
      id: { in: params.landlordIds },
      ownerAgentId: { not: params.targetAgentId },
    },
    data: {
      ownerAgentId: params.targetAgentId,
      updatedByUserId: params.adminUserId,
    },
  });

  let propertyCount = 0;
  let linkedSaleTenantCount = 0;

  if (propertyIds.length > 0) {
    const propertyResult = await tx.property.updateMany({
      where: {
        id: { in: propertyIds },
        ownerAgentId: { not: params.targetAgentId },
      },
      data: {
        ownerAgentId: params.targetAgentId,
      },
    });
    propertyCount = propertyResult.count;
    linkedSaleTenantCount = await tx.tenant.count({
      where: {
        sale: {
          propertyId: { in: propertyIds },
        },
      },
    });
  }

  params.summary.landlordsMoved += landlordResult.count;
  params.summary.propertiesMoved += propertyCount;
  params.summary.linkedSaleTenantsAffected += linkedSaleTenantCount;
}

async function movePropertiesBulk(
  tx: Tx,
  params: {
    sourceAgentId: string;
    targetAgentId: string;
    adminUserId: string;
    summary: TransferSummary;
  },
) {
  const properties = await tx.property.findMany({
    where: { ownerAgentId: params.sourceAgentId },
    select: {
      id: true,
      propertyRef: true,
      landlordId: true,
      landlord: {
        select: {
          id: true,
          landlordName: true,
          ownerAgentId: true,
        },
      },
    },
  });

  if (properties.length === 0) {
    return;
  }

  const directPropertyIds: string[] = [];
  const landlordPortfolioIds = new Set<string>();
  let skippedProperties = 0;

  for (const property of properties) {
    if (property.landlord.ownerAgentId === params.targetAgentId) {
      directPropertyIds.push(property.id);
      continue;
    }

    if (property.landlord.ownerAgentId === params.sourceAgentId) {
      landlordPortfolioIds.add(property.landlord.id);
      continue;
    }

    skippedProperties += 1;
  }

  if (landlordPortfolioIds.size > 0) {
    await moveLandlordPortfolios(tx, {
      landlordIds: Array.from(landlordPortfolioIds),
      targetAgentId: params.targetAgentId,
      adminUserId: params.adminUserId,
      summary: params.summary,
    });
  }

  if (directPropertyIds.length > 0) {
    const result = await tx.property.updateMany({
      where: {
        id: { in: directPropertyIds },
        ownerAgentId: { not: params.targetAgentId },
      },
      data: {
        ownerAgentId: params.targetAgentId,
      },
    });

    params.summary.propertiesMoved += result.count;
    params.summary.linkedSaleTenantsAffected += await tx.tenant.count({
      where: {
        sale: {
          propertyId: { in: directPropertyIds },
        },
      },
    });
  }

  if (skippedProperties > 0) {
    params.summary.skippedProperties += skippedProperties;
    addWarning(
      params.summary,
      `${skippedProperties} ${pluralize(skippedProperties, "property")} could not be moved because the linked landlord belongs to another agent. Transfer that landlord first.`,
    );
  }
}

async function moveStandaloneTenantsBulk(
  tx: Tx,
  params: {
    sourceAgentId: string;
    targetAgentId: string;
    summary: TransferSummary;
  },
) {
  const result = await tx.tenant.updateMany({
    where: {
      addedByAgentId: params.sourceAgentId,
      saleId: null,
    },
    data: {
      addedByAgentId: params.targetAgentId,
    },
  });

  params.summary.standaloneTenantsMoved += result.count;

  const skippedSaleTenants = await tx.tenant.count({
    where: {
      saleId: { not: null },
      sale: {
        property: {
          ownerAgentId: params.sourceAgentId,
        },
      },
    },
  });

  if (skippedSaleTenants > 0) {
    params.summary.skippedTenants += skippedSaleTenants;
    addWarning(
      params.summary,
      `${skippedSaleTenants} sale-linked ${pluralize(skippedSaleTenants, "tenant")} stay with the property owner. Transfer the related property or landlord to move ${skippedSaleTenants === 1 ? "it" : "them"}.`,
    );
  }
}

async function movePotentialTenantsBulk(
  tx: Tx,
  params: {
    sourceAgentId: string;
    targetAgentId: string;
    summary: TransferSummary;
  },
) {
  const result = await tx.potentialTenant.updateMany({
    where: { addedByAgentId: params.sourceAgentId },
    data: { addedByAgentId: params.targetAgentId },
  });

  params.summary.potentialTenantsMoved += result.count;
}

async function movePotentialLandlordsBulk(
  tx: Tx,
  params: {
    sourceAgentId: string;
    targetAgentId: string;
    summary: TransferSummary;
  },
) {
  const result = await tx.potentialLandlord.updateMany({
    where: { addedByAgentId: params.sourceAgentId },
    data: { addedByAgentId: params.targetAgentId },
  });

  params.summary.potentialLandlordsMoved += result.count;
}

async function moveSingleLandlord(
  tx: Tx,
  params: {
    entityId: string;
    sourceAgentId: string;
    targetAgentId: string;
    adminUserId: string;
    summary: TransferSummary;
  },
) {
  const landlord = await tx.landlord.findUnique({
    where: { id: params.entityId },
    select: {
      id: true,
      landlordName: true,
      ownerAgentId: true,
    },
  });

  if (!landlord) {
    throw new TransferError(404, "Landlord not found.");
  }

  if (landlord.ownerAgentId !== params.sourceAgentId) {
    throw new TransferError(400, "This landlord no longer belongs to the selected source agent.");
  }

  await moveLandlordPortfolios(tx, {
    landlordIds: [landlord.id],
    targetAgentId: params.targetAgentId,
    adminUserId: params.adminUserId,
    summary: params.summary,
  });

  return `Landlord "${landlord.landlordName}" transferred successfully.`;
}

async function moveSingleProperty(
  tx: Tx,
  params: {
    entityId: string;
    sourceAgentId: string;
    targetAgentId: string;
    adminUserId: string;
    summary: TransferSummary;
  },
) {
  const property = await tx.property.findUnique({
    where: { id: params.entityId },
    select: {
      id: true,
      propertyRef: true,
      ownerAgentId: true,
      landlordId: true,
      landlord: {
        select: {
          id: true,
          landlordName: true,
          ownerAgentId: true,
        },
      },
    },
  });

  if (!property) {
    throw new TransferError(404, "Property not found.");
  }

  if (property.ownerAgentId !== params.sourceAgentId) {
    throw new TransferError(400, "This property no longer belongs to the selected source agent.");
  }

  if (property.landlord.ownerAgentId === params.targetAgentId) {
    const result = await tx.property.updateMany({
      where: {
        id: property.id,
        ownerAgentId: { not: params.targetAgentId },
      },
      data: {
        ownerAgentId: params.targetAgentId,
      },
    });

    params.summary.propertiesMoved += result.count;
    params.summary.linkedSaleTenantsAffected += await tx.tenant.count({
      where: {
        sale: {
          propertyId: property.id,
        },
      },
    });

    return `Property "${property.propertyRef}" transferred successfully.`;
  }

  if (property.landlord.ownerAgentId !== params.sourceAgentId) {
    throw new TransferError(
      400,
      `Property "${property.propertyRef}" is linked to landlord "${property.landlord.landlordName}", which belongs to another agent. Transfer that landlord first.`,
    );
  }

  const landlordPropertyCount = await tx.property.count({
    where: { landlordId: property.landlordId },
  });

  if (landlordPropertyCount > 1) {
    throw new TransferError(
      400,
      `Property "${property.propertyRef}" shares landlord "${property.landlord.landlordName}" with other properties. Transfer the landlord instead so ownership stays aligned.`,
    );
  }

  await moveLandlordPortfolios(tx, {
    landlordIds: [property.landlord.id],
    targetAgentId: params.targetAgentId,
    adminUserId: params.adminUserId,
    summary: params.summary,
  });

  return `Property "${property.propertyRef}" transferred successfully.`;
}

async function moveSingleTenant(
  tx: Tx,
  params: {
    entityId: string;
    sourceAgentId: string;
    targetAgentId: string;
    summary: TransferSummary;
  },
) {
  const tenant = await tx.tenant.findUnique({
    where: { id: params.entityId },
    select: {
      id: true,
      fullName: true,
      saleId: true,
      addedByAgentId: true,
      sale: {
        select: {
          property: {
            select: {
              id: true,
              propertyRef: true,
              ownerAgentId: true,
            },
          },
        },
      },
    },
  });

  if (!tenant) {
    throw new TransferError(404, "Tenant not found.");
  }

  if (tenant.sale?.property) {
    if (tenant.sale.property.ownerAgentId !== params.sourceAgentId) {
      throw new TransferError(400, "This tenant no longer belongs to the selected source agent.");
    }

    throw new TransferError(
      400,
      `Tenant "${tenant.fullName}" is linked to property "${tenant.sale.property.propertyRef}". Reassign the property or landlord instead.`,
    );
  }

  if (tenant.addedByAgentId !== params.sourceAgentId) {
    throw new TransferError(400, "This tenant no longer belongs to the selected source agent.");
  }

  const result = await tx.tenant.updateMany({
    where: {
      id: tenant.id,
      saleId: null,
      addedByAgentId: params.sourceAgentId,
    },
    data: {
      addedByAgentId: params.targetAgentId,
    },
  });

  params.summary.standaloneTenantsMoved += result.count;
  return `Tenant "${tenant.fullName}" transferred successfully.`;
}

async function moveSinglePotentialTenant(
  tx: Tx,
  params: {
    entityId: string;
    sourceAgentId: string;
    targetAgentId: string;
    summary: TransferSummary;
  },
) {
  const tenant = await tx.potentialTenant.findUnique({
    where: { id: params.entityId },
    select: {
      id: true,
      fullName: true,
      addedByAgentId: true,
    },
  });

  if (!tenant) {
    throw new TransferError(404, "Potential tenant not found.");
  }

  if (tenant.addedByAgentId !== params.sourceAgentId) {
    throw new TransferError(400, "This potential tenant no longer belongs to the selected source agent.");
  }

  const result = await tx.potentialTenant.updateMany({
    where: {
      id: tenant.id,
      addedByAgentId: params.sourceAgentId,
    },
    data: {
      addedByAgentId: params.targetAgentId,
    },
  });

  params.summary.potentialTenantsMoved += result.count;
  return `Potential tenant "${tenant.fullName}" transferred successfully.`;
}

async function moveSinglePotentialLandlord(
  tx: Tx,
  params: {
    entityId: string;
    sourceAgentId: string;
    targetAgentId: string;
    summary: TransferSummary;
  },
) {
  const landlord = await tx.potentialLandlord.findUnique({
    where: { id: params.entityId },
    select: {
      id: true,
      fullName: true,
      addedByAgentId: true,
    },
  });

  if (!landlord) {
    throw new TransferError(404, "Potential landlord not found.");
  }

  if (landlord.addedByAgentId !== params.sourceAgentId) {
    throw new TransferError(400, "This potential landlord no longer belongs to the selected source agent.");
  }

  const result = await tx.potentialLandlord.updateMany({
    where: {
      id: landlord.id,
      addedByAgentId: params.sourceAgentId,
    },
    data: {
      addedByAgentId: params.targetAgentId,
    },
  });

  params.summary.potentialLandlordsMoved += result.count;
  return `Potential landlord "${landlord.fullName}" transferred successfully.`;
}

function buildBulkMessage(summary: TransferSummary) {
  const movedTotal =
    summary.landlordsMoved +
    summary.propertiesMoved +
    summary.standaloneTenantsMoved +
    summary.potentialTenantsMoved +
    summary.potentialLandlordsMoved;

  if (movedTotal === 0 && summary.linkedSaleTenantsAffected === 0) {
    return "No records were moved.";
  }

  return "Selected records transferred successfully.";
}

export async function POST(request: NextRequest, { params }: { params: { userId: string } }) {
  const auth = await requireUser(request);
  if (!auth.ok) {
    return auth.response;
  }

  const roleCheck = requireRole(auth.user, [UserRole.ADMIN]);
  if (!roleCheck.ok) {
    return roleCheck.response;
  }

  const userIdParse = userIdSchema.safeParse(params.userId);
  if (!userIdParse.success) {
    return NextResponse.json(
      {
        error: "INVALID_USER_ID",
        message: userIdParse.error.issues[0]?.message ?? "Invalid user id.",
      },
      { status: 400 },
    );
  }

  let payload: TransferPayload;
  try {
    payload = transferPayloadSchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json(
      {
        error: "INVALID_REQUEST",
        message: "Invalid reassignment payload.",
        details: error instanceof z.ZodError ? error.flatten() : undefined,
      },
      { status: 400 },
    );
  }

  const sourceAgentId = userIdParse.data;
  if (sourceAgentId === payload.targetAgentId) {
    return NextResponse.json(
      {
        error: "SAME_AGENT",
        message: "Choose a different target agent.",
      },
      { status: 400 },
    );
  }

  const agents = await db.user.findMany({
    where: {
      id: { in: [sourceAgentId, payload.targetAgentId] },
      role: UserRole.AGENT,
    },
    select: {
      id: true,
      email: true,
      agentDisplayName: true,
      isActive: true,
    },
  });

  const sourceAgent = agents.find((agent) => agent.id === sourceAgentId);
  const targetAgent = agents.find((agent) => agent.id === payload.targetAgentId);

  if (!sourceAgent) {
    return NextResponse.json({ error: "NOT_FOUND", message: "Source agent not found." }, { status: 404 });
  }

  if (!targetAgent || !targetAgent.isActive) {
    return NextResponse.json(
      {
        error: "INVALID_TARGET_AGENT",
        message: "Target agent must be an active agent account.",
      },
      { status: 400 },
    );
  }

  try {
    const result = await db.$transaction(async (tx) => {
      const summary = createSummary();
      let message = "";
      const entityType: string = payload.mode === "SINGLE" ? payload.entityType : "USER";
      const entityId: string = payload.mode === "SINGLE" ? payload.entityId : sourceAgent.id;
      const action =
        payload.mode === "SINGLE"
          ? `ADMIN_REASSIGN_${payload.entityType}`
          : "ADMIN_REASSIGN_AGENT_RECORDS";

      if (payload.mode === "SINGLE") {
        switch (payload.entityType) {
          case "LANDLORD":
            message = await moveSingleLandlord(tx, {
              entityId: payload.entityId,
              sourceAgentId,
              targetAgentId: payload.targetAgentId,
              adminUserId: auth.user.id,
              summary,
            });
            break;
          case "PROPERTY":
            message = await moveSingleProperty(tx, {
              entityId: payload.entityId,
              sourceAgentId,
              targetAgentId: payload.targetAgentId,
              adminUserId: auth.user.id,
              summary,
            });
            break;
          case "TENANT":
            message = await moveSingleTenant(tx, {
              entityId: payload.entityId,
              sourceAgentId,
              targetAgentId: payload.targetAgentId,
              summary,
            });
            break;
          case "POTENTIAL_TENANT":
            message = await moveSinglePotentialTenant(tx, {
              entityId: payload.entityId,
              sourceAgentId,
              targetAgentId: payload.targetAgentId,
              summary,
            });
            break;
          case "POTENTIAL_LANDLORD":
            message = await moveSinglePotentialLandlord(tx, {
              entityId: payload.entityId,
              sourceAgentId,
              targetAgentId: payload.targetAgentId,
              summary,
            });
            break;
          default:
            throw new TransferError(400, "Unsupported entity type.");
        }
      } else {
        const categories = Array.from(new Set(payload.categories));
        const orderedCategories = [
          "LANDLORDS",
          "PROPERTIES",
          "TENANTS",
          "POTENTIAL_TENANTS",
          "POTENTIAL_LANDLORDS",
        ] as const;

        for (const category of orderedCategories) {
          if (!categories.includes(category)) {
            continue;
          }

          switch (category) {
            case "LANDLORDS":
              await moveLandlordPortfolios(tx, {
                landlordIds: (
                  await tx.landlord.findMany({
                    where: { ownerAgentId: sourceAgentId },
                    select: { id: true },
                  })
                ).map((landlord) => landlord.id),
                targetAgentId: payload.targetAgentId,
                adminUserId: auth.user.id,
                summary,
              });
              break;
            case "PROPERTIES":
              await movePropertiesBulk(tx, {
                sourceAgentId,
                targetAgentId: payload.targetAgentId,
                adminUserId: auth.user.id,
                summary,
              });
              break;
            case "TENANTS":
              await moveStandaloneTenantsBulk(tx, {
                sourceAgentId,
                targetAgentId: payload.targetAgentId,
                summary,
              });
              break;
            case "POTENTIAL_TENANTS":
              await movePotentialTenantsBulk(tx, {
                sourceAgentId,
                targetAgentId: payload.targetAgentId,
                summary,
              });
              break;
            case "POTENTIAL_LANDLORDS":
              await movePotentialLandlordsBulk(tx, {
                sourceAgentId,
                targetAgentId: payload.targetAgentId,
                summary,
              });
              break;
          }
        }

        message = buildBulkMessage(summary);
      }

      await tx.auditLog.create({
        data: {
          userId: auth.user.id,
          entityType,
          entityId,
          action,
          metadata: {
            sourceAgentId: sourceAgent.id,
            sourceAgentName: sourceAgent.agentDisplayName,
            targetAgentId: targetAgent.id,
            targetAgentName: targetAgent.agentDisplayName,
            mode: payload.mode,
            reason: payload.reason,
            categories: payload.mode === "BULK" ? payload.categories : null,
          },
          beforeJson: payload.mode === "SINGLE"
            ? {
                sourceAgentId: sourceAgent.id,
                targetAgentId: targetAgent.id,
                entityType: payload.entityType,
                entityId: payload.entityId,
              }
            : {
                sourceAgentId: sourceAgent.id,
                targetAgentId: targetAgent.id,
                categories: payload.categories,
              },
          afterJson: summary as unknown as Prisma.InputJsonValue,
        },
      });

      return { summary, message };
    });

    return NextResponse.json({
      message: result.message,
      summary: result.summary,
      sourceAgent: {
        id: sourceAgent.id,
        agentDisplayName: sourceAgent.agentDisplayName,
        email: sourceAgent.email,
      },
      targetAgent: {
        id: targetAgent.id,
        agentDisplayName: targetAgent.agentDisplayName,
        email: targetAgent.email,
      },
    });
  } catch (error) {
    if (error instanceof TransferError) {
      return NextResponse.json(
        {
          error: "TRANSFER_FAILED",
          message: error.message,
        },
        { status: error.status },
      );
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      const message =
        error.code === "P2022"
          ? "Record transfer is blocked because the landlord table is out of sync with the current schema. Apply the latest database migrations and try again."
          : "A database error prevented the transfer from completing. Try again after applying the latest migrations.";

      return NextResponse.json(
        {
          error: "TRANSFER_FAILED",
          message,
        },
        { status: 500 },
      );
    }

    throw error;
  }
}
