/**
 * Import data from JSON files (produced by export-neon-data.ts) into Hostinger MySQL.
 * Run this AFTER:
 *   1. DATABASE_URL is set to the Hostinger MySQL connection string
 *   2. `npx prisma generate` has been run (to regenerate the client for MySQL)
 *   3. `npx prisma db push` has been run (to create the schema on MySQL)
 *
 * Usage:
 *   node --import tsx scripts/import-mysql-data.ts
 */

import { PrismaClient } from '@prisma/client';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const prisma = new PrismaClient();
const DATA_DIR = resolve(process.cwd(), 'scripts/migration-data');

function load<T>(name: string): T[] {
  const file = resolve(DATA_DIR, `${name}.json`);
  if (!existsSync(file)) {
    console.warn(`  ⚠ ${name}.json not found — skipping`);
    return [];
  }
  return JSON.parse(readFileSync(file, 'utf-8')) as T[];
}

async function importTable(name: string, rows: Record<string, unknown>[], insert: (batch: typeof rows) => Promise<unknown>) {
  if (rows.length === 0) {
    console.log(`  – ${name}: no data`);
    return;
  }
  // Import in batches to avoid hitting max_allowed_packet limits
  const BATCH = 500;
  let total = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    await insert(batch);
    total += batch.length;
  }
  console.log(`  ✓ ${name}: ${total} rows`);
}

