import "server-only";
import { and, asc, desc, eq, gte, ilike, inArray, isNull, lte, or, sql as raw } from "drizzle-orm";
import { db } from "@/db";
import {
  imageAssets,
  properties,
  propertyImages,
  propertyRooms,
  users,
} from "@/db/schema";
import { monthlyToWeeklyPence, penceToPounds } from "@/lib/money";
import { getOutcode } from "@/lib/postcode";

/**
 * The public projection of a property.
 *
 * This is the only shape the public website ever receives. It is built by an
 * explicit whitelist rather than by removing fields from an internal record,
 * so a column added to `properties` later cannot leak by accident.
 *
 * Never included: landlord identity or contact details, commission of any
 * kind, the originating fronter, internal notes, the deal pipeline, or the
 * full street address.
 */

export type WebsiteProperty = {
  id: string;
  title: string;
  address: string;
  area: string | null;
  postcode: string;
  price: number | null;
  priceLabel: "pcm" | "pw";
  bedrooms: number | null;
  bathrooms: number | null;
  type: string;
  available: boolean;
  image: string | null;
};

export type WebsiteRoom = {
  id: string;
  name: string;
  status: string;
  rent: number | null;
  rentPerWeek: number | null;
  availableFrom: string | null;
};

export type WebsiteAgent = {
  name: string;
  jobTitle: string | null;
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;
  bio: string | null;
};

export type WebsitePropertyDetail = WebsiteProperty & {
  description: string | null;
  deposit: number | null;
  furnished: boolean | null;
  availableFrom: string | null;
  features: string[];
  images: { url: string; alt: string | null }[];
  rooms: WebsiteRoom[];
  agent: WebsiteAgent | null;
  metaTitle: string | null;
  metaDescription: string | null;
  publishedAt: string | null;
};

const CATEGORY_LABELS: Record<string, string> = {
  HOUSE: "House",
  FLAT: "Flat",
  STUDIO_FLAT: "Studio flat",
};

/** Feature flags rendered as plain English on the listing. */
const FEATURE_LABELS: { key: keyof typeof properties.$inferSelect; label: string }[] = [
  { key: "furnished", label: "Furnished" },
  { key: "garden", label: "Garden" },
  { key: "parking", label: "Parking" },
  { key: "billsIncluded", label: "Bills included" },
  { key: "balcony", label: "Balcony or roof terrace" },
  { key: "disabledAccess", label: "Disabled access" },
  { key: "wifi", label: "Wi-Fi" },
  { key: "couplesAllowed", label: "Couples welcome" },
  { key: "petsAllowed", label: "Pets considered" },
  { key: "dssAllowed", label: "DSS considered" },
  { key: "childrenAllowed", label: "Children welcome" },
  { key: "livingLandlord", label: "Live-in landlord" },
];

/**
 * Public address: area or town plus the outward code only. The house number,
 * street and inward code are internal.
 */
function publicAddress(row: {
  area: string | null;
  town: string | null;
  county: string | null;
  postcode: string;
}): string {
  const outcode = getOutcode(row.postcode) ?? row.postcode;
  const place = row.area ?? row.town ?? row.county;
  return place ? `${place}, ${outcode}` : outcode;
}

/**
 * How a room reads on the public site.
 *
 * A room part-way through the pipeline is not let - the deal can still fall
 * through - so it is shown as under offer. Saying "Let" would turn away an
 * enquiry the business may well still want.
 */
function publicRoomStatus(status: string): string {
  if (status === "AVAILABLE") return "Available";
  if (status === "LET") return "Let";
  return "Under offer";
}

function describeType(row: { propertyType: string; category: string | null }): string {
  if (row.propertyType === "SHARED") return "Shared house";
  return row.category ? (CATEGORY_LABELS[row.category] ?? "Property") : "Property";
}

function featuresOf(row: Record<string, unknown>): string[] {
  return FEATURE_LABELS.filter((feature) => row[feature.key] === true).map(
    (feature) => feature.label,
  );
}

export type ListOptions = {
  limit?: number;
  offset?: number;
  area?: string;
  outcode?: string;
  type?: "FULL" | "SHARED";
  minRentPence?: number;
  maxRentPence?: number;
  bedrooms?: number;
  search?: string;
};

/** Only PUBLISHED, non-deleted properties are ever visible to the website. */
function publishedFilter() {
  return and(eq(properties.listingStatus, "PUBLISHED"), isNull(properties.deletedAt));
}

