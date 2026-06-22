import { Prisma, UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { hashPassword, requireRole, requireUser } from "@/server/auth";
import { db } from "@/server/db";

const userIdSchema = z.string().uuid("userId must be a valid UUID");

function normalizeOptionalText(value: unknown) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

const patchAgentSettingsSchema = z
  .object({
    email: z.string().email("email must be a valid email address").optional(),
    agentDisplayName: z.string().trim().min(2, "agentDisplayName is required").max(120).optional(),
    isActive: z.boolean().optional(),
    newPassword: z.string().min(8, "newPassword must be at least 8 characters").max(128).optional(),
    providerUsername: z.preprocess(normalizeOptionalText, z.string().max(120).nullable().optional()),
    providerPassword: z.preprocess(normalizeOptionalText, z.string().max(256).nullable().optional()),
    extensionNumber: z.preprocess(normalizeOptionalText, z.string().max(40).nullable().optional()),
    extensionName: z.preprocess(normalizeOptionalText, z.string().max(120).nullable().optional()),
    autoDetectExtension: z.boolean().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (
      value.email === undefined &&
      value.agentDisplayName === undefined &&
      value.isActive === undefined &&
      value.newPassword === undefined &&
      value.providerUsername === undefined &&
      value.providerPassword === undefined &&
      value.extensionNumber === undefined &&
      value.extensionName === undefined &&
      value.autoDetectExtension === undefined
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "At least one update field is required.",
      });
    }
  });

const dialerSelect = {
  id: true,
  userId: true,
  extensionNumber: true,
  extensionName: true,
  providerUsername: true,
  providerPassword: true,
  autoDetectExtension: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.AgentDialerSettingSelect;

function shapeAgent(agent: {
  id: string;
  email: string;
  agentDisplayName: string;
  isActive: boolean;
  createdAt: Date;
  dialerSetting: {
    id: string;
    userId: string;
    extensionNumber: string | null;
    extensionName: string | null;
    providerUsername: string | null;
    providerPassword: string | null;
    autoDetectExtension: boolean;
    createdAt: Date;
    updatedAt: Date;
  } | null;
}) {
  return {
    id: agent.id,
    email: agent.email,
    agentDisplayName: agent.agentDisplayName,
    isActive: agent.isActive,
    createdAt: agent.createdAt,
    dialer: {
      extensionNumber: agent.dialerSetting?.extensionNumber ?? null,
      extensionName: agent.dialerSetting?.extensionName ?? null,
      providerUsername: agent.dialerSetting?.providerUsername ?? null,
      autoDetectExtension: agent.dialerSetting?.autoDetectExtension ?? true,
      hasProviderPassword: Boolean(agent.dialerSetting?.providerPassword),
      updatedAt: agent.dialerSetting?.updatedAt ?? null,
    },
  };
}

export async function GET(request: NextRequest, { params }: { params: { userId: string } }) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  const roleCheck = requireRole(auth.user, [UserRole.ADMIN]);
  if (!roleCheck.ok) return roleCheck.response;

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

  const agent = await db.user.findFirst({
    where: { id: userIdParse.data, role: UserRole.AGENT },
    select: {
      id: true,
      email: true,
      agentDisplayName: true,
      isActive: true,
      createdAt: true,
      dialerSetting: { select: dialerSelect },
    },
  });

  if (!agent) {
    return NextResponse.json({ error: "NOT_FOUND", message: "Agent not found." }, { status: 404 });
  }

  return NextResponse.json({
    agent: shapeAgent(agent),
  });
}

