/**
 * Export all data from Neon (PostgreSQL) to JSON files.
 * Run this BEFORE switching DATABASE_URL to Hostinger MySQL.
 *
 * Usage:
 *   node --import tsx scripts/export-neon-data.ts
 *
 * Output: scripts/migration-data/*.json
 */

import { PrismaClient } from '@prisma/client';
import { writeFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';

const prisma = new PrismaClient();
const OUT_DIR = resolve(process.cwd(), 'scripts/migration-data');

// Prisma Decimal serialises to a Decimal.js object; force it to a plain string.
function replacer(_key: string, value: unknown): unknown {
  if (value !== null && typeof value === 'object' && (value as any).constructor?.name === 'Decimal') {
    return (value as any).toString();
  }
  return value;
}

async function exportTable(name: string, rows: unknown[]) {
  const file = resolve(OUT_DIR, `${name}.json`);
  writeFileSync(file, JSON.stringify(rows, replacer, 2));
  console.log(`  ✓ ${name}: ${rows.length} rows`);
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  console.log(`Exporting to ${OUT_DIR}\n`);

  await exportTable('users',                        await prisma.user.findMany());
  await exportTable('commissionConfigs',            await prisma.commissionConfig.findMany());
  await exportTable('dialerDomainConfigs',          await prisma.dialerDomainConfig.findMany());
  await exportTable('landlords',                    await prisma.landlord.findMany());
  await exportTable('properties',                   await prisma.property.findMany());
  await exportTable('propertyRooms',                await prisma.propertyRoom.findMany());
  await exportTable('mediaAssets',                  await prisma.mediaAsset.findMany());
  await exportTable('sales',                        await prisma.sale.findMany());
  await exportTable('tenants',                      await prisma.tenant.findMany());
  await exportTable('propertyMedia',                await prisma.propertyMedia.findMany());
  await exportTable('otpCodes',                     await prisma.oTPCode.findMany());
  await exportTable('auditLogs',                    await prisma.auditLog.findMany());
  await exportTable('chatMessages',                 await prisma.chatMessage.findMany());
  await exportTable('agentDialerSettings',          await prisma.agentDialerSetting.findMany());
  await exportTable('dialerContactLabels',          await prisma.dialerContactLabel.findMany());
  await exportTable('dialerContacts',               await prisma.dialerContact.findMany());
  await exportTable('dialerContactLabelOnContacts', await prisma.dialerContactLabelOnContact.findMany());
  await exportTable('dialerCalls',                  await prisma.dialerCall.findMany());
  await exportTable('potentialTenants',             await prisma.potentialTenant.findMany());
  await exportTable('potentialLandlords',           await prisma.potentialLandlord.findMany());
  await exportTable('landlordLookupEvents',         await prisma.landlordLookupEvent.findMany());
  await exportTable('dailyReports',                 await prisma.dailyReport.findMany());
  await exportTable('editApprovals',                await prisma.editApproval.findMany());
  await exportTable('callRecords',                  await prisma.callRecord.findMany());
  await exportTable('notifications',                await prisma.notification.findMany());
  await exportTable('scheduledCalls',               await prisma.scheduledCall.findMany());
  await exportTable('agentNotes',                   await prisma.agentNote.findMany());
  await exportTable('callLogs',                     await prisma.callLog.findMany());
  await exportTable('landlordLookupLogs',           await prisma.landlordLookupLog.findMany());

  console.log('\nExport complete. Files are in scripts/migration-data/');
  console.log('Next: update DATABASE_URL to Hostinger MySQL, run prisma db push, then run import-mysql-data.ts');
}

main()
  .catch((err) => { console.error('Export failed:', err); process.exit(1); })
  .finally(() => prisma.$disconnect());
