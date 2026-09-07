"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";
import { requireAccess } from "@/services/permissions";
import { updateOwnProfile, UserError } from "@/services/users";
import { uploadImage } from "@/services/images";
import { isThemePreference, THEME_COOKIE } from "@/lib/theme";

/** What a user may change about their own account. */

export type ActionResult<T = null> = { ok: true; data: T } | { ok: false; error: string };

function fail(error: unknown): { ok: false; error: string } {
  if (error instanceof UserError) return { ok: false, error: error.message };
  if (error instanceof z.ZodError) {
    return { ok: false, error: error.issues[0]?.message ?? "Check the details and try again." };
  }
  console.error("Profile action failed:", error);
  return { ok: false, error: "Something went wrong. Please try again." };
}

const profileSchema = z.object({
  fullName: z.string().trim().min(1, "Enter your name.").max(160),
  phone: z.string().trim().max(32).optional().nullable(),
  jobTitle: z.string().trim().max(120).optional().nullable(),
  publicPhone: z.string().trim().max(32).optional().nullable(),
  publicEmail: z.string().trim().max(254).optional().nullable(),
  publicBio: z.string().trim().max(600).optional().nullable(),
  themePreference: z.enum(["LIGHT", "DARK", "SYSTEM"]),
  emailFollowUpReminders: z.boolean(),
  emailMissedCustomerChat: z.boolean(),
  inAppSound: z.boolean(),
});

export async function saveProfileAction(
  input: z.input<typeof profileSchema>,
): Promise<ActionResult> {
  try {
    const parsed = profileSchema.parse(input);
    const context = await requireAccess();

    await updateOwnProfile(
      {
        fullName: parsed.fullName,
        phone: parsed.phone ?? null,
        jobTitle: parsed.jobTitle ?? null,
        publicPhone: parsed.publicPhone ?? null,
        publicEmail: parsed.publicEmail ?? null,
        publicBio: parsed.publicBio ?? null,
        themePreference: parsed.themePreference,
        notificationPreferences: {
          emailFollowUpReminders: parsed.emailFollowUpReminders,
          emailMissedCustomerChat: parsed.emailMissedCustomerChat,
          inAppSound: parsed.inAppSound,
        },
      },
      context,
    );

    // Keep the cookie in step so the next paint uses the chosen theme.
    if (isThemePreference(parsed.themePreference)) {
      const cookieStore = await cookies();
      cookieStore.set(THEME_COOKIE, parsed.themePreference, {
        httpOnly: false,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
      });
    }

    revalidatePath("/profile");
    return { ok: true, data: null };
  } catch (error) {
    return fail(error);
  }
}

export async function uploadAvatarAction(
  formData: FormData,
): Promise<ActionResult<{ url: string }>> {
  try {
    const context = await requireAccess();

    const file = formData.get("file");
    if (!(file instanceof File)) return { ok: false, error: "Choose an image." };

    const asset = await uploadImage(file, context);
    await updateOwnProfile({ avatarUrl: asset.url }, context);

    revalidatePath("/profile");
    return { ok: true, data: { url: asset.url } };
  } catch (error) {
    return fail(error);
  }
}
