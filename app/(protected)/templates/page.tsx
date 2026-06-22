import { redirect } from "next/navigation";
import { getAuthSession } from "@/server/auth";
import { db } from "@/server/db";
import { TemplatesClient } from "./templates-client";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const session = await getAuthSession();
  if (!session) redirect("/login");

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { agentDisplayName: true, isActive: true },
  });
  if (!user || !user.isActive) redirect("/login");

  return <TemplatesClient agentName={user.agentDisplayName ?? session.email} />;
}
