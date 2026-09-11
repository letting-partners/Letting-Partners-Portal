import { config as loadEnv } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql as raw } from "drizzle-orm";
import postgres from "postgres";
import * as schema from "../db/schema";
import { calculateCommission } from "../services/commission-engine";
import { monthlyToWeeklyPence } from "../lib/money";
import { normalizeUKPhone } from "../lib/phone";
import { formatPostcode, getOutcode } from "../lib/postcode";
import { buildPropertySlug } from "../lib/slug";
import { formatReference, REFERENCE_PREFIX } from "../lib/reference";

loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

/**
 * Development seed.
 *
 * Creates a realistic slice of the business so every screen has something to
 * show: a team, landlords, a full property and a shared property with rooms,
 * calls with each outcome, a locked follow-up, a completed sale with a real
 * commission snapshot, and an accepted cross-sell.
 *
 * Refuses to run against production unless explicitly forced.
 */

const FORCE = process.argv.includes("--force");
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? "admin@lettingpartners.co.uk";

if (process.env.NODE_ENV === "production" && !FORCE) {
  console.error("Refusing to seed a production database. Pass --force if you really mean it.");
  process.exit(1);
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Add it to portal/.env.local first.");
  process.exit(1);
}

/**
 * Works against a real Postgres server or the embedded PGlite build, so the
 * seed can run before a database has been provisioned.
 */
async function connect() {
  if (url!.startsWith("pglite:")) {
    const { PGlite } = await import("@electric-sql/pglite");
    const { drizzle: drizzlePglite } = await import("drizzle-orm/pglite");
    const client = new PGlite(url!.replace(/^pglite:(\/\/)?/, "") || "./.pglite");
    return {
      db: drizzlePglite(client, { schema, casing: "snake_case" }) as unknown as ReturnType<
        typeof drizzle<typeof schema>
      >,
      close: () => client.close(),
    };
  }

  const client = postgres(url!, { max: 1, prepare: false, connect_timeout: 30 });
  return {
    db: drizzle(client, { schema, casing: "snake_case" }),
    close: () => client.end(),
  };
}

type Connection = Awaited<ReturnType<typeof connect>>;

// Assigned at the start of main(): tsx compiles to CommonJS, which has no
// top-level await.
let connection!: Connection;
let db!: Connection["db"];

/** postgres.js returns rows directly; PGlite returns { rows }. */
async function readRows<T>(query: Parameters<typeof db.execute>[0]): Promise<T[]> {
  const result = (await db.execute(query)) as unknown;
  if (Array.isArray(result)) return result as T[];
  if (result && typeof result === "object" && Array.isArray((result as { rows?: unknown }).rows)) {
    return (result as { rows: T[] }).rows;
  }
  return [];
}

const POUND = 100;

function daysFromNow(days: number, hour = 10): Date {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, 0, 0, 0);
  return date;
}

