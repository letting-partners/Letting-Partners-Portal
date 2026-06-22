import { UserRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { getAuthSession } from "@/server/auth";
import { db } from "@/server/db";
import { ProfileClient } from "@/app/(protected)/profile/profile-client";

export const dynamic = "force-dynamic";

export default async function AdminProfilePage() {
  const session = await getAuthSession();
  if (!session) redirect("/admin/login");

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      email: true,
      agentDisplayName: true,
      profilePicture: true,
      role: true,
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

  if (!user || !user.isActive) redirect("/admin/login");
  if (user.role !== UserRole.ADMIN) redirect("/dashboard");

  return (
    <ProfileClient
      user={{
        id: user.id,
        email: user.email,
        agentDisplayName: user.agentDisplayName,
        profilePicture: user.profilePicture,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt.toISOString(),
        ownedLandlords: user._count.ownedLandlords,
        ownedProperties: user._count.ownedProperties,
      }}
    />
  );
}
