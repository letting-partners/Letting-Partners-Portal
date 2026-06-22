import "server-only";
import { getAreaBySlug } from "@/lib/areas";
import { db } from "@/server/db";

export type PublicWebsiteProperty = {
  id: string;
  title: string;
  description?: string;
  address?: string;
  area?: string;
  postcode?: string;
  price?: number | string;
  priceLabel?: string;
  bedrooms?: number;
  bathrooms?: number;
  type?: string;
  available?: boolean;
  image?: string;
  deposit?: number;
  furnished?: boolean | null;
  availableFrom?: string | null;
  features: string[];
  rooms: Array<{
    id: string;
    name: string;
    status: string;
    rent?: number | null;
  }>;
};

type PublicPropertyRow = Awaited<ReturnType<typeof queryPublicProperties>>[number];

function toNumber(value: unknown): number | undefined {
  if (value == null) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function formatAddress(property: {
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  county: string | null;
  postcode: string | null;
}) {
  return [property.addressLine1, property.addressLine2, property.city, property.county, property.postcode]
    .filter(Boolean)
    .join(", ");
}

function formatPropertyType(property: PublicPropertyRow) {
  return property.propertyType || property.propertyCategory || property.propType || undefined;
}

function buildFeatures(property: PublicPropertyRow) {
  const features = [
    property.isFurnished ? "Furnished" : null,
    property.billsIncluded ? "Bills included" : null,
    property.garden ? "Garden" : null,
    property.parking ? "Parking" : null,
    property.petsAllowed ? "Pets considered" : null,
    property.childrenAllowed ? "Children considered" : null,
    property.couplesAllowed ? "Couples considered" : null,
    property.disabledAccess ? "Disabled access" : null,
    property.broadbandIncluded ? "Broadband included" : null,
  ];

  return features.filter((feature): feature is string => Boolean(feature));
}

function mapPublicProperty(property: PublicPropertyRow): PublicWebsiteProperty {
  const rentPerMonth = toNumber(property.rentPerMonth);
  const firstImage = property.mediaLinks[0]?.mediaAsset.dataUrl;

  return {
    id: property.id,
    title: property.title || property.propertyRef || "Letting Partners property",
    description: property.description || undefined,
    address: formatAddress(property) || undefined,
    area: property.city || undefined,
    postcode: property.postcode || undefined,
    price: rentPerMonth ?? "POA",
    priceLabel: rentPerMonth ? "pcm" : undefined,
    bedrooms: property.beds ?? property.totalRooms ?? undefined,
    bathrooms: property.baths ?? undefined,
    type: formatPropertyType(property),
    available: property.status === "AVAILABLE",
    image: firstImage || undefined,
    deposit: toNumber(property.depositAmount),
    furnished: property.isFurnished,
    availableFrom: property.availabilityDate?.toISOString() ?? null,
    features: buildFeatures(property),
    rooms: property.rooms.map((room) => ({
      id: room.id,
      name: room.roomName,
      status: room.status,
      rent: toNumber(room.rentPerMonth ?? room.rentPerWeek) ?? null,
    })),
  };
}

function areaSearchValue(area?: string) {
  if (!area) return "";
  const normalized = area.trim();
  if (!normalized) return "";
  return getAreaBySlug(normalized.toLowerCase())?.title ?? normalized;
}

async function queryPublicProperties(options: { limit?: number; area?: string; id?: string }) {
  const area = areaSearchValue(options.area);

  return db.property.findMany({
    where: {
      publishedToWebsite: true,
      status: { not: "CLOSED" },
      ...(options.id ? { id: options.id } : {}),
      ...(area
        ? {
            OR: [
              { city: { contains: area, mode: "insensitive" } },
              { county: { contains: area, mode: "insensitive" } },
              { postcode: { contains: area, mode: "insensitive" } },
              { addressLine1: { contains: area, mode: "insensitive" } },
              { addressLine2: { contains: area, mode: "insensitive" } },
              { title: { contains: area, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    take: options.id ? 1 : options.limit ?? 50,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      propertyRef: true,
      title: true,
      description: true,
      addressLine1: true,
      addressLine2: true,
      city: true,
      county: true,
      postcode: true,
      propertyType: true,
      propertyCategory: true,
      propType: true,
      beds: true,
      baths: true,
      status: true,
      rentPerMonth: true,
      rentPerWeek: true,
      depositAmount: true,
      isFurnished: true,
      petsAllowed: true,
      childrenAllowed: true,
      couplesAllowed: true,
      availabilityDate: true,
      garden: true,
      parking: true,
      billsIncluded: true,
      disabledAccess: true,
      broadbandIncluded: true,
      totalRooms: true,
      mediaLinks: {
        orderBy: { sortOrder: "asc" },
        select: {
          mediaAsset: {
            select: { dataUrl: true },
          },
        },
      },
      rooms: {
        where: { status: { not: "CLOSED" } },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          roomName: true,
          status: true,
          rentPerMonth: true,
          rentPerWeek: true,
        },
      },
    },
  });
}

export async function getPublicWebsiteProperties(options: { limit?: number; area?: string } = {}) {
  const properties = await queryPublicProperties(options);
  return properties.map(mapPublicProperty);
}

export async function getPublicWebsiteProperty(id: string) {
  const [property] = await queryPublicProperties({ id });
  return property ? mapPublicProperty(property) : null;
}
