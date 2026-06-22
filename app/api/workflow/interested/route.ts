import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/server/auth/requireUser";
import { createInterestedPropertyIntake } from "@/server/portal/workflows";
import { normalizePostcode } from "@/server/portal/normalize";
import { Prisma } from "@prisma/client";

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request body." }, { status: 400 });

  const landlord = body.landlord ?? null;
  const landlordId = body.landlordId ?? null;
  const property = body.property ?? {};

  if (!landlordId && !landlord) {
    return NextResponse.json({ error: "Landlord details are required." }, { status: 400 });
  }
  if (!property.postcode) {
    return NextResponse.json({ error: "Postcode is required." }, { status: 400 });
  }

  if (property.status === "AVAILABLE") {
    const missing: string[] = [];
    if (!property.description?.trim()) missing.push("description");
    if (!property.addressLine1?.trim()) missing.push("address");
    if (!property.city?.trim()) missing.push("city");
    if (!property.availabilityDate) missing.push("availability date");
    const photos = Array.isArray(property.photos) ? property.photos : [];
    if (photos.length === 0) missing.push("at least one photo");
    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Cannot publish property. Missing: ${missing.join(", ")}.` },
        { status: 422 },
      );
    }
  }

  try {
    const rooms = Array.isArray(property.rooms) ? property.rooms : [];
    const photos = Array.isArray(property.photos) ? property.photos : [];

    const result = await createInterestedPropertyIntake({
      agentId: auth.user.id,
      landlordId,
      landlord: landlord
        ? {
            firstName: String(landlord.firstName ?? "").trim(),
            lastName: String(landlord.lastName ?? "").trim(),
            phoneNo: String(landlord.phone ?? "").trim(),
            email: landlord.email ? String(landlord.email).trim() : null,
          }
        : null,
      property: {
        propertyRef: property.propertyRef ?? null,
        description: property.description ?? null,
        addressLine1: property.addressLine1 ?? null,
        addressLine2: property.addressLine2 ?? null,
        city: property.city ?? null,
        postcode: normalizePostcode(String(property.postcode)),
        propertyCategory: property.propType === "SHARED" ? "SHARED" : "PRIVATE",
        buildingCategory: property.propType === "PRIVATE" ? (property.buildingCategory ?? null) : null,
        propertyType: property.buildingCategory ?? property.propertyType ?? null,
        beds: property.noOfRooms != null ? Number(property.noOfRooms) : null,
        rentPerMonth: property.rentPerMonth ?? null,
        rentPerWeek: property.rentPerWeek ?? null,
        depositAmount: property.depositAmount ?? null,
        isFurnished: property.furnished ?? null,
        petsAllowed: property.petsAllowed ?? null,
        dssAllowed: property.dssAllowed ?? null,
        childrenAllowed: property.childrenAllowed ?? null,
        availabilityDate: property.availabilityDate ?? null,
        livingLandlord: property.livingLandlord ?? null,
        publishedToWebsite: property.status === "AVAILABLE",
        rooms,
        photos,
      },
    });

    // Store V2-specific fields that aren't covered by createInterestedPropertyIntake
    const v2Fields: Record<string, unknown> = {};
    const boolFields = ["garden", "parking", "billsIncluded", "balconyRoofTerrace", "disabledAccess",
      "broadbandIncluded", "couplesAllowed"];
    for (const f of boolFields) {
      if (property[f] !== undefined) v2Fields[f] = property[f];
    }
    if (property.livingRoom !== undefined) v2Fields["livingRoom"] = property.livingRoom;
    // buildingCategory → propertyCategory (PropertyCategory enum: HOUSE | FLAT | STUDIO_FLAT)
    if (property.buildingCategory) v2Fields["propertyCategory"] = property.buildingCategory;
    if (property.propType) v2Fields["propType"] = property.propType;
    if (property.noOfRooms != null) v2Fields["totalRooms"] = Number(property.noOfRooms);
    if (property.availableRooms != null) v2Fields["availableRooms"] = Number(property.availableRooms);
    if (property.expectedCommissionAmt != null) v2Fields["expectedCommissionAmt"] = property.expectedCommissionAmt;
    if (property.status) v2Fields["status"] = property.status;

    if (Object.keys(v2Fields).length > 0) {
      const { db } = await import("@/server/db");
      await (db as any).property.update({
        where: { id: result.property.id },
        data: v2Fields,
      });
    }

    return NextResponse.json({ ok: true, landlord: result.landlord, property: result.property });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2002") {
        return NextResponse.json({ error: "A property with this reference already exists." }, { status: 409 });
      }
      if (err.code === "P2025") {
        return NextResponse.json({ error: "Landlord not found." }, { status: 404 });
      }
      return NextResponse.json({ error: "Failed to save property. Please try again." }, { status: 500 });
    }
    const message = err instanceof Error ? err.message : "Failed to create property.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