export async function PATCH(request: NextRequest, { params }: { params: { userId: string } }) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  const roleCheck = requireRole(auth.user, [UserRole.ADMIN]);
  if (!roleCheck.ok) return roleCheck.response;

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

  let payload: z.infer<typeof patchAgentSettingsSchema>;
  try {
    payload = patchAgentSettingsSchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json(
      {
        error: "INVALID_REQUEST",
        message: "Invalid update payload.",
        details: error instanceof z.ZodError ? error.flatten() : undefined,
      },
      { status: 400 },
    );
  }

  const currentUser = await db.user.findFirst({
    where: { id: userIdParse.data, role: UserRole.AGENT },
    select: {
      id: true,
      email: true,
      role: true,
      agentDisplayName: true,
      isActive: true,
      createdAt: true,
      dialerSetting: { select: dialerSelect },
    },
  });

  if (!currentUser) {
    return NextResponse.json({ error: "NOT_FOUND", message: "Agent not found." }, { status: 404 });
  }

  const userUpdate: Prisma.UserUpdateInput = {};
  let passwordChanged = false;
  let profileChanged = false;

  if (payload.email !== undefined) {
    const normalizedEmail = payload.email.trim().toLowerCase();
    if (normalizedEmail !== currentUser.email) {
      const existing = await db.user.findUnique({
        where: { email: normalizedEmail },
        select: { id: true },
      });
      if (existing && existing.id !== currentUser.id) {
        return NextResponse.json(
          {
            error: "EMAIL_ALREADY_IN_USE",
            message: "A user with this email already exists.",
          },
          { status: 409 },
        );
      }
      userUpdate.email = normalizedEmail;
      profileChanged = true;
    }
  }

  if (
    payload.agentDisplayName !== undefined &&
    payload.agentDisplayName.trim() !== currentUser.agentDisplayName
  ) {
    userUpdate.agentDisplayName = payload.agentDisplayName.trim();
    profileChanged = true;
  }

  if (payload.isActive !== undefined && payload.isActive !== currentUser.isActive) {
    userUpdate.isActive = payload.isActive;
    profileChanged = true;
  }

  if (payload.newPassword) {
    userUpdate.passwordHash = await hashPassword(payload.newPassword);
    passwordChanged = true;
  }

  const hasDialerField =
    payload.providerUsername !== undefined ||
    payload.providerPassword !== undefined ||
    payload.extensionNumber !== undefined ||
    payload.extensionName !== undefined ||
    payload.autoDetectExtension !== undefined;

  if (Object.keys(userUpdate).length === 0 && !hasDialerField) {
    return NextResponse.json(
      {
        error: "NO_FIELDS_TO_UPDATE",
        message: "No effective changes were provided.",
      },
      { status: 400 },
    );
  }

  const updated = await db.$transaction(async (tx) => {
    const nextUser =
      Object.keys(userUpdate).length > 0
        ? await tx.user.update({
            where: { id: currentUser.id },
            data: userUpdate,
            select: {
              id: true,
              email: true,
              role: true,
              agentDisplayName: true,
              isActive: true,
              createdAt: true,
            },
          })
        : {
            id: currentUser.id,
            email: currentUser.email,
            role: currentUser.role,
            agentDisplayName: currentUser.agentDisplayName,
            isActive: currentUser.isActive,
            createdAt: currentUser.createdAt,
          };

    let dialerSetting = currentUser.dialerSetting;
    if (hasDialerField) {
      const dialerUpdate: Prisma.AgentDialerSettingUpdateInput = {};
      if (payload.providerUsername !== undefined) {
        dialerUpdate.providerUsername = payload.providerUsername;
      }
      if (payload.providerPassword !== undefined) {
        dialerUpdate.providerPassword = payload.providerPassword;
      }
      if (payload.extensionNumber !== undefined) {
        dialerUpdate.extensionNumber = payload.extensionNumber;
      }
      if (payload.extensionName !== undefined) {
        dialerUpdate.extensionName = payload.extensionName;
      }
      if (payload.autoDetectExtension !== undefined) {
        dialerUpdate.autoDetectExtension = payload.autoDetectExtension;
      }

      dialerSetting = await tx.agentDialerSetting.upsert({
        where: { userId: currentUser.id },
        create: {
          userId: currentUser.id,
          providerUsername: payload.providerUsername ?? null,
          providerPassword: payload.providerPassword ?? null,
          extensionNumber: payload.extensionNumber ?? null,
          extensionName: payload.extensionName ?? null,
          autoDetectExtension: payload.autoDetectExtension ?? true,
        },
        update: dialerUpdate,
      });
    }

    await tx.auditLog.create({
      data: {
        userId: auth.user.id,
        entityType: "USER",
        entityId: currentUser.id,
        action: "ADMIN_AGENT_SETTINGS_UPDATE",
        beforeJson: {
          id: currentUser.id,
          email: currentUser.email,
          agentDisplayName: currentUser.agentDisplayName,
          isActive: currentUser.isActive,
          dialerSetting: currentUser.dialerSetting
            ? {
                extensionNumber: currentUser.dialerSetting.extensionNumber,
                extensionName: currentUser.dialerSetting.extensionName,
                providerUsername: currentUser.dialerSetting.providerUsername,
                autoDetectExtension: currentUser.dialerSetting.autoDetectExtension,
                hasProviderPassword: Boolean(currentUser.dialerSetting.providerPassword),
              }
            : null,
        },
        afterJson: {
          id: nextUser.id,
          email: nextUser.email,
          agentDisplayName: nextUser.agentDisplayName,
          isActive: nextUser.isActive,
          dialerSetting: dialerSetting
            ? {
                extensionNumber: dialerSetting.extensionNumber,
                extensionName: dialerSetting.extensionName,
                providerUsername: dialerSetting.providerUsername,
                autoDetectExtension: dialerSetting.autoDetectExtension,
                hasProviderPassword: Boolean(dialerSetting.providerPassword),
              }
            : null,
          passwordChanged,
        },
      },
    });

    return {
      id: nextUser.id,
      email: nextUser.email,
      agentDisplayName: nextUser.agentDisplayName,
      isActive: nextUser.isActive,
      createdAt: nextUser.createdAt,
      dialerSetting,
    };
  });

  return NextResponse.json({
    message:
      profileChanged && passwordChanged
        ? "Agent profile, status, and password updated."
        : passwordChanged
          ? "Agent password updated."
          : "Agent settings updated.",
    agent: shapeAgent(updated),
  });
}