export async function listWebsiteProperties(options: ListOptions = {}): Promise<WebsiteProperty[]> {
  const limit = Math.min(Math.max(options.limit ?? 24, 1), 100);
  const offset = Math.max(options.offset ?? 0, 0);

  const filters = [publishedFilter()];

  if (options.area) filters.push(ilike(properties.area, `%${options.area}%`));
  if (options.outcode) filters.push(eq(properties.outcode, options.outcode.toUpperCase()));
  if (options.type) filters.push(eq(properties.propertyType, options.type));
  if (options.bedrooms) filters.push(gte(properties.numberOfRooms, options.bedrooms));
  if (options.minRentPence) filters.push(gte(properties.rentPerMonthPence, options.minRentPence));
  if (options.maxRentPence) filters.push(lte(properties.rentPerMonthPence, options.maxRentPence));

  if (options.search) {
    const term = `%${options.search}%`;
    const searchFilter = or(
      ilike(properties.title, term),
      ilike(properties.area, term),
      ilike(properties.town, term),
      ilike(properties.postcode, term),
    );
    if (searchFilter) filters.push(searchFilter);
  }

  const rows = await db
    .select({
      id: properties.id,
      slug: properties.slug,
      reference: properties.reference,
      title: properties.title,
      area: properties.area,
      town: properties.town,
      county: properties.county,
      postcode: properties.postcode,
      propertyType: properties.propertyType,
      category: properties.category,
      numberOfRooms: properties.numberOfRooms,
      availableRooms: properties.availableRooms,
      bathrooms: properties.bathrooms,
      rentPerMonthPence: properties.rentPerMonthPence,
      dealStage: properties.dealStage,
      publishedAt: properties.publishedAt,
    })
    .from(properties)
    .where(and(...filters))
    .orderBy(desc(properties.publishedAt))
    .limit(limit)
    .offset(offset);

  if (rows.length === 0) return [];

  const propertyIds = rows.map((row) => row.id);
  const [coverImages, roomSummary] = await Promise.all([
    loadCoverImages(propertyIds),
    loadRoomSummary(propertyIds),
  ]);

  return rows.map((row) => {
    const rooms = roomSummary.get(row.id);
    // A shared property advertises its cheapest available room.
    const pricePence = row.propertyType === "SHARED" ? rooms?.fromRentPence ?? null : row.rentPerMonthPence;

    return {
      id: row.slug ?? row.id,
      title: row.title ?? `${describeType(row)} in ${publicAddress(row)}`,
      address: publicAddress(row),
      area: row.area,
      postcode: getOutcode(row.postcode) ?? row.postcode,
      price: penceToPounds(pricePence),
      priceLabel: "pcm" as const,
      bedrooms: row.propertyType === "SHARED" ? (rooms?.total ?? null) : row.numberOfRooms,
      bathrooms: row.bathrooms,
      type: describeType(row),
      available:
        row.propertyType === "SHARED"
          ? (rooms?.available ?? 0) > 0
          : row.dealStage !== "CLOSED_SUCCESSFUL",
      image: coverImages.get(row.id) ?? null,
    };
  });
}

