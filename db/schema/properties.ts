import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import {
  commissionTypeEnum,
  contactSourceEnum,
  dealStageEnum,
  listingStatusEnum,
  livingRoomEnum,
  propertyCategoryEnum,
  propertyTypeEnum,
  rentFrequencyEnum,
  roomStatusEnum,
} from "./enums";
import { landlords } from "./landlords";
import { users } from "./users";

/**
 * All money is stored as whole pence in integer columns. Percentages are stored
 * as basis points (1000 = 10.00%). Never store money as a float.
 */
export const properties = pgTable(
  "properties",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reference: varchar("reference", { length: 24 }).notNull(),

    landlordId: uuid("landlord_id")
      .notNull()
      .references(() => landlords.id),

    propertyType: propertyTypeEnum("property_type").notNull(),
    category: propertyCategoryEnum("category"),

    addressLine1: varchar("address_line1", { length: 200 }).notNull(),
    addressLine2: varchar("address_line2", { length: 200 }),
    town: varchar("town", { length: 120 }),
    county: varchar("county", { length: 120 }),
    postcode: varchar("postcode", { length: 10 }).notNull(),
    /** Outward code (M14) - drives area search and the public partial address. */
    outcode: varchar("outcode", { length: 5 }).notNull(),
    formattedAddress: text("formatted_address").notNull(),
    area: varchar("area", { length: 120 }),

    /* ------------------------------------------------------------ features */
    furnished: boolean("furnished"),
    livingLandlord: boolean("living_landlord"),
    garden: boolean("garden"),
    parking: boolean("parking"),
    billsIncluded: boolean("bills_included"),
    balcony: boolean("balcony"),
    disabledAccess: boolean("disabled_access"),
    wifi: boolean("wifi"),
    couplesAllowed: boolean("couples_allowed"),
    petsAllowed: boolean("pets_allowed"),
    dssAllowed: boolean("dss_allowed"),
    childrenAllowed: boolean("children_allowed"),
    livingRoom: livingRoomEnum("living_room"),

    /* -------------------------------------------------- full property only */
    numberOfRooms: integer("number_of_rooms"),
    availableRooms: integer("available_rooms"),
    bathrooms: integer("bathrooms"),
    availabilityDate: date("availability_date"),
    rentPerMonthPence: integer("rent_per_month_pence"),
    rentPerWeekPence: integer("rent_per_week_pence"),
    depositPence: integer("deposit_pence"),

    /** Commission the landlord agreed to pay the company for this property. */
    commissionType: commissionTypeEnum("commission_type"),
    commissionValue: integer("commission_value"),
    commissionAmountPence: integer("commission_amount_pence"),

    /* ------------------------------------------------------ public listing */
    title: varchar("title", { length: 200 }),
    description: text("description"),
    slug: varchar("slug", { length: 220 }),
    metaTitle: varchar("meta_title", { length: 200 }),
    metaDescription: varchar("meta_description", { length: 320 }),

    listingStatus: listingStatusEnum("listing_status").notNull().default("DRAFT"),
    dealStage: dealStageEnum("deal_stage").notNull().default("AVAILABLE"),

    publishedAt: timestamp("published_at", { withTimezone: true }),
    publishedById: uuid("published_by_id").references(() => users.id),
    unpublishedAt: timestamp("unpublished_at", { withTimezone: true }),

    /* ---------------------------------------------------------- ownership */
    originatingFronterId: uuid("originating_fronter_id").references(() => users.id),
    assignedAgentId: uuid("assigned_agent_id").references(() => users.id),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    source: contactSourceEnum("source").notNull().default("CALL"),
    originatingCallId: uuid("originating_call_id"),

    /** Autosaved wizard state so an interrupted onboarding can be resumed. */
    draftState: jsonb("draft_state"),
    draftSavedAt: timestamp("draft_saved_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: uuid("deleted_by").references(() => users.id),
  },
  (t) => [
    uniqueIndex("properties_reference_unique").on(t.reference),
    uniqueIndex("properties_slug_unique")
      .on(t.slug)
      .where(sql`${t.slug} is not null`),
    index("properties_landlord_idx").on(t.landlordId),
    index("properties_postcode_idx").on(t.postcode),
    index("properties_outcode_idx").on(t.outcode),
    index("properties_agent_idx").on(t.assignedAgentId),
    index("properties_fronter_idx").on(t.originatingFronterId),
    index("properties_listing_status_idx").on(t.listingStatus),
    index("properties_deal_stage_idx").on(t.dealStage),
    index("properties_created_at_idx").on(t.createdAt),
    check(
      "properties_available_rooms_within_total",
      sql`${t.availableRooms} is null or ${t.numberOfRooms} is null or ${t.availableRooms} <= ${t.numberOfRooms}`,
    ),
    check(
      "properties_rent_positive",
      sql`${t.rentPerMonthPence} is null or ${t.rentPerMonthPence} > 0`,
    ),
  ],
);

