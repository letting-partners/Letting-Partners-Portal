import type { NextRequest } from "next/server";
import { getAuthSessionFromRequest } from "@/server/auth/session";
import { db } from "@/server/db";
import { hashPassword, verifyPassword } from "@/server/auth/password";

export async function GET(request: NextRequest) {
  const session = getAuthSessionFromRequest(request);
  if (!session) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

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

  if (!user) {
    return Response.json({ message: "User not found." }, { status: 404 });
  }

  return Response.json({ user });
}

export async function PATCH(request: NextRequest) {
  const session = getAuthSessionFromRequest(request);
  if (!session) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ message: "Invalid request body." }, { status: 400 });
  }

  // Update display name
  if (typeof body.agentDisplayName === "string") {
    const name = body.agentDisplayName.trim();
    if (!name) {
      return Response.json({ message: "Display name cannot be empty." }, { status: 400 });
    }
    if (name.length > 80) {
      return Response.json({ message: "Display name is too long." }, { status: 400 });
    }

    await db.user.update({
      where: { id: session.userId },
      data: { agentDisplayName: name },
    });

    return Response.json({ message: "Display name updated successfully." });
  }

  // Change password
  if (typeof body.currentPassword === "string" && typeof body.newPassword === "string") {
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { passwordHash: true },
    });

    if (!user) {
      return Response.json({ message: "User not found." }, { status: 404 });
    }

    const valid = await verifyPassword(body.currentPassword, user.passwordHash);
    if (!valid) {
      return Response.json({ message: "Current password is incorrect." }, { status: 400 });
    }

    if (body.newPassword.length < 8) {
      return Response.json(
        { message: "New password must be at least 8 characters." },
        { status: 400 }
      );
    }

    if (body.newPassword === body.currentPassword) {
      return Response.json(
        { message: "New password must be different from your current password." },
        { status: 400 }
      );
    }

    const newHash = await hashPassword(body.newPassword);
    await db.user.update({
      where: { id: session.userId },
      data: { passwordHash: newHash },
    });

    return Response.json({ message: "Password changed successfully." });
  }

  // Update profile picture
  if ("profilePicture" in body) {
    const pic = body.profilePicture;
    if (pic !== null && typeof pic !== "string") {
      return Response.json({ message: "Invalid profilePicture value." }, { status: 400 });
    }
    if (typeof pic === "string") {
      if (!pic.startsWith("data:image/")) {
        return Response.json({ message: "Profile picture must be a valid image data URL." }, { status: 400 });
      }
      // Limit to ~2MB base64
      if (pic.length > 2_800_000) {
        return Response.json({ message: "Profile picture must be smaller than 2 MB." }, { status: 400 });
      }
    }
    await db.user.update({
      where: { id: session.userId },
      data: { profilePicture: pic },
    });
    return Response.json({ message: "Profile picture updated." });
  }

  return Response.json({ message: "Nothing to update." }, { status: 400 });
}
