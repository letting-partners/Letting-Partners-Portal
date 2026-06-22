import { NextResponse } from "next/server";

export async function PATCH() {
  return NextResponse.json(
    {
      error: "ENDPOINT_DEPRECATED",
      message:
        "Landlord PASSIVE status has been removed. Use PATCH /api/landlords/:landlordId for updates.",
    },
    { status: 410 },
  );
}
