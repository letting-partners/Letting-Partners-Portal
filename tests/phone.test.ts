import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatUKPhone,
  isValidUKPhone,
  normalizeUKPhone,
  normalizeUKPhoneDetailed,
  toE164,
} from "../lib/phone";

describe("normalizeUKPhone", () => {
  it("resolves every format of the same mobile to one key", () => {
    const expected = "7911123456";
    const inputs = [
      "+44 7911 123456",
      "07911 123456",
      "0044 7911 123456",
      "+447911123456",
      "07911123456",
      "(07911) 123-456",
      "44 7911 123456",
      "7911123456",
      "  07911   123456  ",
    ];

    for (const input of inputs) {
      assert.equal(normalizeUKPhone(input), expected, `failed for "${input}"`);
    }
  });

  it("resolves London landline formats to one key", () => {
    const expected = "2079460000";
    for (const input of ["020 7946 0000", "+44 20 7946 0000", "00442079460000", "02079460000"]) {
      assert.equal(normalizeUKPhone(input), expected, `failed for "${input}"`);
    }
  });

  it("keeps different numbers distinct", () => {
    assert.notEqual(normalizeUKPhone("07911123456"), normalizeUKPhone("07911123457"));
  });

  it("rejects input that cannot be a UK number", () => {
    assert.equal(normalizeUKPhone(""), null);
    assert.equal(normalizeUKPhone(null), null);
    assert.equal(normalizeUKPhone("12345"), null);
    assert.equal(normalizeUKPhone("not a phone"), null);
    assert.equal(normalizeUKPhone("0400 123 4567"), null, "4 is not a valid leading digit");
  });

  it("reports why a number was rejected", () => {
    assert.equal(normalizeUKPhoneDetailed("").ok, false);
    const short = normalizeUKPhoneDetailed("0791112");
    assert.equal(short.ok, false);
    assert.equal(short.ok === false && short.reason, "TOO_SHORT");

    const bad = normalizeUKPhoneDetailed("0400 123 4567");
    assert.equal(bad.ok === false && bad.reason, "INVALID_PREFIX");
  });

  it("is idempotent - normalising a key returns the same key", () => {
    const once = normalizeUKPhone("+44 7911 123456");
    assert.equal(normalizeUKPhone(once), once);
  });
});

describe("phone display", () => {
  it("formats mobiles the way a UK user reads them", () => {
    assert.equal(formatUKPhone("7911123456"), "07911 123456");
  });

  it("formats London numbers with the 020 grouping", () => {
    assert.equal(formatUKPhone("2079460000"), "020 7946 0000");
  });

  it("produces E.164 for telephony", () => {
    assert.equal(toE164("7911123456"), "+447911123456");
    assert.equal(toE164("bad"), "");
  });

  it("validates", () => {
    assert.equal(isValidUKPhone("07911 123456"), true);
    assert.equal(isValidUKPhone("123"), false);
  });
});
