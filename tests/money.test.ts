import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyBasisPoints,
  formatGBP,
  formatGBPWithPkr,
  monthlyToWeeklyPence,
  penceToPkr,
  poundsToPence,
  splitPence,
  weeklyToMonthlyPence,
} from "../lib/money";
import { formatPostcode, getOutcode, isValidPostcode, parsePostcode } from "../lib/postcode";

describe("rent conversion", () => {
  it("annualises rather than dividing by four", () => {
    // 1300 pcm -> 1300 * 12 / 52 = 300 pw exactly.
    assert.equal(monthlyToWeeklyPence(1300_00), 300_00);
    // The naive monthly/4 would give 325.00, which is wrong.
    assert.notEqual(monthlyToWeeklyPence(1300_00), 325_00);
  });

  it("converts weekly back to monthly", () => {
    assert.equal(weeklyToMonthlyPence(300_00), 1300_00);
  });

  it("round trips within a penny", () => {
    for (const monthly of [500_00, 725_00, 995_00, 1234_56, 2000_00]) {
      const weekly = monthlyToWeeklyPence(monthly);
      const back = weeklyToMonthlyPence(weekly);
      assert.ok(
        Math.abs(back - monthly) <= 2,
        `round trip drifted for ${monthly}: got ${back}`,
      );
    }
  });
});

describe("pence and percentages", () => {
  it("parses pounds into whole pence", () => {
    assert.equal(poundsToPence(1300), 130_000);
    assert.equal(poundsToPence("1,300.50"), 130_050);
    assert.equal(poundsToPence("£950"), 95_000);
    assert.equal(poundsToPence(""), null);
    assert.equal(poundsToPence(null), null);
  });

  it("applies basis points", () => {
    assert.equal(applyBasisPoints(1000_00, 1000), 100_00); // 10%
    assert.equal(applyBasisPoints(1000_00, 5000), 500_00); // 50%
    assert.equal(applyBasisPoints(333, 3333), 111); // rounds to the nearest penny
  });

  it("formats GBP the way the UK reads it", () => {
    assert.equal(formatGBP(130_000), "£1,300");
    assert.equal(formatGBP(130_050), "£1,300.50");
    assert.equal(formatGBP(null), "-");
  });
});

describe("splitPence", () => {
  it("never loses or invents a penny", () => {
    for (const total of [1, 2, 3, 7, 99, 100, 101, 1_000_003]) {
      const parts = splitPence(total, [6000, 4000]);
      assert.equal(parts.reduce((a, b) => a + b, 0), total, `lost a penny splitting ${total}`);
    }
  });

  it("divides evenly when it can", () => {
    assert.deepEqual(splitPence(450_00, [6000, 4000]), [270_00, 180_00]);
  });

  it("gives everything to a single share", () => {
    assert.deepEqual(splitPence(450_00, [10000, 0]), [450_00, 0]);
  });
});

describe("PKR display", () => {
  it("converts using a rate stored x100", () => {
    // 500.00 GBP at 369.00 PKR/GBP
    assert.equal(penceToPkr(500_00, 36_900), 184_500);
  });

  it("always labels the PKR figure as approximate", () => {
    const label = formatGBPWithPkr(500_00, 36_900);
    assert.match(label, /£500\.00/);
    assert.match(label, /approx/i);
    assert.match(label, /184,500/);
  });

  it("shows GBP alone when no rate is set", () => {
    assert.equal(formatGBPWithPkr(500_00, null), "£500.00");
  });
});

describe("UK postcodes", () => {
  it("uppercases and spaces correctly", () => {
    assert.equal(formatPostcode("m14 5ab"), "M14 5AB");
    assert.equal(formatPostcode("M145AB"), "M14 5AB");
    assert.equal(formatPostcode("  ig1 1aa "), "IG1 1AA");
  });

  it("extracts the outward code for public display and search", () => {
    assert.equal(getOutcode("M14 5AB"), "M14");
    assert.equal(getOutcode("SW1A 1AA"), "SW1A");
    assert.equal(getOutcode("B1 1AA"), "B1");
  });

  it("keeps the inward code separate so it can stay private", () => {
    const parts = parsePostcode("M14 5AB");
    assert.equal(parts?.outcode, "M14");
    assert.equal(parts?.incode, "5AB");
  });

  it("rejects nonsense", () => {
    assert.equal(isValidPostcode("not a postcode"), false);
    assert.equal(isValidPostcode(""), false);
    assert.equal(isValidPostcode("12345"), false);
  });
});
