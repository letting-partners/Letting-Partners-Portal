import { Prisma, UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole, requireUser } from "@/server/auth";
import { db } from "@/server/db";

const dialerDomainSchema = z
  .object({
    dialerMode: z.enum(["SIP", "LINKUS"]).optional(),
    linkusWebClientUrl: z.string().max(255).nullable().optional(),
    pbxPlatform: z.string().max(120).nullable().optional(),
    domain: z.string().max(255).nullable().optional(),
    sipPort: z.preprocess((value) => {
      if (value === undefined) return undefined;
      if (value === null) return null;
      if (typeof value === "number") return value;
      if (typeof value === "string") {
        const trimmed = value.trim();
        if (trimmed.length === 0) return null;
        const parsed = Number.parseInt(trimmed, 10);
        return Number.isNaN(parsed) ? value : parsed;
      }
      return value;
    }, z.number().int().min(1).max(65535).nullable().optional()),
    sipTransport: z.string().max(32).nullable().optional(),
    websocketHost: z.string().max(255).nullable().optional(),
    isEnabled: z.boolean().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (
      value.dialerMode === undefined &&
      value.linkusWebClientUrl === undefined &&
      value.pbxPlatform === undefined &&
      value.domain === undefined &&
      value.sipPort === undefined &&
      value.sipTransport === undefined &&
      value.websocketHost === undefined &&
      value.isEnabled === undefined
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "At least one field is required.",
      });
    }
  });

function normalizeOptionalText(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeHost(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const normalized = value
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^wss?:\/\//i, "")
    .replace(/\/+$/, "")
    .toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

function normalizeWebUrl(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const normalized = value.trim().replace(/\/+$/, "");
  if (normalized.length === 0) return null;
  if (/^https?:\/\//i.test(normalized)) return normalized;
  return `https://${normalized}`;
}

export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  const roleCheck = requireRole(auth.user, [UserRole.ADMIN]);
  if (!roleCheck.ok) return roleCheck.response;

  const config = await db.dialerDomainConfig.findUnique({
    where: { id: "singleton" },
    select: {
      id: true,
      dialerMode: true,
      linkusWebClientUrl: true,
      pbxPlatform: true,
      domain: true,
      sipPort: true,
      sipTransport: true,
      websocketHost: true,
      isEnabled: true,
      updatedAt: true,
      updatedBy: { select: { id: true, agentDisplayName: true, email: true } },
    },
  });

  return NextResponse.json({
    config: config ?? {
      id: "singleton",
      dialerMode: "SIP",
      linkusWebClientUrl: null,
      pbxPlatform: null,
      domain: null,
      sipPort: null,
      sipTransport: null,
      websocketHost: null,
      isEnabled: true,
      updatedAt: null,
      updatedBy: null,
    },
  });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  const roleCheck = requireRole(auth.user, [UserRole.ADMIN]);
  if (!roleCheck.ok) return roleCheck.response;

  let payload: z.infer<typeof dialerDomainSchema>;
  try {
    payload = dialerDomainSchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json(
      {
        error: "INVALID_REQUEST",
        message: "Invalid dialer domain payload.",
        details: error instanceof z.ZodError ? error.flatten() : undefined,
      },
      { status: 400 },
    );
  }

  const dialerMode = payload.dialerMode;
  const linkusWebClientUrl = normalizeWebUrl(payload.linkusWebClientUrl);
  const pbxPlatform = normalizeOptionalText(payload.pbxPlatform);
  const domain = normalizeHost(payload.domain);
  const sipPort = payload.sipPort === undefined ? undefined : payload.sipPort;
  const normalizedTransport = normalizeOptionalText(payload.sipTransport);
  const sipTransport = normalizedTransport ? normalizedTransport.toUpperCase() : normalizedTransport;
  const websocketHost = normalizeHost(payload.websocketHost);

  const updated = await db.$transaction(async (tx) => {
    const before = await tx.dialerDomainConfig.findUnique({
      where: { id: "singleton" },
      select: {
        id: true,
        dialerMode: true,
        linkusWebClientUrl: true,
        pbxPlatform: true,
        domain: true,
        sipPort: true,
        sipTransport: true,
        websocketHost: true,
        isEnabled: true,
        updatedAt: true,
      },
    });

    const config = await tx.dialerDomainConfig.upsert({
      where: { id: "singleton" },
      create: {
        id: "singleton",
        dialerMode: dialerMode ?? "SIP",
        linkusWebClientUrl: linkusWebClientUrl ?? null,
        pbxPlatform: pbxPlatform ?? null,
        domain: domain ?? null,
        sipPort: sipPort ?? null,
        sipTransport: sipTransport ?? null,
        websocketHost: websocketHost ?? null,
        isEnabled: payload.isEnabled ?? true,
        updatedById: auth.user.id,
      },
      update: {
        dialerMode,
        linkusWebClientUrl,
        pbxPlatform,
        domain,
        sipPort,
        sipTransport,
        websocketHost,
        isEnabled: payload.isEnabled,
        updatedById: auth.user.id,
      },
      select: {
        id: true,
        dialerMode: true,
        linkusWebClientUrl: true,
        pbxPlatform: true,
        domain: true,
        sipPort: true,
        sipTransport: true,
        websocketHost: true,
        isEnabled: true,
        updatedAt: true,
        updatedBy: { select: { id: true, agentDisplayName: true, email: true } },
      },
    });

    await tx.auditLog.create({
      data: {
        userId: auth.user.id,
        entityType: "DIALER_DOMAIN",
        entityId: "singleton",
        action: "ADMIN_DIALER_DOMAIN_UPDATE",
        beforeJson: before ?? Prisma.JsonNull,
        afterJson: {
          id: config.id,
          dialerMode: config.dialerMode,
          linkusWebClientUrl: config.linkusWebClientUrl,
          pbxPlatform: config.pbxPlatform,
          domain: config.domain,
          sipPort: config.sipPort,
          sipTransport: config.sipTransport,
          websocketHost: config.websocketHost,
          isEnabled: config.isEnabled,
          updatedAt: config.updatedAt,
          updatedById: config.updatedBy?.id ?? null,
        },
      },
    });

    return config;
  });

  return NextResponse.json({
    message: "Domain settings updated.",
    config: updated,
  });
}
