import "server-only";

import type { Prisma, PrismaClient } from "@prisma/client";

type PrismaClientLike = Prisma.TransactionClient | PrismaClient;

export async function syncPropertyRoomCounts(db: PrismaClientLike, propertyId: string) {
  const rooms = await db.propertyRoom.findMany({
    where: { propertyId },
    select: { status: true },
  });

  const totalRooms = rooms.length;
  const availableRooms = rooms.filter((room) => room.status !== "CLOSED").length;

  await db.property.update({
    where: { id: propertyId },
    data: {
      totalRooms,
      availableRooms,
    },
    select: { id: true },
  });

  return { totalRooms, availableRooms };
}
