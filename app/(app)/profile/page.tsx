import type { Metadata } from "next";
import { pageAccess } from "@/lib/auth/page-guard";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { PageHeader } from "@/components/ui/layout";
import ProfileForm from "./ProfileForm";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const context = await pageAccess();

  const rows = await db.select().from(users).where(eq(users.id, context.user.id)).limit(1);
  const user = rows[0];

  return (
    <>
      <PageHeader
        title="Profile and preferences"
        subtitle="Your details, how the portal looks, and when we email you."
      />

      <ProfileForm
        isAgent={context.isAgent || context.isAdmin}
        initial={{
          fullName: user.fullName,
          email: user.email,
          phone: user.phone ?? "",
          jobTitle: user.jobTitle ?? "",
          role: user.role,
          avatarUrl: user.avatarUrl,
          publicPhone: user.publicPhone ?? "",
          publicEmail: user.publicEmail ?? "",
          publicBio: user.publicBio ?? "",
          themePreference: user.themePreference,
          notifications: user.notificationPreferences,
        }}
      />
    </>
  );
}
