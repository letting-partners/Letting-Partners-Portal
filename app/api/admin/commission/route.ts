import { NextResponse, type NextRequest } from "next/server";
import { UserRole } from "@prisma/client";
import { db } from "@/server/db";
import { getAuthSessionFromRequest } from "@/server/auth/session";
import type { FlexibleRange } from "@/lib/commission";

// GET /api/admin/commission — fetch current commission config
export async function GET(request: NextRequest) {
  const session = await getAuthSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { role: true, isActive: true },
  });
  if (!user || !user.isActive || user.role !== UserRole.ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const config = await db.commissionConfig.findUnique({ where: { id: "singleton" } });

  if (!config) {
    // Return the default if not seeded yet
    return NextResponse.json({
      type: "FIXED",
      fixedAmount: 5000,
      fixedCurrency: "PKR",
      flexibleRanges: null,
      updatedAt: null,
      updatedById: null,
    });
  }

  return NextResponse.json({
    type: config.type,
    fixedAmount: config.fixedAmount ? Number(config.fixedAmount) : null,
    fixedCurrency: config.fixedCurrency,
    flexibleRanges: config.flexibleRanges ?? null,
    updatedAt: config.updatedAt,
    updatedById: config.updatedById,
  });
}

// PUT /api/admin/commission — save commission config
export async function PUT(request: NextRequest) {
  const session = await getAuthSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { role: true, isActive: true },
  });
  if (!user || !user.isActive || user.role !== UserRole.ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const data = body as Record<string, unknown>;
  const type = data.type as string;

  if (type !== "FIXED" && type !== "FLEXIBLE") {
    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  }

  if (type === "FIXED") {
    const amt = Number(data.fixedAmount);
    const cur = data.fixedCurrency as string;
    if (!Number.isFinite(amt) || amt <= 0) {
      return NextResponse.json({ error: "fixedAmount must be positive" }, { status: 400 });
    }
    if (!["PKR", "GBP", "PCT"].includes(cur)) {
      return NextResponse.json({ error: "Invalid fixedCurrency" }, { status: 400 });
    }
    if (cur === "PCT" && amt > 100) {
      return NextResponse.json({ error: "Percentage cannot exceed 100" }, { status: 400 });
    }

    const config = await db.commissionConfig.upsert({
      where: { id: "singleton" },
      update: {
        type: "FIXED",
        fixedAmount: amt,
        fixedCurrency: cur,
        flexibleRanges: undefined,
        updatedById: session.userId,
      },
      create: {
        id: "singleton",
        type: "FIXED",
        fixedAmount: amt,
        fixedCurrency: cur,
        updatedById: session.userId,
      },
    });

    return NextResponse.json({ ok: true, updatedAt: config.updatedAt });
  }

  // FLEXIBLE
  const ranges = data.flexibleRanges as FlexibleRange[] | undefined;
  if (!Array.isArray(ranges) || ranges.length === 0) {
    return NextResponse.json({ error: "flexibleRanges must be a non-empty array" }, { status: 400 });
  }

  for (let i = 0; i < ranges.length; i++) {
    const r = ranges[i];
    if (typeof r.from !== "number" || r.from < 0) {
      return NextResponse.json({ error: `Range ${i + 1}: from must be >= 0` }, { status: 400 });
    }
    if (r.to !== null && (typeof r.to !== "number" || r.to <= r.from)) {
      return NextResponse.json({ error: `Range ${i + 1}: to must be > from` }, { status: 400 });
    }
    if (typeof r.amount !== "number" || r.amount <= 0) {
      return NextResponse.json({ error: `Range ${i + 1}: amount must be positive` }, { status: 400 });
    }
    if (!["PKR", "GBP", "PCT"].includes(r.currency)) {
      return NextResponse.json({ error: `Range ${i + 1}: invalid currency` }, { status: 400 });
    }
    if (r.currency === "PCT" && r.amount > 100) {
      return NextResponse.json({ error: `Range ${i + 1}: percentage cannot exceed 100` }, { status: 400 });
    }
  }

  const config = await db.commissionConfig.upsert({
    where: { id: "singleton" },
    update: {
      type: "FLEXIBLE",
      fixedAmount: null,
      fixedCurrency: null,
      flexibleRanges: ranges,
      updatedById: session.userId,
    },
    create: {
      id: "singleton",
      type: "FLEXIBLE",
      flexibleRanges: ranges,
      updatedById: session.userId,
    },
  });

  return NextResponse.json({ ok: true, updatedAt: config.updatedAt });
}
