import "server-only";
import type { Prisma, PrismaClient } from "@prisma/client";

type PrismaClientLike = Prisma.TransactionClient | PrismaClient;

export function normalizeMediaAssetIds(mediaAssetIds: string[] | undefined): string[] {
  if (!mediaAssetIds || mediaAssetIds.length === 0) {
    return [];
  }

  return [...new Set(mediaAssetIds.map((id) => id.trim()).filter(Boolean))];
}

export async function assertMediaAssetsExist(
  db: PrismaClientLike,
  mediaAssetIds: string[],
): Promise<void> {
  if (mediaAssetIds.length === 0) {
    return;
  }

  const count = await db.mediaAsset.count({
    where: {
      id: {
        in: mediaAssetIds,
      },
    },
  });

  if (count !== mediaAssetIds.length) {
    throw new Error("MEDIA_ASSET_NOT_FOUND");
  }
}

export function buildPropertyMediaRows(
  propertyId: string,
  mediaAssets: Array<{ id: string; altText?: string | null }>,
) {
  return mediaAssets.map(({ id, altText }, index) => ({
    propertyId,
    mediaAssetId: id,
    sortOrder: index,
    altText: altText?.trim() || null,
  }));
}

type MediaLinkLike = {
  altText?: string | null;
  mediaAsset: Record<string, unknown>;
};

type ImageEntry<TMedia> = TMedia & { altText?: string | null };

type MediaAssetFromProperty<T> = T extends {
  mediaLinks?: Array<{ mediaAsset: infer TMedia }>;
}
  ? TMedia
  : never;

export function serializePropertyImages<
  T extends {
    mediaLinks?: MediaLinkLike[];
  },
>(property: T): Omit<T, "mediaLinks"> & { images: ImageEntry<MediaAssetFromProperty<T>>[] } {
  const { mediaLinks = [], ...rest } = property as T & {
    mediaLinks?: MediaLinkLike[];
  };

  return {
    ...rest,
    images: mediaLinks.map((link) => ({
      ...link.mediaAsset,
      imageUrl: `/api/media-library/${(link.mediaAsset as { id: string }).id}/image`,
      altText: link.altText ?? null,
    })),
  } as unknown as Omit<T, "mediaLinks"> & { images: ImageEntry<MediaAssetFromProperty<T>>[] };
}

export function serializePropertyImageList<
  T extends {
    mediaLinks?: MediaLinkLike[];
  },
>(properties: T[]): Array<Omit<T, "mediaLinks"> & { images: MediaAssetFromProperty<T>[] }> {
  return properties.map((property) => serializePropertyImages(property));
}