async function main() {
  console.log(`Importing from ${DATA_DIR}\n`);

  // 1. Users (no FK deps)
  await importTable('users', load('users'), (rows) =>
    prisma.user.createMany({ data: rows as any, skipDuplicates: true })
  );

  // 2. Singletons (optional FK to User)
  const commissions = load<any>('commissionConfigs');
  for (const row of commissions) {
    await prisma.commissionConfig.upsert({ where: { id: row.id }, create: row, update: row });
  }
  if (commissions.length) console.log(`  ✓ commissionConfigs: ${commissions.length} rows`);

  const domainConfigs = load<any>('dialerDomainConfigs');
  for (const row of domainConfigs) {
    await prisma.dialerDomainConfig.upsert({ where: { id: row.id }, create: row, update: row });
  }
  if (domainConfigs.length) console.log(`  ✓ dialerDomainConfigs: ${domainConfigs.length} rows`);

  // 3. Landlords (FK: User)
  await importTable('landlords', load('landlords'), (rows) =>
    prisma.landlord.createMany({ data: rows as any, skipDuplicates: true })
  );

  // 4. Properties (FK: Landlord, User)
  await importTable('properties', load('properties'), (rows) =>
    prisma.property.createMany({ data: rows as any, skipDuplicates: true })
  );

  // 5. PropertyRooms (FK: Property)
  await importTable('propertyRooms', load('propertyRooms'), (rows) =>
    prisma.propertyRoom.createMany({ data: rows as any, skipDuplicates: true })
  );

  // 6. MediaAssets (optional FK: User)
  await importTable('mediaAssets', load('mediaAssets'), (rows) =>
    prisma.mediaAsset.createMany({ data: rows as any, skipDuplicates: true })
  );

  // 7. Sales (FK: Property, PropertyRoom[opt], User)
  await importTable('sales', load('sales'), (rows) =>
    prisma.sale.createMany({ data: rows as any, skipDuplicates: true })
  );

  // 8. Tenants (optional FK: Sale, User)
  await importTable('tenants', load('tenants'), (rows) =>
    prisma.tenant.createMany({ data: rows as any, skipDuplicates: true })
  );

  // 9. PropertyMedia (FK: Property, MediaAsset)
  await importTable('propertyMedia', load('propertyMedia'), (rows) =>
    prisma.propertyMedia.createMany({ data: rows as any, skipDuplicates: true })
  );

  // 10. OTPCodes (FK: User)
  await importTable('otpCodes', load('otpCodes'), (rows) =>
    prisma.oTPCode.createMany({ data: rows as any, skipDuplicates: true })
  );

  // 11. AuditLogs (FK: User)
  await importTable('auditLogs', load('auditLogs'), (rows) =>
    prisma.auditLog.createMany({ data: rows as any, skipDuplicates: true })
  );

  // 12. ChatMessages (FK: User x2)
  await importTable('chatMessages', load('chatMessages'), (rows) =>
    prisma.chatMessage.createMany({ data: rows as any, skipDuplicates: true })
  );

  // 13. AgentDialerSettings (FK: User)
  await importTable('agentDialerSettings', load('agentDialerSettings'), (rows) =>
    prisma.agentDialerSetting.createMany({ data: rows as any, skipDuplicates: true })
  );

  // 14. DialerContactLabels (FK: User)
  await importTable('dialerContactLabels', load('dialerContactLabels'), (rows) =>
    prisma.dialerContactLabel.createMany({ data: rows as any, skipDuplicates: true })
  );

  // 15. DialerContacts (FK: User)
  await importTable('dialerContacts', load('dialerContacts'), (rows) =>
    prisma.dialerContact.createMany({ data: rows as any, skipDuplicates: true })
  );

  // 16. DialerContactLabelOnContacts (FK: DialerContact, DialerContactLabel)
  await importTable('dialerContactLabelOnContacts', load('dialerContactLabelOnContacts'), (rows) =>
    prisma.dialerContactLabelOnContact.createMany({ data: rows as any, skipDuplicates: true })
  );

  // 17. DialerCalls (FK: User, User[opt], DialerContact[opt])
  await importTable('dialerCalls', load('dialerCalls'), (rows) =>
    prisma.dialerCall.createMany({ data: rows as any, skipDuplicates: true })
  );

  // 18. PotentialTenants (FK: User)
  await importTable('potentialTenants', load('potentialTenants'), (rows) =>
    prisma.potentialTenant.createMany({ data: rows as any, skipDuplicates: true })
  );

  // 19. PotentialLandlords (FK: User, User[opt])
  await importTable('potentialLandlords', load('potentialLandlords'), (rows) =>
    prisma.potentialLandlord.createMany({ data: rows as any, skipDuplicates: true })
  );

  // 20. LandlordLookupEvents (FK: User, Landlord[opt], PotentialLandlord[opt])
  await importTable('landlordLookupEvents', load('landlordLookupEvents'), (rows) =>
    prisma.landlordLookupEvent.createMany({ data: rows as any, skipDuplicates: true })
  );

  // 21. DailyReports (FK: User)
  await importTable('dailyReports', load('dailyReports'), (rows) =>
    prisma.dailyReport.createMany({ data: rows as any, skipDuplicates: true })
  );

  // 22. EditApprovals (FK: User x2)
  await importTable('editApprovals', load('editApprovals'), (rows) =>
    prisma.editApproval.createMany({ data: rows as any, skipDuplicates: true })
  );

  // 23. CallRecords (FK: User, Landlord[opt], Tenant[opt])
  await importTable('callRecords', load('callRecords'), (rows) =>
    prisma.callRecord.createMany({ data: rows as any, skipDuplicates: true })
  );

  // 24. Notifications (FK: User)
  await importTable('notifications', load('notifications'), (rows) =>
    prisma.notification.createMany({ data: rows as any, skipDuplicates: true })
  );

  // 25. ScheduledCalls (FK: User)
  await importTable('scheduledCalls', load('scheduledCalls'), (rows) =>
    prisma.scheduledCall.createMany({ data: rows as any, skipDuplicates: true })
  );

  // 26. AgentNotes (FK: User)
  await importTable('agentNotes', load('agentNotes'), (rows) =>
    prisma.agentNote.createMany({ data: rows as any, skipDuplicates: true })
  );

  // 27. Legacy tables (no enforced FK)
  await importTable('callLogs', load('callLogs'), (rows) =>
    prisma.callLog.createMany({ data: rows as any, skipDuplicates: true })
  );
  await importTable('landlordLookupLogs', load('landlordLookupLogs'), (rows) =>
    prisma.landlordLookupLog.createMany({ data: rows as any, skipDuplicates: true })
  );

  console.log('\nImport complete. All data has been loaded into Hostinger MySQL.');
}

main()
  .catch((err) => { console.error('Import failed:', err); process.exit(1); })
  .finally(() => prisma.$disconnect());
