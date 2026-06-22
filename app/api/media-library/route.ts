import { UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole, requireUser } from "@/server/auth";
import { db } from "@/server/db";

const MAX_FILE_COUNT = 10;
const MAX_DATA_URL_LENGTH = 2_800_000;

const uploadMediaSchema = z
  .object({
    files: z
      .array(
        z
          .object({
            name: z.string().trim().min(1).max(200).optional(),
            dataUrl: z.string().min(1),
          })
          .strict(),
      )
      .min(1)
      .max(MAX_FILE_COUNT),
  })
  .strict();

const mediaAssetMetaSelect = {
  id: true,
  name: true,
  mimeType: true,
  createdAt: true,
  uploadedBy: {
    select: {
      id: true,
      agentDisplayName: true,
      email: true,
    },
  },
} as const;

const mediaAssetSelect = {
  ...mediaAssetMetaSelect,
  dataUrl: true,
} as const;

function getMimeTypeFromDataUrl(dataUrl: string): string | null {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,/);
  return match?.[1] ?? null;
}

export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (!auth.ok) {
    return auth.response;
  }

  const roleCheck = requireRole(auth.user, [UserRole.ADMIN, UserRole.AGENT]);
  if (!roleCheck.ok) {
    return roleCheck.response;
  }

  const assets = await db.mediaAsset.findMany({
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: mediaAssetMetaSelect,
  });

  return NextResponse.json({
    assets: assets.map((a) => ({ ...a, imageUrl: `/api/media-library/${a.id}/image` })),
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (!auth.ok) {
    return auth.response;
  }

  const roleCheck = requireRole(auth.user, [UserRole.ADMIN, UserRole.AGENT]);
  if (!roleCheck.ok) {
    return roleCheck.response;
  }

  let payload: z.infer<typeof uploadMediaSchema>;
  try {
    payload = uploadMediaSchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json(
      {
        error: "INVALID_REQUEST",
        message: "Invalid media upload payload.",
        details: error instanceof z.ZodError ? error.flatten() : undefined,
      },
      { status: 400 },
    );
  }

  for (const file of payload.files) {
    const mimeType = getMimeTypeFromDataUrl(file.dataUrl);
    if (!mimeType) {
      return NextResponse.json(
        {
          error: "INVALID_MEDIA",
          message: "Each upload must be a valid image data URL.",
        },
        { status: 400 },
      );
    }

    if (file.dataUrl.length > MAX_DATA_URL_LENGTH) {
      return NextResponse.json(
        {
          error: "MEDIA_TOO_LARGE",
          message: "Each optimized image must be smaller than 2 MB.",
        },
        { status: 400 },
      );
    }
  }

  const assets = await db.$transaction(async (tx) => {
    const createdIds: string[] = [];

    for (const file of payload.files) {
      const mimeType = getMimeTypeFromDataUrl(file.dataUrl);
      if (!mimeType) {
        throw new Error("INVALID_MEDIA");
      }

      const created = await tx.mediaAsset.create({
        data: {
          uploadedByUserId: auth.user.id,
          name: file.name?.trim() || `Property photo ${new Date().toISOString().slice(0, 10)}`,
          mimeType,
          dataUrl: file.dataUrl,
        },
        select: { id: true },
      });

      createdIds.push(created.id);
    }

    return tx.mediaAsset.findMany({
      where: {
        id: {
          in: createdIds,
        },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: mediaAssetSelect,
    });
  });

  return NextResponse.json({
    assets: assets.map((a) => ({ ...a, imageUrl: `/api/media-library/${a.id}/image` })),
  }, { status: 201 });
}
