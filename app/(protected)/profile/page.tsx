import { getAuthSession } from "@/server/auth";
import { db } from "@/server/db";
import { ProfileClient } from "./profile-client";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const session = await getAuthSession();
  if (!session) return null;

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

  if (!user) return null;

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
