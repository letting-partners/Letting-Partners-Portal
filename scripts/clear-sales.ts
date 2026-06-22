/**
 * One-time script: clear all sales and reset CLOSED properties/rooms.
 * Run with: node --import tsx scripts/clear-sales.ts
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const { cleared } = await db.$transaction(async (tx) => {
    const saleCount = await tx.sale.count();
    console.log(`Found ${saleCount} sale(s) to delete.`);

    // Cascade deletes Tenant records linked to sales (onDelete: Cascade in schema)
    await tx.sale.deleteMany({});

    const { count: propertiesReset } = await tx.property.updateMany({
      where: { status: "CLOSED" },
      data: { status: "AVAILABLE" },
    });

    const { count: roomsReset } = await tx.propertyRoom.updateMany({
      where: { status: "CLOSED" },
      data: { status: "AVAILABLE" },
    });

    console.log(`Reset ${propertiesReset} CLOSED properties -> AVAILABLE.`);
    console.log(`Reset ${roomsReset} CLOSED rooms -> AVAILABLE.`);
    return { cleared: saleCount };
  });

  console.log(`Done. Cleared ${cleared} sale(s).`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());