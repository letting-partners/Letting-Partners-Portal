import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  checkPublishReadiness,
  ListingRuleError,
  resolveRent,
  validateCommissionValue,
  validateRoomCounts,
} from "../services/listing-rules";

const COMPLETE_FULL = {
  title: "Modern 2 bedroom flat with balcony and parking, Ilford",
  description: "A bright two bedroom flat moments from Ilford station.",
  imageCount: 4,
  propertyType: "FULL",
  roomCount: 0,
  rentPerMonthPence: 150_000,
};

describe("publish readiness", () => {
  it("passes a complete full property", () => {
    const result = checkPublishReadiness(COMPLETE_FULL);
    assert.equal(result.ready, true);
    assert.deepEqual(result.missing, []);
  });

  it("blocks a draft with no title or description", () => {
    const result = checkPublishReadiness({
      ...COMPLETE_FULL,
      title: null,
      description: null,
    });

    assert.equal(result.ready, false);
    assert.ok(result.missing.includes("Property title"));
    assert.ok(result.missing.includes("Description"));
  });

  it("blocks a listing with no photo", () => {
    const result = checkPublishReadiness({ ...COMPLETE_FULL, imageCount: 0 });
    assert.equal(result.ready, false);
    assert.ok(result.missing.includes("At least one photo"));
  });

  it("treats whitespace as missing, not as content", () => {
    const result = checkPublishReadiness({
      ...COMPLETE_FULL,
      title: "   ",
      description: "\n\t ",
    });
    assert.equal(result.ready, false);
    assert.equal(result.missing.length, 2);
  });

  it("blocks a full property with no rent", () => {
    const result = checkPublishReadiness({ ...COMPLETE_FULL, rentPerMonthPence: null });
    assert.equal(result.ready, false);
    assert.ok(result.missing.includes("Monthly rent"));
  });

  it("blocks a shared property with no rooms", () => {
    const result = checkPublishReadiness({
      ...COMPLETE_FULL,
      propertyType: "SHARED",
      roomCount: 0,
      rentPerMonthPence: null,
    });

    assert.equal(result.ready, false);
    assert.ok(result.missing.includes("At least one room"));
  });

  it("does not demand a property-level rent on a shared property", () => {
    const result = checkPublishReadiness({
      ...COMPLETE_FULL,
      propertyType: "SHARED",
      roomCount: 3,
      rentPerMonthPence: null,
    });

    assert.equal(result.ready, true, "rent lives on the rooms for a house share");
  });

  it("lists everything missing at once, not just the first problem", () => {
    const result = checkPublishReadiness({
      title: null,
      description: null,
      imageCount: 0,
      propertyType: "SHARED",
      roomCount: 0,
      rentPerMonthPence: null,
    });

    assert.equal(result.missing.length, 4);
  });
});

describe("room counts", () => {
  it("accepts available within the total", () => {
    assert.doesNotThrow(() =>
      validateRoomCounts({ category: "HOUSE", numberOfRooms: 4, availableRooms: 2 }),
    );
    assert.doesNotThrow(() =>
      validateRoomCounts({ category: "HOUSE", numberOfRooms: 4, availableRooms: 4 }),
    );
    assert.doesNotThrow(() =>
      validateRoomCounts({ category: "HOUSE", numberOfRooms: 4, availableRooms: 0 }),
    );
  });

  it("rejects more available than exist", () => {
    assert.throws(
      () => validateRoomCounts({ category: "HOUSE", numberOfRooms: 3, availableRooms: 4 }),
      ListingRuleError,
    );
    assert.throws(
      () => validateRoomCounts({ category: "FLAT", numberOfRooms: 1, availableRooms: 2 }),
      /cannot be more than/,
    );
  });

  it("requires a room count on a house or flat", () => {
    assert.throws(
      () => validateRoomCounts({ category: "HOUSE", numberOfRooms: null, availableRooms: 1 }),
      ListingRuleError,
    );
  });

  it("skips the check entirely for a studio", () => {
    assert.doesNotThrow(() =>
      validateRoomCounts({ category: "STUDIO_FLAT", numberOfRooms: null, availableRooms: null }),
    );
  });
});

describe("rent resolution", () => {
  it("derives the weekly figure from a monthly rent", () => {
    const result = resolveRent(1300_00, "MONTHLY");
    assert.equal(result.rentPerMonthPence, 1300_00);
    assert.equal(result.rentPerWeekPence, 300_00);
  });

  it("derives the monthly figure from a weekly rent", () => {
    const result = resolveRent(300_00, "WEEKLY");
    assert.equal(result.rentPerWeekPence, 300_00);
    assert.equal(result.rentPerMonthPence, 1300_00);
  });

  it("rejects a zero or negative rent", () => {
    assert.throws(() => resolveRent(0, "MONTHLY"), ListingRuleError);
    assert.throws(() => resolveRent(-1, "MONTHLY"), ListingRuleError);
  });
});

describe("commission validation", () => {
  it("accepts a sane percentage and a fixed amount", () => {
    assert.doesNotThrow(() => validateCommissionValue("PERCENTAGE", 10_000));
    assert.doesNotThrow(() => validateCommissionValue("FIXED", 90_000));
  });

  it("rejects a negative commission", () => {
    assert.throws(() => validateCommissionValue("FIXED", -1), ListingRuleError);
  });

  it("rejects an implausible percentage", () => {
    assert.throws(() => validateCommissionValue("PERCENTAGE", 200_000), ListingRuleError);
  });

  it("ignores an unset commission", () => {
    assert.doesNotThrow(() => validateCommissionValue(null, null));
    assert.doesNotThrow(() => validateCommissionValue("PERCENTAGE", null));
  });
});
