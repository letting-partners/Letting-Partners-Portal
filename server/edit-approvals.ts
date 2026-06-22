import "server-only";

import { ApprovalEntityType, Prisma, UserRole } from "@prisma/client";

type Tx = Prisma.TransactionClient;

type QueueEditApprovalArgs = {
  tx: Tx;
  entityType: ApprovalEntityType;
  entityId: string;
  requestedById: string;
  beforeJson: Prisma.InputJsonValue;
  proposedJson: Prisma.InputJsonValue;
  changedFields: string[];
  entityLabel: string;
};

const ENTITY_LABELS: Record<ApprovalEntityType, string> = {
  LANDLORD: "landlord",
  PROPERTY: "property",
  TENANT: "tenant",
  POTENTIAL_TENANT: "potential tenant",
  POTENTIAL_LANDLORD: "potential landlord",
};

function formatChangedFields(fields: string[]) {
  if (fields.length === 0) return "details";
  return fields.join(", ");
}

export async function queueEditApproval({
  tx,
  entityType,
  entityId,
  requestedById,
  beforeJson,
  proposedJson,
  changedFields,
  entityLabel,
}: QueueEditApprovalArgs) {
  const summary = `Pending ${ENTITY_LABELS[entityType]} update for ${entityLabel}: ${formatChangedFields(changedFields)}`;

  const approval = await tx.editApproval.create({
    data: {
      entityType,
      entityId,
      requestedById,
      summary,
      beforeJson,
      proposedJson,
    },
    select: {
      id: true,
      status: true,
      entityType: true,
      entityId: true,
      summary: true,
      createdAt: true,
    },
  });

  const admins = await tx.user.findMany({
    where: { role: UserRole.ADMIN, isActive: true },
    select: { id: true },
  });

  if (admins.length > 0) {
    await tx.notification.createMany({
      data: admins.map((admin) => ({
        userId: admin.id,
        type: "EDIT_APPROVAL_REQUESTED",
        title: "Approval request pending",
        body: `${entityLabel} has changes waiting for review.`,
        metadata: {
          approvalId: approval.id,
          entityType,
          entityId,
          requestedById,
          changedFields,
        },
      })),
    });
  }

  await tx.auditLog.create({
    data: {
      userId: requestedById,
      entityType: "EDIT_APPROVAL",
      entityId: approval.id,
      action: "REQUEST_EDIT_APPROVAL",
      metadata: {
        approvalId: approval.id,
        entityType,
        entityId,
        changedFields,
      },
      beforeJson,
      afterJson: proposedJson,
    },
  });

  return approval;
}

export async function notifyApprovalDecision({
  tx,
  requesterId,
  approvalId,
  entityType,
  entityId,
  approved,
  entityLabel,
  reviewerNotes,
}: {
  tx: Tx;
  requesterId: string;
  approvalId: string;
  entityType: ApprovalEntityType;
  entityId: string;
  approved: boolean;
  entityLabel: string;
  reviewerNotes?: string | null;
}) {
  await tx.notification.create({
    data: {
      userId: requesterId,
      type: approved ? "EDIT_APPROVAL_APPROVED" : "EDIT_APPROVAL_REJECTED",
      title: approved ? "Edit approved" : "Edit rejected",
      body: approved
        ? `Your requested changes for ${entityLabel} were approved.`
        : `Your requested changes for ${entityLabel} were rejected.`,
      metadata: {
        approvalId,
        entityType,
        entityId,
        reviewerNotes: reviewerNotes ?? null,
      },
    },
  });
}
