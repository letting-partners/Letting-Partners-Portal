"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { userRoleEnum } from "@/db/schema";
import { ForbiddenError, requireAdmin } from "@/services/permissions";
import {
  createUser,
  setUserCommissionRule,
  setUserStatus,
  updateUser,
  UserError,
} from "@/services/users";

/** Administration actions for staff accounts. */

export type ActionResult<T = null> = { ok: true; data: T } | { ok: false; error: string };

function fail(error: unknown): { ok: false; error: string } {
  if (error instanceof UserError) return { ok: false, error: error.message };
  if (error instanceof ForbiddenError) {
    return { ok: false, error: "Only an administrator can do that." };
  }
  if (error instanceof z.ZodError) {
    return { ok: false, error: error.issues[0]?.message ?? "Check the details and try again." };
  }
  console.error("User action failed:", error);
  return { ok: false, error: "Something went wrong. Please try again." };
}

function refresh(userId?: string) {
  revalidatePath("/team/users");
  revalidatePath("/team/agents");
  revalidatePath("/team/fronters");
  if (userId) revalidatePath(`/team/users/${userId}`);
}

const createSchema = z.object({
  fullName: z.string().trim().min(1, "Enter the person's name.").max(160),
  email: z.string().trim().min(1, "Enter an email address.").max(254),
  phone: z.string().trim().max(32).optional().nullable(),
  role: z.enum(userRoleEnum.enumValues),
  jobTitle: z.string().trim().max(120).optional().nullable(),
  assignedAgentId: z.string().uuid().optional().nullable(),
  commissionType: z.enum(["PERCENTAGE", "FIXED"]).optional().nullable(),
  commissionValue: z.number().int().nonnegative().optional().nullable(),
});

export async function createUserAction(
  input: z.input<typeof createSchema>,
): Promise<ActionResult<{ userId: string }>> {
  try {
    const parsed = createSchema.parse(input);
    const context = await requireAdmin();

    const user = await createUser(
      {
        fullName: parsed.fullName,
        email: parsed.email,
        phone: parsed.phone ?? null,
        role: parsed.role,
        jobTitle: parsed.jobTitle ?? null,
        assignedAgentId: parsed.assignedAgentId ?? null,
        commissionRule:
          parsed.commissionType && parsed.commissionValue != null
            ? { type: parsed.commissionType, value: parsed.commissionValue }
            : null,
      },
      context,
    );

    refresh();
    return { ok: true, data: { userId: user.id } };
  } catch (error) {
    return fail(error);
  }
}

export async function updateUserAction(
  userId: string,
  input: {
    fullName?: string;
    phone?: string | null;
    jobTitle?: string | null;
    role?: string;
    assignedAgentId?: string | null;
    publicPhone?: string | null;
    publicEmail?: string | null;
    publicBio?: string | null;
  },
): Promise<ActionResult> {
  try {
    const context = await requireAdmin();
    await updateUser(userId, { ...input, role: input.role as never }, context);
    refresh(userId);
    return { ok: true, data: null };
  } catch (error) {
    return fail(error);
  }
}

export async function setUserStatusAction(
  userId: string,
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED",
): Promise<ActionResult> {
  try {
    const context = await requireAdmin();
    await setUserStatus(userId, status, context);
    refresh(userId);
    return { ok: true, data: null };
  } catch (error) {
    return fail(error);
  }
}

export async function setUserCommissionAction(
  userId: string,
  rule: { type: "PERCENTAGE" | "FIXED"; value: number } | null,
  note?: string | null,
): Promise<ActionResult> {
  try {
    const context = await requireAdmin();
    await setUserCommissionRule(userId, rule, note ?? null, context);
    refresh(userId);
    revalidatePath("/settings/commissions");
    return { ok: true, data: null };
  } catch (error) {
    return fail(error);
  }
}
