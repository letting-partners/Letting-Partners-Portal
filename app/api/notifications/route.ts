import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { requireUser } from "@/server/auth/requireUser";

const prisma = db as any;

export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (!auth.ok) {
    return auth.response;
  }

  const url = new URL(request.url);
  const unreadOnly = url.searchParams.get("unreadOnly") === "1";

  const notifications = await prisma.notification.findMany({
    where: {
      userId: auth.user.id,
      ...(unreadOnly ? { isRead: false } : {}),
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 100,
  });

  return NextResponse.json({
    notifications,
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (!auth.ok) {
    return auth.response;
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "INVALID_PAYLOAD" }, { status: 400 });
  }

  const userId = auth.user.role === "ADMIN" && body.userId ? String(body.userId).trim() : auth.user.id;
  const type = String(body.type ?? body.notificationType ?? "GENERAL").trim();
  const title = String(body.title ?? "").trim();
  const bodyText = String(body.body ?? body.message ?? "").trim();

  if (!title || !bodyText) {
    return NextResponse.json({ error: "TITLE_AND_BODY_REQUIRED" }, { status: 400 });
  }

  const notification = await prisma.notification.create({
    data: {
      userId,
      type,
      title,
      body: bodyText,
      metadata: body.metadata ?? body.workflowMetadata ?? null,
    },
  });

  return NextResponse.json({
    notification,
  });
}
