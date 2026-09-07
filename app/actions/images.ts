"use server";

import { revalidatePath } from "next/cache";
import { ForbiddenError, requireAccess } from "@/services/permissions";
import {
  archiveImage,
  attachToProperty,
  detachFromProperty,
  ImageError,
  setCoverImage,
  updateAltText,
  uploadImage,
} from "@/services/images";

/**
 * Image actions.
 *
 * Uploads come through a server action rather than a client-side token so the
 * file is validated, checksummed and given alt text before anything is stored.
 */

export type ActionResult<T = null> = { ok: true; data: T } | { ok: false; error: string };

function fail(error: unknown): { ok: false; error: string } {
  if (error instanceof ImageError) return { ok: false, error: error.message };
  if (error instanceof ForbiddenError) {
    return { ok: false, error: "You do not have permission to do that." };
  }
  console.error("Image action failed:", error);
  return { ok: false, error: "Something went wrong. Please try again." };
}

export async function uploadImageAction(
  formData: FormData,
): Promise<ActionResult<{ id: string; url: string; altText: string; fileName: string }>> {
  try {
    const context = await requireAccess();

    const file = formData.get("file");
    if (!(file instanceof File)) {
      return { ok: false, error: "Choose a file to upload." };
    }

    const propertyId = formData.get("propertyId");
    const index = formData.get("index");

    const result = await uploadImage(file, context, {
      propertyId: typeof propertyId === "string" && propertyId ? propertyId : null,
      index: typeof index === "string" ? Number(index) : undefined,
    });

    revalidatePath("/images");
    if (typeof propertyId === "string" && propertyId) {
      revalidatePath(`/properties/${propertyId}`);
    }

    return { ok: true, data: result };
  } catch (error) {
    return fail(error);
  }
}

export async function updateAltTextAction(
  assetId: string,
  altText: string,
): Promise<ActionResult> {
  try {
    const context = await requireAccess();
    await updateAltText(assetId, altText, context);
    revalidatePath("/images");
    return { ok: true, data: null };
  } catch (error) {
    return fail(error);
  }
}

export async function archiveImageAction(assetId: string): Promise<ActionResult> {
  try {
    const context = await requireAccess();
    await archiveImage(assetId, context);
    revalidatePath("/images");
    return { ok: true, data: null };
  } catch (error) {
    return fail(error);
  }
}

export async function attachImageAction(
  assetId: string,
  propertyId: string,
): Promise<ActionResult> {
  try {
    const context = await requireAccess();
    await attachToProperty(assetId, propertyId, context);
    revalidatePath(`/properties/${propertyId}`);
    return { ok: true, data: null };
  } catch (error) {
    return fail(error);
  }
}

export async function detachImageAction(
  assetId: string,
  propertyId: string,
): Promise<ActionResult> {
  try {
    const context = await requireAccess();
    await detachFromProperty(assetId, propertyId, context);
    revalidatePath(`/properties/${propertyId}`);
    return { ok: true, data: null };
  } catch (error) {
    return fail(error);
  }
}

export async function setCoverImageAction(
  assetId: string,
  propertyId: string,
): Promise<ActionResult> {
  try {
    const context = await requireAccess();
    await setCoverImage(assetId, propertyId, context);
    revalidatePath(`/properties/${propertyId}`);
    return { ok: true, data: null };
  } catch (error) {
    return fail(error);
  }
}
