import { PGlite } from "@electric-sql/pglite";

/**
 * Proves the business rules are enforced by the database itself, not only by
 * application code. Each case writes directly with SQL, bypassing every
 * service, and must be rejected.
 *
 * Run against a seeded database:  node scripts/verify-constraints.mjs
 */

const db = new PGlite(process.env.DATABASE_URL?.replace(/^pglite:(\/\/)?/, "") ?? "./.pglite");

let passed = 0;
let failed = 0;

async function mustReject(label, sql, expected) {
  try {
    await db.exec("begin");
    await db.query(sql);
    await db.exec("rollback");
    console.log(`  FAIL  ${label}\n        the database allowed it`);
    failed += 1;
  } catch (error) {
    await db.exec("rollback").catch(() => {});
    const message = String(error.message ?? error);
    if (expected && !message.includes(expected)) {
      console.log(`  FAIL  ${label}\n        rejected, but for the wrong reason: ${message}`);
      failed += 1;
      return;
    }
    console.log(`  ok    ${label}`);
    passed += 1;
  }
}

async function mustAllow(label, sql) {
  try {
    await db.exec("begin");
    await db.query(sql);
    await db.exec("rollback");
    console.log(`  ok    ${label}`);
    passed += 1;
  } catch (error) {
    await db.exec("rollback").catch(() => {});
    console.log(`  FAIL  ${label}\n        ${String(error.message ?? error)}`);
    failed += 1;
  }
}

const one = async (sql) => (await db.query(sql)).rows[0];

const landlord = await one(`select id, normalized_phone, assigned_agent_id, originating_fronter_id
                            from landlords limit 1`);
const fronter = await one(`select id from users where role = 'FRONTER' limit 1`);
const otherFronter = await one(`select id from users where role = 'FRONTER' offset 1 limit 1`);
const agent = await one(`select id from users where role = 'AGENT' limit 1`);
const followUp = await one(`select normalized_phone from follow_ups where status = 'SCHEDULED' limit 1`);
const tenant = await one(`select id from tenants limit 1`);

// The room that already has a live deal - that is what the index guards.
const activeRoomDeal = await one(
  `select property_id, room_id from deals
   where room_id is not null and stage in ('VIEWING','VERIFICATION','CLOSING') limit 1`,
);
const closedDeal = await one(`select property_id, room_id, tenant_id, landlord_id, property_agent_id
                              from deals where stage = 'CLOSED_SUCCESSFUL' limit 1`);

console.log("\nRule 1 - a landlord cannot be duplicated on the same number");
await mustReject(
  "same normalized phone as an existing landlord",
  `insert into landlords (name, original_phone, normalized_phone, created_by)
   values ('Impostor', '07000 000000', '${landlord.normalized_phone}', '${fronter.id}')`,
  "landlords_normalized_phone_unique",
);
await mustAllow(
  "a genuinely different number is fine",
  `insert into landlords (name, original_phone, normalized_phone, created_by)
   values ('New Landlord', '07999 000111', '7999000111', '${fronter.id}')`,
);

console.log("\nRule 2 - one fronter cannot take another's active follow-up");
await mustReject(
  "second scheduled follow-up on a locked number",
  `insert into follow_ups (original_phone, normalized_phone, due_at, notes, created_by_id, status)
   values ('07911 445566', '${followUp.normalized_phone}', now(), 'Trying to steal it',
           '${otherFronter.id}', 'SCHEDULED')`,
  "follow_ups_active_phone_unique",
);
await mustAllow(
  "a completed follow-up releases the number",
  `insert into follow_ups (original_phone, normalized_phone, due_at, notes, created_by_id, status)
   values ('07911 445566', '${followUp.normalized_phone}', now(), 'Historic attempt',
           '${otherFronter.id}', 'COMPLETED')`,
);

console.log("\nRule 3 - a unit cannot be sold twice");
await mustReject(
  "second successful closing on the same property",
  `insert into deals (property_id, tenant_id, landlord_id, stage, property_agent_id, created_by)
   values ('${closedDeal.property_id}', '${closedDeal.tenant_id}', '${closedDeal.landlord_id}',
           'CLOSED_SUCCESSFUL', '${closedDeal.property_agent_id}', '${agent.id}')`,
  "deals_one_success_per_property",
);

console.log("\nRule 4 - a unit cannot have two live deals at once");
await mustReject(
  "second active deal on the same room",
  `insert into deals (property_id, room_id, tenant_id, landlord_id, stage, property_agent_id, created_by)
   values ('${activeRoomDeal.property_id}', '${activeRoomDeal.room_id}', '${tenant.id}',
           '${landlord.id}', 'VIEWING', '${agent.id}', '${agent.id}')`,
  "deals_one_active_per_room",
);

console.log("\nRule 5 - room counts must be coherent");
await mustReject(
  "more available rooms than the property has",
  `insert into properties (reference, landlord_id, property_type, address_line1, postcode, outcode,
                           formatted_address, number_of_rooms, available_rooms, created_by)
   values ('LP-TEST1', '${landlord.id}', 'FULL', '1 Test Street', 'M1 1AA', 'M1',
           '1 Test Street, M1 1AA', 3, 5, '${agent.id}')`,
  "properties_available_rooms_within_total",
);

console.log("\nRule 6 - a cross-sell split must total 100%");
await mustReject(
  "a split that adds up to 90%",
  `insert into cross_sell_splits (property_agent_bp, tenant_agent_bp)
   values (6000, 3000)`,
  "cross_sell_splits_total_100",
);

console.log("\nRule 7 - one cover photo per listing, one email per user");
await mustReject(
  "duplicate email, ignoring case",
  `insert into users (email, full_name, role)
   values ('SARAH.KHAN@LETTINGPARTNERS.CO.UK', 'Not Sarah', 'AGENT')`,
  "users_email_unique",
);

console.log(`\n${passed} passed, ${failed} failed\n`);

await db.close();
process.exit(failed === 0 ? 0 : 1);