/** Rooms only exist for SHARED properties; rent and availability live per room. */
export const propertyRooms = pgTable(
  "property_rooms",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    sortOrder: integer("sort_order").notNull().default(0),

    availabilityDate: date("availability_date"),
    /** The frequency the user actually entered; the other value is derived. */
    rentFrequency: rentFrequencyEnum("rent_frequency").notNull().default("MONTHLY"),
    rentPerMonthPence: integer("rent_per_month_pence").notNull(),
    rentPerWeekPence: integer("rent_per_week_pence").notNull(),
    depositPence: integer("deposit_pence"),

    commissionType: commissionTypeEnum("commission_type"),
    commissionValue: integer("commission_value"),
    commissionAmountPence: integer("commission_amount_pence"),

    status: roomStatusEnum("status").notNull().default("AVAILABLE"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    index("property_rooms_property_idx").on(t.propertyId),
    index("property_rooms_status_idx").on(t.status),
    check("property_rooms_rent_positive", sql`${t.rentPerMonthPence} > 0`),
  ],
);

/** Centralised, reusable media. Images attach to properties by reference. */
export const imageAssets = pgTable(
  "image_assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fileName: varchar("file_name", { length: 260 }).notNull(),
    url: text("url").notNull(),
    pathname: text("pathname").notNull(),
    contentType: varchar("content_type", { length: 100 }),
    sizeBytes: integer("size_bytes"),
    width: integer("width"),
    height: integer("height"),
    checksum: varchar("checksum", { length: 128 }),
    altText: text("alt_text"),
    uploadedById: uuid("uploaded_by_id")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: uuid("deleted_by").references(() => users.id),
  },
  (t) => [
    index("image_assets_uploaded_by_idx").on(t.uploadedById),
    index("image_assets_created_at_idx").on(t.createdAt),
    uniqueIndex("image_assets_checksum_unique")
      .on(t.checksum)
      .where(sql`${t.checksum} is not null and ${t.deletedAt} is null`),
  ],
);

export const propertyImages = pgTable(
  "property_images",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    assetId: uuid("asset_id")
      .notNull()
      .references(() => imageAssets.id, { onDelete: "cascade" }),
    roomId: uuid("room_id").references(() => propertyRooms.id, { onDelete: "set null" }),
    sortOrder: integer("sort_order").notNull().default(0),
    isCover: boolean("is_cover").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("property_images_unique").on(t.propertyId, t.assetId),
    index("property_images_property_idx").on(t.propertyId),
    uniqueIndex("property_images_single_cover")
      .on(t.propertyId)
      .where(sql`${t.isCover} = true`),
  ],
);

/** Every publish / unpublish with the exact payload exposed to the website. */
export const propertyPublications = pgTable(
  "property_publications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    action: varchar("action", { length: 20 }).notNull(),
    slug: varchar("slug", { length: 220 }),
    snapshot: jsonb("snapshot"),
    performedById: uuid("performed_by_id")
      .notNull()
      .references(() => users.id),
    performedAt: timestamp("performed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("property_publications_property_idx").on(t.propertyId)],
);

/** Field-level change trail feeding the property activity timeline. */
export const propertyHistory = pgTable(
  "property_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    roomId: uuid("room_id").references(() => propertyRooms.id, { onDelete: "cascade" }),
    field: varchar("field", { length: 80 }).notNull(),
    previousValue: text("previous_value"),
    newValue: text("new_value"),
    note: text("note"),
    changedById: uuid("changed_by_id")
      .notNull()
      .references(() => users.id),
    changedAt: timestamp("changed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("property_history_property_idx").on(t.propertyId)],
);

export const propertiesRelations = relations(properties, ({ one, many }) => ({
  landlord: one(landlords, { fields: [properties.landlordId], references: [landlords.id] }),
  originatingFronter: one(users, {
    fields: [properties.originatingFronterId],
    references: [users.id],
    relationName: "propertyFronter",
  }),
  assignedAgent: one(users, {
    fields: [properties.assignedAgentId],
    references: [users.id],
    relationName: "propertyAgent",
  }),
  rooms: many(propertyRooms),
  images: many(propertyImages),
  publications: many(propertyPublications),
  history: many(propertyHistory),
}));

export const propertyRoomsRelations = relations(propertyRooms, ({ one }) => ({
  property: one(properties, { fields: [propertyRooms.propertyId], references: [properties.id] }),
}));

export const propertyImagesRelations = relations(propertyImages, ({ one }) => ({
  property: one(properties, { fields: [propertyImages.propertyId], references: [properties.id] }),
  asset: one(imageAssets, { fields: [propertyImages.assetId], references: [imageAssets.id] }),
}));

export const imageAssetsRelations = relations(imageAssets, ({ one, many }) => ({
  uploadedBy: one(users, { fields: [imageAssets.uploadedById], references: [users.id] }),
  usages: many(propertyImages),
}));

export type Property = typeof properties.$inferSelect;
export type NewProperty = typeof properties.$inferInsert;
export type PropertyRoom = typeof propertyRooms.$inferSelect;
export type ImageAsset = typeof imageAssets.$inferSelect;
export type PropertyImage = typeof propertyImages.$inferSelect;
