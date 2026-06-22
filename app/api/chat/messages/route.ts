import { NextRequest, NextResponse } from "next/server";
import { getAuthSessionFromRequest } from "@/server/auth/session";
import { db } from "@/server/db";
import { UserRole } from "@prisma/client";

const MSG_SELECT = {
  id: true,
  content: true,
  isRead: true,
  createdAt: true,
  fromUserId: true,
  toUserId: true,
  fromUser: { select: { agentDisplayName: true, role: true } },
} as const;

// GET /api/chat/messages?agentId=ID  (admin fetching agent conversation)
// GET /api/chat/messages?userId=ID   (agent fetching conversation with any user)
export async function GET(request: NextRequest) {
  const session = await getAuthSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);

  if (session.role === UserRole.ADMIN) {
    const agentId = searchParams.get("agentId");
    if (!agentId) return NextResponse.json({ error: "agentId required" }, { status: 400 });

    const messages = await db.chatMessage.findMany({
      where: {
        OR: [
          { fromUserId: session.userId, toUserId: agentId },
          { fromUserId: agentId, toUserId: session.userId },
        ],
      },
      orderBy: { createdAt: "asc" },
      select: MSG_SELECT,
    });

    await db.chatMessage.updateMany({
      where: { fromUserId: agentId, toUserId: session.userId, isRead: false },
      data: { isRead: true },
    });

    return NextResponse.json({ messages });
  }

  // Agent: fetch messages with specified user (another agent or admin)
  const userId = searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const otherUser = await db.user.findUnique({
    where: { id: userId, isActive: true },
    select: { id: true },
  });
  if (!otherUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const messages = await db.chatMessage.findMany({
    where: {
      OR: [
        { fromUserId: session.userId, toUserId: userId },
        { fromUserId: userId, toUserId: session.userId },
      ],
    },
    orderBy: { createdAt: "asc" },
    select: MSG_SELECT,
  });

  await db.chatMessage.updateMany({
    where: { fromUserId: userId, toUserId: session.userId, isRead: false },
    data: { isRead: true },
  });

  return NextResponse.json({ messages });
}

// POST /api/chat/messages
// Body: { toUserId: string, content: string }
export async function POST(request: NextRequest) {
  const session = await getAuthSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { toUserId, content } = body as { toUserId?: string; content?: string };

  if (!toUserId || !content?.trim()) {
    return NextResponse.json({ error: "toUserId and content required" }, { status: 400 });
  }

  if (toUserId === session.userId) {
    return NextResponse.json({ error: "Cannot message yourself" }, { status: 400 });
  }

  const recipient = await db.user.findUnique({
    where: { id: toUserId },
    select: { id: true, isActive: true },
  });
  if (!recipient || !recipient.isActive) {
    return NextResponse.json({ error: "Recipient not found" }, { status: 404 });
  }

  const message = await db.chatMessage.create({
    data: { fromUserId: session.userId, toUserId, content: content.trim() },
    select: MSG_SELECT,
  });

  return NextResponse.json({ message });
}
