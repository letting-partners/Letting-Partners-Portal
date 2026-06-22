import { UserRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { AdminAuditClient } from "../audit-client";
import { getAuthSession } from "@/server/auth";
import { db } from "@/server/db";

export const dynamic = "force-dynamic";

export default async function AdminAuditPage() {
  const session = await getAuthSession();
  if (!session) {
    redirect("/admin/login");
  }

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: {
      role: true,
      isActive: true,
    },
  });

  if (!user || !user.isActive) {
    redirect("/admin/login");
  }

  if (user.role !== UserRole.ADMIN) {
    redirect("/dashboard");
  }

  return <AdminAuditClient />;
}
