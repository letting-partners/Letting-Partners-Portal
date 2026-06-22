import { randomBytes } from "node:crypto";
import { Prisma, UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { hashPassword, requireRole, requireUser } from "@/server/auth";
import { db } from "@/server/db";

const createAgentSchema = z
  .object({
    email: z.string().email("email must be a valid email address"),
    agentDisplayName: z.string().trim().min(2, "agentDisplayName is required").max(120),
    mode: z.enum(["TEMP_PASSWORD", "AUTO_GENERATE"]).default("TEMP_PASSWORD"),
    tempPassword: z.string().min(8, "tempPassword must be at least 8 characters").max(128).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.mode === "TEMP_PASSWORD" && !value.tempPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "tempPassword is required when mode is TEMP_PASSWORD",
        path: ["tempPassword"],
      });
    }

    if (value.mode === "AUTO_GENERATE" && value.tempPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "tempPassword must not be provided when mode is AUTO_GENERATE",
        path: ["tempPassword"],
      });
    }
  });

const listAgentsQuerySchema = z
  .object({
    search: z.string().trim().min(1).optional(),
    includeDisabled: z.coerce.boolean().default(true),
  })
  .strict();

function generateTempPassword(): string {
  const randomPart = randomBytes(8).toString("base64url");
  return `Tmp-${randomPart}9!`;
}

export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (!auth.ok) {
    return auth.response;
  }

  const roleCheck = requireRole(auth.user, [UserRole.ADMIN]);
  if (!roleCheck.ok) {
    return roleCheck.response;
  }

  const queryParse = listAgentsQuerySchema.safeParse({
    search: request.nextUrl.searchParams.get("search") ?? undefined,
    includeDisabled: request.nextUrl.searchParams.get("includeDisabled") ?? undefined,
  });

  if (!queryParse.success) {
    return NextResponse.json(
      {
        error: "INVALID_QUERY",
        message: "Invalid query parameters.",
        details: queryParse.error.flatten(),
      },
      { status: 400 },
    );
  }

  const { search, includeDisabled } = queryParse.data;
  const where: Prisma.UserWhereInput = {
    role: "AGENT",
  };

  if (!includeDisabled) {
    where.isActive = true;
  }

  if (search) {
    where.OR = [
      { email: { contains: search, mode: "insensitive" as const } },
      { agentDisplayName: { contains: search, mode: "insensitive" as const } },
    ];
  }

  const agents = await db.user.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      email: true,
      agentDisplayName: true,
      profilePicture: true,
      isActive: true,
      createdAt: true,
      _count: {
        select: {
          ownedLandlords: true,
          ownedProperties: true,
        },
      },
    },
  });

  return NextResponse.json({
    agents,
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (!auth.ok) {
    return auth.response;
  }

  const roleCheck = requireRole(auth.user, [UserRole.ADMIN]);
  if (!roleCheck.ok) {
    return roleCheck.response;
  }

  let payload: z.infer<typeof createAgentSchema>;
  try {
    payload = createAgentSchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json(
      {
        error: "INVALID_REQUEST",
        message: "Invalid create-agent payload.",
        details: error instanceof z.ZodError ? error.flatten() : undefined,
      },
      { status: 400 },
    );
  }

  const email = payload.email.trim().toLowerCase();
  const existingUser = await db.user.findUnique({
    where: { email },
    select: { id: true, role: true },
  });

  if (existingUser) {
    return NextResponse.json(
      {
        error: "EMAIL_ALREADY_IN_USE",
        message: "A user with this email already exists.",
      },
      { status: 409 },
    );
  }

  const generatedTempPassword = payload.mode === "AUTO_GENERATE" ? generateTempPassword() : undefined;
  const plainPassword = generatedTempPassword ?? payload.tempPassword!;
  const passwordHash = await hashPassword(plainPassword);

  const agent = await db.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        email,
        passwordHash,
        role: "AGENT",
        agentDisplayName: payload.agentDisplayName.trim(),
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        agentDisplayName: true,
        isActive: true,
        createdAt: true,
        role: true,
      },
    });

    await tx.auditLog.create({
      data: {
        userId: auth.user.id,
        entityType: "USER",
        entityId: created.id,
        action: "ADMIN_AGENT_CREATE",
        beforeJson: Prisma.JsonNull,
        afterJson: {
          id: created.id,
          email: created.email,
          role: created.role,
          agentDisplayName: created.agentDisplayName,
          isActive: created.isActive,
          createdAt: created.createdAt,
        },
      },
    });

    return created;
  });

  return NextResponse.json(
    {
      message:
        payload.mode === "AUTO_GENERATE"
          ? "Agent created. Share the generated temporary password securely."
          : "Agent created successfully.",
      agent,
      generatedTempPassword,
    },
    { status: 201 },
  );
}
