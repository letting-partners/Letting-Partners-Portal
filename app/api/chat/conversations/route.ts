import { NextRequest, NextResponse } from "next/server";
import { getAuthSessionFromRequest } from "@/server/auth/session";
import { db } from "@/server/db";
import { UserRole } from "@prisma/client";

// GET /api/chat/conversations
// Admin: list all agents with last message preview and unread count
// Agent: list all other users (other agents + admin) with last message and unread count
export async function GET(request: NextRequest) {
  const session = await getAuthSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (session.role === UserRole.ADMIN) {
    const agents = await db.user.findMany({
      where: { role: UserRole.AGENT, isActive: true },
      select: { id: true, agentDisplayName: true, email: true },
      orderBy: { agentDisplayName: "asc" },
    });

    const conversations = await Promise.all(
      agents.map(async (agent) => {
        const [lastMessage, unreadCount] = await Promise.all([
          db.chatMessage.findFirst({
            where: {
              OR: [
                { fromUserId: session.userId, toUserId: agent.id },
                { fromUserId: agent.id, toUserId: session.userId },
              ],
            },
            orderBy: { createdAt: "desc" },
            select: { content: true, createdAt: true, fromUserId: true },
          }),
          db.chatMessage.count({
            where: { fromUserId: agent.id, toUserId: session.userId, isRead: false },
          }),
        ]);

        return {
          agent: { id: agent.id, name: agent.agentDisplayName, email: agent.email },
          lastMessage,
          unreadCount,
        };
      }),
    );

    return NextResponse.json({ conversations });
  }

  // Agent: return conversations with all other active users
  const otherUsers = await db.user.findMany({
    where: { isActive: true, id: { not: session.userId } },
    select: { id: true, agentDisplayName: true, email: true, role: true },
    orderBy: [{ role: "asc" }, { agentDisplayName: "asc" }],
  });

  const conversations = await Promise.all(
    otherUsers.map(async (user) => {
      const [lastMessage, unreadCount] = await Promise.all([
        db.chatMessage.findFirst({
          where: {
            OR: [
              { fromUserId: session.userId, toUserId: user.id },
              { fromUserId: user.id, toUserId: session.userId },
            ],
          },
          orderBy: { createdAt: "desc" },
          select: { content: true, createdAt: true, fromUserId: true },
        }),
        db.chatMessage.count({
          where: { fromUserId: user.id, toUserId: session.userId, isRead: false },
        }),
      ]);

      return {
        user: { id: user.id, name: user.agentDisplayName, email: user.email, role: user.role as string },
        lastMessage,
        unreadCount,
      };
    }),
  );

  return NextResponse.json({ conversations });
}
