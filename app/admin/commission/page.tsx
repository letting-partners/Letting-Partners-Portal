import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { db } from "@/server/db";
import { getAuthSession } from "@/server/auth";
import { CommissionClient } from "./commission-client";
import type { CommissionCurrency } from "@/lib/commission";

export const dynamic = "force-dynamic";

export default async function AdminCommissionPage() {
  const session = await getAuthSession();
  if (!session) redirect("/admin/login");

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { role: true, isActive: true },
  });
  if (!user || !user.isActive) redirect("/admin/login");
  if (user.role !== UserRole.ADMIN) redirect("/dashboard");

  const raw = await db.commissionConfig.findUnique({ where: { id: "singleton" } });

  const config = raw
    ? {
        type: raw.type as "FIXED" | "FLEXIBLE",
        fixedAmount: raw.fixedAmount ? Number(raw.fixedAmount) : null,
        fixedCurrency: (raw.fixedCurrency ?? null) as CommissionCurrency | null,
        flexibleRanges: raw.flexibleRanges
          ? (raw.flexibleRanges as import("@/lib/commission").FlexibleRange[])
          : null,
        updatedAt: raw.updatedAt.toISOString(),
        updatedById: raw.updatedById,
      }
    : {
        type: "FIXED" as const,
        fixedAmount: 5000,
        fixedCurrency: "PKR" as CommissionCurrency,
        flexibleRanges: null,
        updatedAt: null,
        updatedById: null,
      };

  return <CommissionClient initial={config} />;
}
