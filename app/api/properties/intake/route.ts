import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/server/auth/requireUser";
import {
  createInterestedPropertyIntake,
  type InterestedPropertyPhotoInput,
  type InterestedPropertyRoomInput,
} from "@/server/portal/workflows";

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (!auth.ok) {
    return auth.response;
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "INVALID_PAYLOAD" }, { status: 400 });
  }

  const propertySource = body.property ?? body;
  const rooms: InterestedPropertyRoomInput[] = Array.isArray(propertySource.rooms)
    ? propertySource.rooms
    : Array.isArray(body.rooms)
      ? body.rooms
      : [];
  const photos: InterestedPropertyPhotoInput[] = Array.isArray(propertySource.photos)
    ? propertySource.photos
    : Array.isArray(body.photos)
      ? body.photos
      : [];

  const landlordId = body.landlordId ?? body.existingLandlordId ?? propertySource.landlordId ?? null;
  const landlord = body.landlord ?? propertySource.landlord ?? null;

  if (!landlordId && !landlord) {
    return NextResponse.json({ error: "LANDLORD_REQUIRED" }, { status: 400 });
  }

  if (!propertySource.postcode) {
    return NextResponse.json({ error: "POSTCODE_REQUIRED" }, { status: 400 });
  }

  try {
    const result = await createInterestedPropertyIntake({
      agentId: auth.user.id,
      landlordId,
      landlord: landlord
        ? {
            firstName: String(landlord.firstName ?? landlord.landlordFirstName ?? "").trim(),
            lastName: String(landlord.lastName ?? landlord.landlordLastName ?? "").trim(),
            phoneNo: String(landlord.phoneNo ?? landlord.phone ?? landlord.landlordNumber ?? "").trim(),
            email: landlord.email ? String(landlord.email).trim() : null,
          }
        : null,
      property: {
        propertyRef: propertySource.propertyRef ?? propertySource.reference ?? null,
        title: propertySource.title ?? null,
        description: propertySource.description ?? null,
        addressLine1: propertySource.addressLine1 ?? null,
        addressLine2: propertySource.addressLine2 ?? null,
        city: propertySource.city ?? null,
        county: propertySource.county ?? null,
        postcode: String(propertySource.postcode).trim(),
        propertyCategory: (propertySource.propertyCategory
          ? String(propertySource.propertyCategory).trim().toUpperCase()
          : propertySource.branch
            ? String(propertySource.branch).trim().toUpperCase()
            : null) as any,
        propertyType: propertySource.propertyType ?? null,
        beds: propertySource.beds == null ? null : Number(propertySource.beds),
        baths: propertySource.baths == null ? null : Number(propertySource.baths),
        rentPerMonth: propertySource.rentPerMonth ?? null,
        rentPerWeek: propertySource.rentPerWeek ?? null,
        depositAmount: propertySource.depositAmount ?? null,
        isFurnished: propertySource.isFurnished ?? null,
        petsAllowed: propertySource.petsAllowed ?? null,
        dssAllowed: propertySource.dssAllowed ?? null,
        childrenAllowed: propertySource.childrenAllowed ?? null,
        availabilityDate: propertySource.availabilityDate ?? null,
        livingLandlord: propertySource.livingLandlord ?? null,
        publishedToWebsite: propertySource.publishedToWebsite ?? false,
        rooms,
        photos,
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "PROPERTY_INTAKE_FAILED";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}