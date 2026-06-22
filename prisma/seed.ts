import { PrismaClient, UserRole } from "@prisma/client";
import { hashPassword } from "../server/auth/password";

const prisma = new PrismaClient();

function requireEnv(name: "ADMIN_EMAIL" | "ADMIN_PASSWORD"): string {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`${name} is required for seeding`);
  }

  return value.trim();
}

async function main(): Promise<void> {
  const adminEmail = requireEnv("ADMIN_EMAIL").toLowerCase();
  const adminPassword = requireEnv("ADMIN_PASSWORD");

  const existingAdmin = await prisma.user.findFirst({
    where: { role: UserRole.ADMIN },
    select: { id: true, email: true },
  });

  if (existingAdmin) {
    console.log(`[seed] Admin already exists (${existingAdmin.email}). No changes made.`);
    return;
  }

  const existingEmail = await prisma.user.findUnique({
    where: { email: adminEmail },
    select: { id: true, role: true },
  });

  if (existingEmail) {
    throw new Error(
      `[seed] Cannot create ADMIN. User with email ${adminEmail} exists with role ${existingEmail.role}.`,
    );
  }

  const passwordHash = await hashPassword(adminPassword);

  await prisma.user.create({
    data: {
      email: adminEmail,
      passwordHash,
      role: UserRole.ADMIN,
      agentDisplayName: "System Admin",
      isActive: true,
    },
  });

  console.log(`[seed] Created admin user ${adminEmail}`);
}

main()
  .catch((error) => {
    console.error("[seed] Failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
