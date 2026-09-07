import "server-only";
import { createHash } from "node:crypto";
import { and, count, desc, eq, ilike, isNull, or, sql as raw, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { imageAssets, properties, propertyImages } from "@/db/schema";
import { ENTITY, recordActivity, recordAudit } from "./audit";
import { loadPeopleMap } from "./landlords";
import { generateAltText, type AltTextContext } from "./alt-text";
import { deleteFile, StorageError, uploadFile } from "./storage";
import {
  canEditProperty,
  ForbiddenError,
  type AccessContext,
} from "./permissions";

/**
 * The shared image library.
 *
 * Assets are stored once and referenced by properties, so the same photo can
 * be reused without a second upload. Every asset gets alt text at upload time
 * - a listing photo with no alt text is an accessibility and SEO failure.
 */

export class ImageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageError";
  }
}

export type UploadResult = {
  id: string;
  url: string;
  altText: string;
  fileName: string;
};

/**
 * Upload one image and register it in the library.
 * When `propertyId` is given the asset is attached to that property and the
 * alt text is generated from its details.
 */
export async function uploadImage(
  file: File,
  context: AccessContext,
  options: { propertyId?: string | null; index?: number } = {},
): Promise<UploadResult> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const checksum = createHash("sha256").update(buffer).digest("hex");

  // The same file uploaded twice reuses the existing asset rather than
  // duplicating it in storage.
  const existing = await db
    .select()
    .from(imageAssets)
    .where(and(eq(imageAssets.checksum, checksum), isNull(imageAssets.deletedAt)))
    .limit(1);

  if (existing[0]) {
    if (options.propertyId) {
      await attachToProperty(existing[0].id, options.propertyId, context);
    }
    return {
      id: existing[0].id,
      url: existing[0].url,
      altText: existing[0].altText ?? "",
      fileName: existing[0].fileName,
    };
  }

  let altContext: AltTextContext | null = null;

  if (options.propertyId) {
    const rows = await db
      .select({
        propertyType: properties.propertyType,
        category: properties.category,
        area: properties.area,
        town: properties.town,
        outcode: properties.outcode,
        furnished: properties.furnished,
        numberOfRooms: properties.numberOfRooms,
        createdBy: properties.createdBy,
        originatingFronterId: properties.originatingFronterId,
        assignedAgentId: properties.assignedAgentId,
      })
      .from(properties)
      .where(and(eq(properties.id, options.propertyId), isNull(properties.deletedAt)))
      .limit(1);

    const property = rows[0];
    if (!property) throw new ImageError("That property no longer exists.");
    if (!canEditProperty(context, property)) throw new ForbiddenError();

    altContext = {
      propertyType: property.propertyType,
      category: property.category,
      area: property.area,
      town: property.town,
      outcode: property.outcode,
      furnished: property.furnished,
      bedrooms: property.numberOfRooms,
      index: options.index,
    };
  }

  let stored;
  try {
    stored = await uploadFile(file, "properties");
  } catch (error) {
    if (error instanceof StorageError) throw new ImageError(error.message);
    throw error;
  }

  const altText = altContext
    ? await generateAltText(stored.url, altContext)
    : file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ");

  const inserted = await db
    .insert(imageAssets)
    .values({
      fileName: file.name,
      url: stored.url,
      pathname: stored.pathname,
      contentType: stored.contentType,
      sizeBytes: stored.sizeBytes,
      checksum,
      altText,
      uploadedById: context.user.id,
    })
    .returning({ id: imageAssets.id });

  const asset = inserted[0];

  if (options.propertyId) {
    await attachToProperty(asset.id, options.propertyId, context);
  }

  await recordAudit({
    user: context.user,
    action: "CREATE",
    entityType: ENTITY.image,
    entityId: asset.id,
    entityLabel: file.name,
  });

  return { id: asset.id, url: stored.url, altText, fileName: file.name };
}

export async function attachToProperty(
  assetId: string,
  propertyId: string,
  context: AccessContext,
): Promise<void> {
  await db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(properties)
      .where(and(eq(properties.id, propertyId), isNull(properties.deletedAt)))
      .limit(1);

    const property = rows[0];
    if (!property) throw new ImageError("That property no longer exists.");
    if (!canEditProperty(context, property)) throw new ForbiddenError();

    const existing = await tx
      .select({ id: propertyImages.id })
      .from(propertyImages)
      .where(
        and(eq(propertyImages.propertyId, propertyId), eq(propertyImages.assetId, assetId)),
      )
      .limit(1);

    if (existing[0]) return;

    const [countRow] = await tx
      .select({ value: count() })
      .from(propertyImages)
      .where(eq(propertyImages.propertyId, propertyId));

    const position = Number(countRow?.value ?? 0);

    await tx.insert(propertyImages).values({
      propertyId,
      assetId,
      sortOrder: position,
      // The first photo on a property becomes its cover automatically.
      isCover: position === 0,
    });

    await recordActivity(
      {
        type: "PROPERTY_UPDATED",
        entityType: ENTITY.property,
        entityId: propertyId,
        actorId: context.user.id,
        summary: `${context.user.fullName} added a photo`,
      },
      tx,
    );
  });
}