/** Accepts either the public slug or the internal uuid. */
export async function getWebsiteProperty(
  identifier: string,
): Promise<WebsitePropertyDetail | null> {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);

  const rows = await db
    .select({
      property: properties,
      agentName: users.fullName,
      agentJobTitle: users.jobTitle,
      agentEmail: users.publicEmail,
      agentPhone: users.publicPhone,
      agentAvatar: users.avatarUrl,
      agentBio: users.publicBio,
    })
    .from(properties)
    .leftJoin(users, eq(users.id, properties.assignedAgentId))
    .where(
      and(
        publishedFilter(),
        isUuid ? eq(properties.id, identifier) : eq(properties.slug, identifier),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  const property = row.property;

  const [images, rooms] = await Promise.all([
    db
      .select({
        url: imageAssets.url,
        alt: imageAssets.altText,
        isCover: propertyImages.isCover,
        sortOrder: propertyImages.sortOrder,
      })
      .from(propertyImages)
      .innerJoin(imageAssets, eq(imageAssets.id, propertyImages.assetId))
      .where(and(eq(propertyImages.propertyId, property.id), isNull(imageAssets.deletedAt)))
      .orderBy(desc(propertyImages.isCover), asc(propertyImages.sortOrder)),

    db
      .select({
        id: propertyRooms.id,
        name: propertyRooms.name,
        status: propertyRooms.status,
        rentPerMonthPence: propertyRooms.rentPerMonthPence,
        rentPerWeekPence: propertyRooms.rentPerWeekPence,
        availabilityDate: propertyRooms.availabilityDate,
        sortOrder: propertyRooms.sortOrder,
      })
      .from(propertyRooms)
      .where(and(eq(propertyRooms.propertyId, property.id), isNull(propertyRooms.deletedAt)))
      .orderBy(asc(propertyRooms.sortOrder)),
  ]);

  // Only rooms a member of the public could actually enquire about.
  const publicRooms = rooms.filter((room) => room.status !== "UNAVAILABLE");
  const availableRooms = publicRooms.filter((room) => room.status === "AVAILABLE");

  const pricePence =
    property.propertyType === "SHARED"
      ? availableRooms.reduce<number | null>(
          (lowest, room) =>
            lowest === null ? room.rentPerMonthPence : Math.min(lowest, room.rentPerMonthPence),
          null,
        )
      : property.rentPerMonthPence;

  return {
    id: property.slug ?? property.id,
    title: property.title ?? `${describeType(property)} in ${publicAddress(property)}`,
    address: publicAddress(property),
    area: property.area,
    postcode: getOutcode(property.postcode) ?? property.postcode,
    price: penceToPounds(pricePence),
    priceLabel: "pcm",
    bedrooms:
      property.propertyType === "SHARED" ? publicRooms.length : property.numberOfRooms,
    bathrooms: property.bathrooms,
    type: describeType(property),
    available:
      property.propertyType === "SHARED"
        ? availableRooms.length > 0
        : property.dealStage !== "CLOSED_SUCCESSFUL",
    image: images[0]?.url ?? null,

    description: property.description,
    deposit: penceToPounds(property.depositPence),
    furnished: property.furnished,
    availableFrom: property.availabilityDate,
    features: featuresOf(property as unknown as Record<string, unknown>),
    images: images.map((image) => ({ url: image.url, alt: image.alt })),
    rooms: publicRooms.map((room) => ({
      id: room.id,
      name: room.name,
      status: publicRoomStatus(room.status),
      rent: penceToPounds(room.rentPerMonthPence),
      rentPerWeek: penceToPounds(room.rentPerWeekPence ?? monthlyToWeeklyPence(room.rentPerMonthPence)),
      availableFrom: room.availabilityDate,
    })),
    agent: row.agentName
      ? {
          name: row.agentName,
          jobTitle: row.agentJobTitle,
          email: row.agentEmail,
          phone: row.agentPhone,
          avatarUrl: row.agentAvatar,
          bio: row.agentBio,
        }
      : null,
    metaTitle: property.metaTitle,
    metaDescription: property.metaDescription,
    publishedAt: property.publishedAt?.toISOString() ?? null,
  };
}

/** Slugs of every live listing, for the public sitemap. */
export async function listWebsiteSlugs(): Promise<{ slug: string; updatedAt: string }[]> {
  const rows = await db
    .select({ slug: properties.slug, id: properties.id, updatedAt: properties.updatedAt })
    .from(properties)
    .where(publishedFilter())
    .orderBy(desc(properties.updatedAt));

  return rows.map((row) => ({
    slug: row.slug ?? row.id,
    updatedAt: row.updatedAt.toISOString(),
  }));
}

/* ------------------------------------------------------------- helpers */

async function loadCoverImages(propertyIds: string[]): Promise<Map<string, string>> {
  const rows = await db
    .select({
      propertyId: propertyImages.propertyId,
      url: imageAssets.url,
      isCover: propertyImages.isCover,
      sortOrder: propertyImages.sortOrder,
    })
    .from(propertyImages)
    .innerJoin(imageAssets, eq(imageAssets.id, propertyImages.assetId))
    .where(and(inArray(propertyImages.propertyId, propertyIds), isNull(imageAssets.deletedAt)))
    .orderBy(desc(propertyImages.isCover), asc(propertyImages.sortOrder));

  const map = new Map<string, string>();
  for (const row of rows) {
    if (!map.has(row.propertyId)) map.set(row.propertyId, row.url);
  }
  return map;
}

async function loadRoomSummary(
  propertyIds: string[],
): Promise<Map<string, { total: number; available: number; fromRentPence: number | null }>> {
  const rows = await db
    .select({
      propertyId: propertyRooms.propertyId,
      total: raw<number>`count(*)::int`,
      available: raw<number>`count(*) filter (where ${propertyRooms.status} = 'AVAILABLE')::int`,
      fromRentPence: raw<number | null>`min(${propertyRooms.rentPerMonthPence}) filter (where ${propertyRooms.status} = 'AVAILABLE')::int`,
    })
    .from(propertyRooms)
    .where(and(inArray(propertyRooms.propertyId, propertyIds), isNull(propertyRooms.deletedAt)))
    .groupBy(propertyRooms.propertyId);

  const map = new Map<string, { total: number; available: number; fromRentPence: number | null }>();
  for (const row of rows) {
    map.set(row.propertyId, {
      total: Number(row.total),
      available: Number(row.available),
      fromRentPence: row.fromRentPence === null ? null : Number(row.fromRentPence),
    });
  }
  return map;
}
