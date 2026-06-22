import { redirect } from "next/navigation";
import { getAuthSession } from "@/server/auth";
import { db } from "@/server/db";
import { MediaLibraryClient } from "./media-library-client";

export const dynamic = "force-dynamic";

export default async function MediaLibraryPage() {
  const session = await getAuthSession();
  if (!session) redirect("/login");
  if (session.role !== "ADMIN") redirect("/dashboard");

  const assets = await db.mediaAsset.findMany({
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      name: true,
      mimeType: true,
      createdAt: true,
      uploadedBy: {
        select: { id: true, agentDisplayName: true, email: true },
      },
    },
  });

  const serialized = assets.map((a) => ({
    ...a,
    imageUrl: `/api/media-library/${a.id}/image`,
    createdAt: a.createdAt.toISOString(),
    uploadedBy: a.uploadedBy
      ? {
          id: a.uploadedBy.id,
          agentDisplayName: a.uploadedBy.agentDisplayName ?? "",
          email: a.uploadedBy.email,
        }
      : null,
  }));

  return <MediaLibraryClient initialAssets={serialized} />;
}