function hoursAgo(hours: number): Date {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

function dateOnly(days: number): string {
  return daysFromNow(days).toISOString().slice(0, 10);
}

async function main() {
  connection = await connect();
  db = connection.db;

  console.log("Clearing existing data...");

  // Ordered so foreign keys never block the truncate.
  await db.execute(raw`
    truncate table
      commissions, sales, deal_stage_history, closings, verifications, viewings, deals,
      collaboration_participants, collaborations,
      customer_messages, customer_conversation_events, customer_conversations,
      internal_messages, internal_conversation_participants, internal_conversations,
      user_presence, notifications, notes, activities, audit_log,
      property_history, property_publications, property_images, image_assets,
      property_rooms, properties,
      not_interested_records, follow_ups, calls,
      landlord_ownership_history, landlords, tenants,
      user_commission_rules, agent_fronter_assignments, sessions, otp_codes, rate_limits,
      cross_sell_splits, commission_rules, exchange_rates, system_settings,
      users
    restart identity cascade
  `);

  await db.execute(raw`alter sequence property_reference_seq restart with 1000`);
  await db.execute(raw`alter sequence sale_reference_seq restart with 1`);

  /* ------------------------------------------------------------- people */

  console.log("Creating users...");

  const [admin] = await db
    .insert(schema.users)
    .values({
      email: ADMIN_EMAIL,
      fullName: "Admin",
      role: "SUPER_ADMIN",
      jobTitle: "Director",
      phone: "0203 897 7033",
      normalizedPhone: normalizeUKPhone("0203 897 7033"),
      publicEmail: "info@lettingpartners.co.uk",
      publicPhone: "0203 897 7033",
    })
    .returning();

  const [agentSarah, agentJames] = await db
    .insert(schema.users)
    .values([
      {
        email: "sarah.khan@lettingpartners.co.uk",
        fullName: "Sarah Khan",
        role: "AGENT",
        jobTitle: "Lettings Manager",
        phone: "07700 900101",
        normalizedPhone: normalizeUKPhone("07700 900101"),
        publicEmail: "sarah@lettingpartners.co.uk",
        publicPhone: "07700 900101",
        publicBio: "Lettings manager covering East London and Redbridge.",
        createdBy: admin.id,
      },
      {
        email: "james.smith@lettingpartners.co.uk",
        fullName: "James Smith",
        role: "AGENT",
        jobTitle: "Senior Lettings Agent",
        phone: "07700 900102",
        normalizedPhone: normalizeUKPhone("07700 900102"),
        publicEmail: "james@lettingpartners.co.uk",
        publicPhone: "07700 900102",
        publicBio: "Senior lettings agent covering Birmingham and the West Midlands.",
        createdBy: admin.id,
      },
    ])
    .returning();

  const fronters = await db
    .insert(schema.users)
    .values([
      {
        email: "ahmed.raza@lettingpartners.co.uk",
        fullName: "Ahmed Raza",
        role: "FRONTER",
        jobTitle: "Landlord Acquisition",
        phone: "07700 900201",
        normalizedPhone: normalizeUKPhone("07700 900201"),
        assignedAgentId: agentSarah.id,
        createdBy: admin.id,
      },
      {
        email: "aisha.begum@lettingpartners.co.uk",
        fullName: "Aisha Begum",
        role: "FRONTER",
        jobTitle: "Landlord Acquisition",
        phone: "07700 900202",
        normalizedPhone: normalizeUKPhone("07700 900202"),
        assignedAgentId: agentSarah.id,
        createdBy: admin.id,
      },
      {
        email: "daniel.okafor@lettingpartners.co.uk",
        fullName: "Daniel Okafor",
        role: "FRONTER",
        jobTitle: "Landlord Acquisition",
        phone: "07700 900203",
        normalizedPhone: normalizeUKPhone("07700 900203"),
        assignedAgentId: agentJames.id,
        createdBy: admin.id,
      },
      {
        email: "maria.silva@lettingpartners.co.uk",
        fullName: "Maria Silva",
        role: "FRONTER",
        jobTitle: "Landlord Acquisition",
        phone: "07700 900204",
        normalizedPhone: normalizeUKPhone("07700 900204"),
        assignedAgentId: agentJames.id,
        createdBy: admin.id,
      },
    ])
    .returning();

  const [ahmed, aisha, daniel] = fronters;

  await db.insert(schema.agentFronterAssignments).values(
    fronters.map((fronter) => ({
      fronterId: fronter.id,
      agentId: fronter.assignedAgentId!,
      assignedBy: admin.id,
      reason: "Initial team setup",
    })),
  );

  /* ---------------------------------------------------------- settings */

  console.log("Configuring commissions and settings...");

  await db.insert(schema.commissionRules).values([
    {
      scope: "FRONTER",
      commissionType: "PERCENTAGE",
      value: 1000, // 10.00% of gross
      createdById: admin.id,
      note: "Default fronter commission",
    },
    {
      scope: "AGENT",
      commissionType: "PERCENTAGE",
      value: 5000, // 50.00% of the amount remaining after the fronter
      createdById: admin.id,
      note: "Default agent commission",
    },
  ]);

  await db.insert(schema.crossSellSplits).values({
    propertyAgentBp: 6000,
    tenantAgentBp: 4000,
    createdById: admin.id,
  });

  await db.insert(schema.exchangeRates).values({
    rateX100: 36_900, // 369.00 PKR per GBP
    source: "MANUAL",
    updatedById: admin.id,
  });

  await db.insert(schema.systemSettings).values([
    {
      key: "company.name",
      value: "Letting Partners LTD" as never,
      updatedById: admin.id,
      description: "Registered company name",
    },
    {
      key: "company.phone",
      value: "0203 897 7033" as never,
      updatedById: admin.id,
    },
    {
      key: "company.email",
      value: "info@lettingpartners.co.uk" as never,
      updatedById: admin.id,
    },
  ]);

  /* --------------------------------------------------------- landlords */

  console.log("Creating landlords and properties...");

  const landlordSeed = [
    {
      name: "John Smith",
      phone: "07911 123456",
      email: "john.smith@example.com",
      fronter: ahmed,
      agent: agentSarah,
    },
    {
      name: "Priya Patel",
      phone: "07911 223344",
      email: "priya.patel@example.com",
      fronter: aisha,
      agent: agentSarah,
    },
    {
      name: "Mohammed Iqbal",
      phone: "07911 334455",
      email: null,
      fronter: daniel,
      agent: agentJames,
    },
  ];

  const landlordRows = await db
    .insert(schema.landlords)
    .values(
      landlordSeed.map((item) => ({
        name: item.name,
        email: item.email,
        originalPhone: item.phone,
        normalizedPhone: normalizeUKPhone(item.phone)!,
        gender: "PREFER_NOT_TO_SAY" as const,
        source: "CALL" as const,
        originatingFronterId: item.fronter.id,
        assignedAgentId: item.agent.id,
        createdBy: item.fronter.id,
        lastContactAt: new Date(),
      })),
    )
    .returning();

  const [johnSmith, priyaPatel, mohammedIqbal] = landlordRows;

  /* -------------------------------------------------------- properties */

  async function nextPropertyReference(): Promise<string> {
    const rows = await readRows<{ value: string }>(
      raw`select nextval('property_reference_seq')::text as value`,
    );
    return formatReference(REFERENCE_PREFIX.property, Number(rows[0].value));
  }

  /* A shared property in Manchester with three rooms. */
  const sharedReference = await nextPropertyReference();
  const sharedPostcode = formatPostcode("m14 5ab");

  const [sharedProperty] = await db
    .insert(schema.properties)
    .values({
      reference: sharedReference,
      landlordId: johnSmith.id,
      propertyType: "SHARED",
      category: "HOUSE",
      addressLine1: "42 Wilmslow Road",
      town: "Manchester",
      county: "Greater Manchester",
      postcode: sharedPostcode,
      outcode: getOutcode(sharedPostcode)!,
      formattedAddress: `42 Wilmslow Road, Manchester, ${sharedPostcode}`,
      area: "Rusholme",
      furnished: true,
      garden: true,
      parking: false,
      billsIncluded: true,
      wifi: true,
      couplesAllowed: true,
      petsAllowed: false,
      dssAllowed: true,
      childrenAllowed: false,
      livingLandlord: false,
      disabledAccess: false,
      balcony: false,
      livingRoom: "SHARED",
      bathrooms: 2,
      commissionType: "PERCENTAGE",
      commissionValue: 10_000, // 100% of one month of rent
      title: "Bright rooms in a furnished shared house, Rusholme",
      description:
        "A well maintained shared house a short walk from Wilmslow Road. Bills and Wi-Fi are included, and the kitchen, lounge and garden are shared between housemates. Rooms are furnished with a double bed, wardrobe and desk.",
      slug: buildPropertySlug({
        category: "HOUSE",
        town: "Manchester",
        postcode: sharedPostcode,
        reference: sharedReference,
      }),
      metaTitle: "Rooms to rent in a shared house, Rusholme, Manchester M14",
      metaDescription:
        "Furnished rooms in a shared house in Rusholme, Manchester M14. Bills and Wi-Fi included, garden, DSS considered.",
      listingStatus: "PUBLISHED",
      dealStage: "AVAILABLE",
      publishedAt: new Date(),
      publishedById: agentSarah.id,
      originatingFronterId: ahmed.id,
      assignedAgentId: agentSarah.id,
      createdBy: ahmed.id,
      source: "CALL",
    })
    .returning();

  const roomRents = [575, 620, 650];
  const rooms = await db
    .insert(schema.propertyRooms)
    .values(
      roomRents.map((rent, index) => ({
        propertyId: sharedProperty.id,
        name: `Room ${index + 1}`,
        sortOrder: index,
        availabilityDate: dateOnly(index === 0 ? 3 : 21),
        rentFrequency: "MONTHLY" as const,
        rentPerMonthPence: rent * POUND,
        rentPerWeekPence: monthlyToWeeklyPence(rent * POUND),
        depositPence: rent * POUND,
        commissionType: "PERCENTAGE" as const,
        commissionValue: 10_000,
        status: "AVAILABLE" as const,
      })),
    )
    .returning();

  /* A full flat in Ilford, published. */
  const flatReference = await nextPropertyReference();
  const flatPostcode = formatPostcode("ig1 1aa");

  const [flatProperty] = await db
    .insert(schema.properties)
    .values({
      reference: flatReference,
      landlordId: priyaPatel.id,
      propertyType: "FULL",
      category: "FLAT",
      addressLine1: "Flat 6, 18 Cranbrook Road",
      town: "Ilford",
      county: "Essex",
      postcode: flatPostcode,
      outcode: getOutcode(flatPostcode)!,
      formattedAddress: `Flat 6, 18 Cranbrook Road, Ilford, ${flatPostcode}`,
      area: "Ilford",
      furnished: true,
      garden: false,
      parking: true,
      billsIncluded: false,
      balcony: true,
      wifi: false,
      couplesAllowed: true,
      petsAllowed: false,
      dssAllowed: false,
      childrenAllowed: true,
      disabledAccess: false,
      livingLandlord: false,
      livingRoom: "PRIVATE",
      numberOfRooms: 2,
      availableRooms: 2,
      bathrooms: 1,
      availabilityDate: dateOnly(14),
      rentPerMonthPence: 1500 * POUND,
      rentPerWeekPence: monthlyToWeeklyPence(1500 * POUND),
      depositPence: 1730 * POUND,
      commissionType: "PERCENTAGE",
      commissionValue: 10_000,
      commissionAmountPence: 1500 * POUND,
      title: "Modern 2 bedroom flat with balcony and parking, Ilford",
      description:
        "A bright two bedroom flat moments from Ilford station and the Elizabeth line. The flat is fully furnished with a private lounge, a modern fitted kitchen, a balcony and an allocated parking space.",
      slug: buildPropertySlug({
        bedrooms: 2,
        category: "FLAT",
        town: "Ilford",
        postcode: flatPostcode,
        reference: flatReference,
      }),
      metaTitle: "2 bedroom flat to rent in Ilford IG1",
      metaDescription:
        "Furnished 2 bedroom flat in Ilford IG1 with balcony and parking, moments from the Elizabeth line.",
      listingStatus: "PUBLISHED",
      dealStage: "AVAILABLE",
      publishedAt: new Date(),
      publishedById: agentSarah.id,
      originatingFronterId: aisha.id,
      assignedAgentId: agentSarah.id,
      createdBy: aisha.id,
      source: "CALL",
    })
    .returning();

  /* A draft in Birmingham that still needs public details. */
  const draftReference = await nextPropertyReference();
  const draftPostcode = formatPostcode("b1 1aa");

  await db
    .insert(schema.properties)
    .values({
      reference: draftReference,
      landlordId: mohammedIqbal.id,
      propertyType: "FULL",
      category: "HOUSE",
      addressLine1: "77 Broad Street",
      town: "Birmingham",
      county: "West Midlands",
      postcode: draftPostcode,
      outcode: getOutcode(draftPostcode)!,
      formattedAddress: `77 Broad Street, Birmingham, ${draftPostcode}`,
      area: "Birmingham City Centre",
      furnished: false,
      numberOfRooms: 3,
      availableRooms: 3,
      bathrooms: 2,
      availabilityDate: dateOnly(30),
      rentPerMonthPence: 1250 * POUND,
      rentPerWeekPence: monthlyToWeeklyPence(1250 * POUND),
      depositPence: 1440 * POUND,
      commissionType: "PERCENTAGE",
      commissionValue: 10_000,
      commissionAmountPence: 1250 * POUND,
      listingStatus: "DRAFT",
      dealStage: "AVAILABLE",
      originatingFronterId: daniel.id,
      assignedAgentId: agentJames.id,
      createdBy: daniel.id,
      source: "CALL",
    })
    .returning();

  /* ------------------------------------------------------------ calls */

  console.log("Creating call history...");

  const callRows = await db
    .insert(schema.calls)
    .values([
      {
        originalPhone: "07911 123456",
        normalizedPhone: normalizeUKPhone("07911 123456")!,
        attemptNumber: 1,
        landlordId: johnSmith.id,
        calledById: ahmed.id,
        agentId: agentSarah.id,
        status: "COMPLETED",
        outcome: "INTERESTED",
        startedAt: daysFromNow(-6, 11),
        endedAt: daysFromNow(-6, 11),
        durationSeconds: 420,
        notes: "Happy for us to market three rooms.",
      },
      {
        originalPhone: "07911 998877",
        normalizedPhone: normalizeUKPhone("07911 998877")!,
        attemptNumber: 1,
        calledById: aisha.id,
        agentId: agentSarah.id,
        status: "COMPLETED",
        outcome: "NOT_INTERESTED",
        startedAt: daysFromNow(-4, 14),
        endedAt: daysFromNow(-4, 14),
        durationSeconds: 95,
        notes: "Not planning to rent until next year.",
      },
      {
        originalPhone: "07911 445566",
        normalizedPhone: normalizeUKPhone("07911 445566")!,
        attemptNumber: 1,
        calledById: ahmed.id,
        agentId: agentSarah.id,
        status: "COMPLETED",
        outcome: "FOLLOW_UP",
        startedAt: daysFromNow(-1, 15),
        endedAt: daysFromNow(-1, 15),
        durationSeconds: 180,
        notes: "Asked us to call back Friday afternoon.",
      },
      {
        originalPhone: "07911 778899",
        normalizedPhone: normalizeUKPhone("07911 778899")!,
        attemptNumber: 1,
        calledById: daniel.id,
        agentId: agentJames.id,
        status: "COMPLETED",
        outcome: "NO_ANSWER",
        startedAt: daysFromNow(0, 9),
        endedAt: daysFromNow(0, 9),
        durationSeconds: 30,
      },
    ])
    .returning();

  await db.insert(schema.notInterestedRecords).values({
    callId: callRows[1].id,
    originalPhone: "07911 998877",
    normalizedPhone: normalizeUKPhone("07911 998877")!,
    contactName: "Robert Hughes",
    reason: "NOT_CURRENTLY_RENTING",
    notes: "Not planning to rent until next year. Worth a call in the spring.",
    attemptNumber: 1,
    createdById: aisha.id,
    agentId: agentSarah.id,
    createdAt: daysFromNow(-4, 14),
  });

  /* An active follow-up: locked to Ahmed, and due today. */
  await db.insert(schema.followUps).values({
    callId: callRows[2].id,
    originalPhone: "07911 445566",
    normalizedPhone: normalizeUKPhone("07911 445566")!,
    contactName: "Elaine Foster",
    dueAt: daysFromNow(0, 14),
    priority: "HIGH",
    reason: "Asked to call back Friday afternoon",
    notes: "Landlord asked us to call Friday afternoon. Two flats in Redbridge.",
    status: "SCHEDULED",
    createdById: ahmed.id,
    agentId: agentSarah.id,
  });

  /* An overdue follow-up on another team, so the lock is visible. */
  await db.insert(schema.followUps).values({
    originalPhone: "07911 556677",
    normalizedPhone: normalizeUKPhone("07911 556677")!,
    contactName: "Gavin Wright",
    dueAt: daysFromNow(-2, 11),
    priority: "NORMAL",
    reason: "Deciding between agents",
    notes: "Comparing two agents. Wants our fee schedule in writing.",
    status: "SCHEDULED",
    createdById: daniel.id,
    agentId: agentJames.id,
  });

  /* ---------------------------------------------------------- tenants */

  console.log("Creating tenants...");

  const tenantRows = await db
    .insert(schema.tenants)
    .values([
      {
        name: "Michael Chen",
        email: "michael.chen@example.com",
        originalPhone: "07822 111222",
        normalizedPhone: normalizeUKPhone("07822 111222")!,
        area: "Manchester",
        postcodePreferences: "M14,M13,M20",
        requirements: "Single room in a friendly professional house share. Non smoker.",
        minBudgetPence: 500 * POUND,
        maxBudgetPence: 700 * POUND,
        moveInDate: dateOnly(10),
        propertyTypePreference: "HOUSE",
        bedrooms: 1,
        status: "ACTIVE",
        ownerAgentId: agentJames.id,
        createdBy: agentJames.id,
        source: "WEBSITE",
      },
      {
        name: "Laura Bennett",
        email: "laura.bennett@example.com",
        originalPhone: "07822 333444",
        normalizedPhone: normalizeUKPhone("07822 333444")!,
        area: "Ilford",
        postcodePreferences: "IG1,IG2",
        requirements: "Two bedroom flat, parking essential.",
        minBudgetPence: 1200 * POUND,
        maxBudgetPence: 1600 * POUND,
        moveInDate: dateOnly(20),
        propertyTypePreference: "FLAT",
        bedrooms: 2,
        status: "ACTIVE",
        ownerAgentId: agentSarah.id,
        createdBy: agentSarah.id,
        source: "REFERRAL",
      },
    ])
    .returning();

  const [michael, laura] = tenantRows;

  /* ------------------------------------------------ a completed sale */

  console.log("Closing a deal and recording commission...");

  const [closedDeal] = await db
    .insert(schema.deals)
    .values({
      propertyId: flatProperty.id,
      roomId: null,
      tenantId: laura.id,
      landlordId: priyaPatel.id,
      stage: "CLOSED_SUCCESSFUL",
      propertyAgentId: agentSarah.id,
      tenantAgentId: null,
      originatingFronterId: aisha.id,
      startedAt: daysFromNow(-12),
      closedAt: daysFromNow(-2),
      createdBy: agentSarah.id,
    })
    .returning();

  await db.insert(schema.dealStageHistory).values([
    {
      dealId: closedDeal.id,
      fromStage: "AVAILABLE",
      toStage: "VIEWING",
      reason: "Viewing scheduled",
      changedById: agentSarah.id,
      changedAt: daysFromNow(-12),
    },
    {
      dealId: closedDeal.id,
      fromStage: "VIEWING",
      toStage: "VERIFICATION",
      reason: "Viewing successful",
      changedById: agentSarah.id,
      changedAt: daysFromNow(-8),
    },
    {
      dealId: closedDeal.id,
      fromStage: "VERIFICATION",
      toStage: "CLOSING",
      reason: "Verification successful",
      changedById: agentSarah.id,
      changedAt: daysFromNow(-5),
    },
    {
      dealId: closedDeal.id,
      fromStage: "CLOSING",
      toStage: "CLOSED_SUCCESSFUL",
      reason: "Deal closed",
      changedById: agentSarah.id,
      changedAt: daysFromNow(-2),
    },
  ]);

  await db.insert(schema.viewings).values({
    dealId: closedDeal.id,
    propertyId: flatProperty.id,
    tenantId: laura.id,
    agentId: agentSarah.id,
    attemptNumber: 1,
    scheduledFor: daysFromNow(-10, 17),
    status: "COMPLETED_SUCCESSFUL",
    completedAt: daysFromNow(-10, 18),
    completedById: agentSarah.id,
    createdBy: agentSarah.id,
    notes: "Liked the balcony and the parking space.",
  });

  await db.insert(schema.verifications).values({
    dealId: closedDeal.id,
    attemptNumber: 1,
    status: "SUCCESSFUL",
    startedAt: daysFromNow(-8),
    startedById: agentSarah.id,
    completedAt: daysFromNow(-5),
    completedById: agentSarah.id,
  });

  await db.insert(schema.closings).values({
    dealId: closedDeal.id,
    attemptNumber: 1,
    status: "CLOSED",
    startedAt: daysFromNow(-5),
    startedById: agentSarah.id,
    completedAt: daysFromNow(-2),
    completedById: agentSarah.id,
  });

  const pkrRateX100 = 36_900;
  const breakdown = calculateCommission({
    grossCommissionPence: 1500 * POUND,
    fronterRule: { type: "PERCENTAGE", value: 1000 },
    agentRule: { type: "PERCENTAGE", value: 5000 },
    crossSell: null,
    pkrRateX100,
  });

  const saleReferenceRow = await readRows<{ value: string }>(
    raw`select nextval('sale_reference_seq')::text as value`,
  );
  const saleReference = formatReference(REFERENCE_PREFIX.sale, Number(saleReferenceRow[0].value));

  const [sale] = await db
    .insert(schema.sales)
    .values({
      reference: saleReference,
      dealId: closedDeal.id,
      propertyId: flatProperty.id,
      landlordId: priyaPatel.id,
      tenantId: laura.id,
      propertyAgentId: agentSarah.id,
      originatingFronterId: aisha.id,
      grossCommissionPence: breakdown.grossCommissionPence,
      fronterCommissionPence: breakdown.fronter.amountPence,
      agentPoolPence: breakdown.agentPool.amountPence,
      propertyAgentCommissionPence: breakdown.propertyAgent.amountPence,
      tenantAgentCommissionPence: 0,
      companyNetPence: breakdown.companyRetainedPence,
      pkrRateAtClose: pkrRateX100,
      calculationSnapshot: breakdown as never,
      closingDate: daysFromNow(-2),
      createdBy: agentSarah.id,
    })
    .returning();

  await db.insert(schema.commissions).values([
    {
      saleId: sale.id,
      beneficiary: "FRONTER",
      beneficiaryUserId: aisha.id,
      amountPence: breakdown.fronter.amountPence,
      basisPence: breakdown.fronter.basisPence,
      ruleType: "PERCENTAGE",
      ruleValue: 1000,
      pkrRateAtClose: pkrRateX100,
      pkrAmount: breakdown.fronter.pkrAmount,
    },
    {
      saleId: sale.id,
      beneficiary: "PROPERTY_AGENT",
      beneficiaryUserId: agentSarah.id,
      amountPence: breakdown.propertyAgent.amountPence,
      basisPence: breakdown.propertyAgent.basisPence,
      ruleType: "PERCENTAGE",
      ruleValue: 5000,
      pkrRateAtClose: pkrRateX100,
      pkrAmount: breakdown.propertyAgent.pkrAmount,
    },
    {
      saleId: sale.id,
      beneficiary: "COMPANY",
      beneficiaryUserId: null,
      amountPence: breakdown.companyRetainedPence,
      basisPence: breakdown.afterFronterPence,
      pkrRateAtClose: pkrRateX100,
      pkrAmount: breakdown.companyRetainedPkr,
    },
  ]);

  // The flat is now let, so it leaves the public site.
  await db
    .update(schema.properties)
    .set({ listingStatus: "LET_AGREED", dealStage: "CLOSED_SUCCESSFUL", availableRooms: 0 })
    .where(raw`${schema.properties.id} = ${flatProperty.id}`);

  await db
    .update(schema.tenants)
    .set({ status: "PLACED" })
    .where(raw`${schema.tenants.id} = ${laura.id}`);

  /* ------------------------------------------------------ cross sell */

  console.log("Creating a cross-sell collaboration...");

  const [collaboration] = await db
    .insert(schema.collaborations)
    .values({
      propertyId: sharedProperty.id,
      roomId: rooms[0].id,
      tenantId: michael.id,
      tenantAgentId: agentJames.id,
      propertyAgentId: agentSarah.id,
      status: "ACCEPTED",
      message: "Michael is looking for a room in M14 from the start of next month.",
      propertyAgentSplitBp: 6000,
      tenantAgentSplitBp: 4000,
      requestedAt: daysFromNow(-1),
      respondedAt: daysFromNow(0, 9),
      createdBy: agentJames.id,
    })
    .returning();

  await db.insert(schema.collaborationParticipants).values([
    { collaborationId: collaboration.id, userId: agentJames.id, role: "TENANT_AGENT" },
    { collaborationId: collaboration.id, userId: agentSarah.id, role: "PROPERTY_AGENT" },
  ]);

  /* An open deal on that collaboration, sitting in viewing. */
  const [openDeal] = await db
    .insert(schema.deals)
    .values({
      propertyId: sharedProperty.id,
      roomId: rooms[0].id,
      tenantId: michael.id,
      landlordId: johnSmith.id,
      stage: "VIEWING",
      propertyAgentId: agentSarah.id,
      tenantAgentId: agentJames.id,
      originatingFronterId: ahmed.id,
      collaborationId: collaboration.id,
      createdBy: agentJames.id,
    })
    .returning();

  await db.insert(schema.dealStageHistory).values({
    dealId: openDeal.id,
    fromStage: "AVAILABLE",
    toStage: "VIEWING",
    reason: "Cross-sell viewing scheduled",
    changedById: agentJames.id,
  });

  await db.insert(schema.viewings).values({
    dealId: openDeal.id,
    propertyId: sharedProperty.id,
    roomId: rooms[0].id,
    tenantId: michael.id,
    agentId: agentSarah.id,
    attemptNumber: 1,
    scheduledFor: daysFromNow(2, 18),
    status: "SCHEDULED",
    createdBy: agentJames.id,
  });

  await db
    .update(schema.propertyRooms)
    .set({ status: "VIEWING" })
    .where(raw`${schema.propertyRooms.id} = ${rooms[0].id}`);

  await db
    .update(schema.collaborations)
    .set({ dealId: openDeal.id, status: "VIEWING" })
    .where(raw`${schema.collaborations.id} = ${collaboration.id}`);

  await db
    .update(schema.tenants)
    .set({ status: "VIEWING" })
    .where(raw`${schema.tenants.id} = ${michael.id}`);

  /* ---------------------------------------------------- website chat */

  console.log("Creating a website enquiry...");

  const [conversation] = await db
    .insert(schema.customerConversations)
    .values({
      visitorToken: "seed-visitor-token-0001",
      visitorName: "Michael Chen",
      visitorEmail: "michael.chen@example.com",
      visitorPhone: "07822 111222",
      propertyId: sharedProperty.id,
      assignedAgentId: agentSarah.id,
      status: "OPEN",
      subject: "Room 1 availability",
      lastMessageAt: hoursAgo(2),
    })
    .returning();

  await db.insert(schema.customerMessages).values([
    {
      conversationId: conversation.id,
      sender: "VISITOR",
      body: "Hi, is Room 1 still available from the start of next month?",
      createdAt: hoursAgo(3),
    },
    {
      conversationId: conversation.id,
      sender: "STAFF",
      senderUserId: agentSarah.id,
      body: "Hello Michael, it is. Would you like to arrange a viewing this week?",
      createdAt: hoursAgo(2),
    },
  ]);

  /* ------------------------------------------------------ activities */

  await db.insert(schema.activities).values([
    {
      type: "LANDLORD_CREATED",
      entityType: "Landlord",
      entityId: johnSmith.id,
      actorId: ahmed.id,
      summary: "Ahmed Raza added landlord John Smith",
      createdAt: daysFromNow(-6, 11),
    },
    {
      type: "PROPERTY_CREATED",
      entityType: "Property",
      entityId: sharedProperty.id,
      actorId: ahmed.id,
      summary: "Ahmed Raza added a shared property in Manchester",
      createdAt: daysFromNow(-6, 12),
    },
    {
      type: "PROPERTY_PUBLISHED",
      entityType: "Property",
      entityId: sharedProperty.id,
      actorId: agentSarah.id,
      summary: "Sarah Khan published the listing to the website",
      createdAt: daysFromNow(-5, 10),
    },
    {
      type: "SALE_CREATED",
      entityType: "Property",
      entityId: flatProperty.id,
      relatedEntityType: "Sale",
      relatedEntityId: sale.id,
      actorId: agentSarah.id,
      summary: `Deal closed successfully (${saleReference})`,
      createdAt: daysFromNow(-2),
    },
  ]);

  console.log("");
  console.log("Seed complete.");
  console.log("--------------------------------------------------");
  console.log(`Super admin   ${ADMIN_EMAIL}`);
  console.log("Agents        sarah.khan@lettingpartners.co.uk, james.smith@lettingpartners.co.uk");
  console.log("Fronters      ahmed.raza@, aisha.begum@, daniel.okafor@, maria.silva@");
  console.log("");
  console.log("Sign in with any of these addresses. Without RESEND_API_KEY the");
  console.log("one-time code is printed to the dev server console.");
  console.log("--------------------------------------------------");

  await connection.close();
}

main().catch(async (error) => {
  console.error("Seed failed:");
  console.error(error);
  await connection.close().catch(() => {});
  process.exit(1);
});
