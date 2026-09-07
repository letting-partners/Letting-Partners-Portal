import { monthlyToWeeklyPence, weeklyToMonthlyPence } from "@/lib/money";

/**
 * Rules about what a property must contain before it can be advertised, and
 * how rent is derived. Pure, so they can be unit tested and reused on the
 * client to disable an action before the server has to reject it.
 */

export class ListingRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ListingRuleError";
  }
}

export type PublishReadiness = {
  ready: boolean;
  /** Human-readable list of what is still missing. */
  missing: string[];
};

export type PublishCandidate = {
  title: string | null;
  description: string | null;
  imageCount: number;
  propertyType: string;
  roomCount: number;
  rentPerMonthPence: number | null;
};

/**
 * What a property still needs before it can go on the public website.
 *
 * A draft is never publishable by accident: the title, the description and at
 * least one photo are all required, and a shared property needs a room.
 */
export function checkPublishReadiness(property: PublishCandidate): PublishReadiness {
  const missing: string[] = [];

  if (!property.title?.trim()) missing.push("Property title");
  if (!property.description?.trim()) missing.push("Description");
  if (property.imageCount === 0) missing.push("At least one photo");

  if (property.propertyType === "SHARED" && property.roomCount === 0) {
    missing.push("At least one room");
  }
  if (property.propertyType === "FULL" && !property.rentPerMonthPence) {
    missing.push("Monthly rent");
  }

  return { ready: missing.length === 0, missing };
}

/**
 * Both rent figures are always stored, derived from whichever the user
 * entered, so a listing can be searched and displayed either way.
 */
export function resolveRent(
  rentPence: number,
  frequency: "MONTHLY" | "WEEKLY",
): { rentPerMonthPence: number; rentPerWeekPence: number } {
  if (!Number.isFinite(rentPence) || rentPence <= 0) {
    throw new ListingRuleError("Enter a rent greater than zero.");
  }

  return frequency === "MONTHLY"
    ? { rentPerMonthPence: rentPence, rentPerWeekPence: monthlyToWeeklyPence(rentPence) }
    : { rentPerMonthPence: weeklyToMonthlyPence(rentPence), rentPerWeekPence: rentPence };
}

/**
 * Room counts on a full house or flat. A studio has no separate room count,
 * and available can never exceed the total.
 */
export function validateRoomCounts(input: {
  category: string | null | undefined;
  numberOfRooms: number | null | undefined;
  availableRooms: number | null | undefined;
}): void {
  if (input.category === "STUDIO_FLAT") return;

  if (!input.numberOfRooms || input.numberOfRooms < 1) {
    throw new ListingRuleError("Enter the number of rooms.");
  }
  if (input.availableRooms == null || input.availableRooms < 0) {
    throw new ListingRuleError("Enter how many rooms are available.");
  }
  if (input.availableRooms > input.numberOfRooms) {
    throw new ListingRuleError("Available rooms cannot be more than the total number of rooms.");
  }
}

/** A percentage commission is a share of one month of rent, so cap it sanely. */
export function validateCommissionValue(
  type: "PERCENTAGE" | "FIXED" | null | undefined,
  value: number | null | undefined,
): void {
  if (!type || value == null) return;

  if (value < 0) throw new ListingRuleError("Commission cannot be negative.");
  if (type === "PERCENTAGE" && value > 100_000) {
    throw new ListingRuleError("A percentage commission must be between 0 and 1000%.");
  }
}