export async function detachFromProperty(
  assetId: string,
  propertyId: string,
  context: AccessContext,
): Promise<void> {
  await db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(properties)
      .where(eq(properties.id, propertyId))
      .limit(1);

    const property = rows[0];
    if (!property) throw new ImageError("That property no longer exists.");
    if (!canEditProperty(context, property)) throw new ForbiddenError();

    const removed = await tx
      .delete(propertyImages)
      .where(
        and(eq(propertyImages.propertyId, propertyId), eq(propertyImages.assetId, assetId)),
      )
      .returning({ isCover: propertyImages.isCover });

    // Removing the cover promotes whatever is now first, so a listing is never
    // left without one.
    if (removed[0]?.isCover) {
      const next = await tx
        .select({ id: propertyImages.id })
        .from(propertyImages)
        .where(eq(propertyImages.propertyId, propertyId))
        .orderBy(propertyImages.sortOrder)
        .limit(1);

      if (next[0]) {
        await tx
          .update(propertyImages)
          .set({ isCover: true })
          .where(eq(propertyImages.id, next[0].id));
      }
    }
  });
}

export async function setCoverImage(
  assetId: string,
  propertyId: string,
  context: AccessContext,
): Promise<void> {
  await db.transaction(async (tx) => {
    const rows = await tx.select().from(properties).where(eq(properties.id, propertyId)).limit(1);
    const property = rows[0];
    if (!property) throw new ImageError("That property no longer exists.");
    if (!canEditProperty(context, property)) throw new ForbiddenError();

    await tx
      .update(propertyImages)
      .set({ isCover: false })
      .where(eq(propertyImages.propertyId, propertyId));

    await tx
      .update(propertyImages)
      .set({ isCover: true })
      .where(and(eq(propertyImages.propertyId, propertyId), eq(propertyImages.assetId, assetId)));
  });
}

export async function updateAltText(
  assetId: string,
  altText: string,
  context: AccessContext,
): Promise<void> {
  if (!altText.trim()) throw new ImageError("Alt text cannot be empty.");

  const rows = await db.select().from(imageAssets).where(eq(imageAssets.id, assetId)).limit(1);
  const asset = rows[0];
  if (!asset || asset.deletedAt) throw new ImageError("That image no longer exists.");

  // The uploader or an admin may correct alt text.
  if (asset.uploadedById !== context.user.id && !context.isAdmin && !context.isAgent) {
    throw new ForbiddenError();
  }

  await db
    .update(imageAssets)
    .set({ altText: altText.trim() })
    .where(eq(imageAssets.id, assetId));
}

export async function archiveImage(assetId: string, context: AccessContext): Promise<void> {
  const rows = await db.select().from(imageAssets).where(eq(imageAssets.id, assetId)).limit(1);
  const asset = rows[0];
  if (!asset) throw new ImageError("That image no longer exists.");
  if (asset.uploadedById !== context.user.id && !context.isAdmin) throw new ForbiddenError();

  const usages = await db
    .select({ value: count() })
    .from(propertyImages)
    .where(eq(propertyImages.assetId, assetId));

  if (Number(usages[0]?.value ?? 0) > 0) {
    throw new ImageError(
      "This image is used on a property. Remove it from the property first.",
    );
  }

  await db
    .update(imageAssets)
    .set({ deletedAt: new Date(), deletedBy: context.user.id })
    .where(eq(imageAssets.id, assetId));

  await deleteFile(asset.url);

  await recordAudit({
    user: context.user,
    action: "ARCHIVE",
    entityType: ENTITY.image,
    entityId: assetId,
    entityLabel: asset.fileName,
  });
}

export type ImageListFilters = {
  search?: string;
  mine?: boolean;
  page?: number;
  pageSize?: number;
};

export async function listImages(context: AccessContext, filters: ImageListFilters = {}) {
  const page = Math.max(filters.page ?? 1, 1);
  const pageSize = Math.min(Math.max(filters.pageSize ?? 36, 1), 100);

  const conditions: (SQL | undefined)[] = [isNull(imageAssets.deletedAt)];

  if (filters.search) {
    const term = `%${filters.search.trim()}%`;
    conditions.push(or(ilike(imageAssets.fileName, term), ilike(imageAssets.altText, term)));
  }

  if (filters.mine) conditions.push(eq(imageAssets.uploadedById, context.user.id));

  const where = and(...conditions);

  const [rows, totalRows] = await Promise.all([
    db
      .select({
        id: imageAssets.id,
        fileName: imageAssets.fileName,
        url: imageAssets.url,
        altText: imageAssets.altText,
        sizeBytes: imageAssets.sizeBytes,
        contentType: imageAssets.contentType,
        createdAt: imageAssets.createdAt,
        uploadedById: imageAssets.uploadedById,
        usageCount: raw<number>`(
          select count(*)::int from ${propertyImages} pi where pi.asset_id = ${imageAssets.id}
        )`,
      })
      .from(imageAssets)
      .where(where)
      .orderBy(desc(imageAssets.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),

    db.select({ value: count() }).from(imageAssets).where(where),
  ]);

  const total = Number(totalRows[0]?.value ?? 0);
  const people = await loadPeopleMap(rows.map((row) => row.uploadedById));

  return {
    rows: rows.map((row) => ({
      ...row,
      uploadedBy: people.get(row.uploadedById) ?? null,
      usageCount: Number(row.usageCount),
    })),
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}
