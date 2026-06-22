import { getAuthSession } from "@/server/auth";
import { LandlordsRegistryClient } from "./registry-client";

export const dynamic = "force-dynamic";

export default async function LandlordsPage() {
  const session = await getAuthSession();
  if (!session) {
    return null;
  }

  return <LandlordsRegistryClient currentUserId={session.userId} currentRole={session.role} />;
}
