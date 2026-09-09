import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MAX_DESCRIPTION_LENGTH,
  MAX_TITLE_LENGTH,
  deriveListingKeywords,
  deriveListingSeo,
  detectRoomTypes,
  truncateAtWord,
} from "../services/listing-seo";

describe("detectRoomTypes", () => {
  it("finds en-suite however it is written", () => {
    assert.deepEqual(detectRoomTypes("Private en-suite with own kitchen"), ["en-suite room"]);
    assert.deepEqual(detectRoomTypes("Large ensuite available"), ["en-suite room"]);
    assert.deepEqual(detectRoomTypes("En suite room"), ["en-suite room"]);
  });

  it("finds the other letting types", () => {
    assert.deepEqual(detectRoomTypes("Studio flats available at Hounslow"), ["studio flat"]);
    assert.deepEqual(detectRoomTypes("One double bedroom in shared house"), [
      "double room",
      "shared house",
    ]);
    assert.deepEqual(detectRoomTypes("Spacious Master room - Forest Gate"), ["master room"]);
  });

  it("finds nothing in a listing that mentions no type", () => {
    assert.deepEqual(detectRoomTypes("Bright property close to the station"), []);
  });
});

describe("truncateAtWord", () => {
  it("leaves a short value alone", () => {
    assert.equal(truncateAtWord("Short title", 60), "Short title");
  });

  it("cuts a title at a word boundary without an ellipsis", () => {
    const result = truncateAtWord("A very long property title that runs past the sixty limit", 30);
    assert.ok(result.length <= 30);
    assert.ok(!result.endsWith("…"));
    assert.ok(!result.endsWith(" "));
    // The last word must be whole.
    assert.ok("A very long property title that runs past the sixty limit".startsWith(result));
  });

  it("ends a description with an ellipsis and stays within the limit", () => {
    const long = "word ".repeat(80);
    const result = truncateAtWord(long, MAX_DESCRIPTION_LENGTH, true);
    assert.ok(result.length <= MAX_DESCRIPTION_LENGTH);
    assert.ok(result.endsWith("…"));
  });

  it("collapses whitespace", () => {
    assert.equal(truncateAtWord("  two   words  ", 60), "two words");
  });
});

describe("deriveListingKeywords", () => {
  it("pairs the letting type with the place", () => {
    const keywords = deriveListingKeywords({
      title: "Private studio style en-suite with own kitchen",
      area: "Harrow",
      outcode: "HA1",
    });

    assert.ok(keywords.includes("en-suite room Harrow"));
    assert.ok(keywords.includes("en-suite room HA1"));
    assert.ok(keywords.includes("property to rent Harrow"));
  });

  it("falls back to the property type when the words say nothing", () => {
    const keywords = deriveListingKeywords({
      title: "Bright home near the park",
      typeLabel: "Shared house",
      area: "Ilford",
    });

    assert.ok(keywords.includes("shared house Ilford"));
  });

  it("does not repeat a place written two ways", () => {
    const keywords = deriveListingKeywords({
      title: "Double room",
      area: "Stratford",
      town: "stratford",
    });

    const stratford = keywords.filter((k) => k.toLowerCase() === "double room stratford");
    assert.equal(stratford.length, 1);
  });

  it("still produces keywords with no place at all", () => {
    const keywords = deriveListingKeywords({ title: "Studio flat" });
    assert.ok(keywords.includes("studio flat to rent"));
  });

  it("never returns an unbounded list", () => {
    const keywords = deriveListingKeywords({
      title: "En-suite double single master twin studio in a shared house",
      area: "Ilford",
      town: "London",
      outcode: "IG1",
    });
    assert.ok(keywords.length <= 10);
  });
});

describe("deriveListingSeo", () => {
  it("uses the listing title, capped to the search limit", () => {
    const seo = deriveListingSeo({
      title: "An extremely long property title that would certainly be cut off by Google in results",
      description: "A description.",
    });

    assert.ok(seo.metaTitle.length <= MAX_TITLE_LENGTH);
  });

  it("prefers what the agent wrote", () => {
    const seo = deriveListingSeo({
      title: "Derived title",
      metaTitle: "Agent's own title",
      metaDescription: "Agent's own description.",
    });

    assert.equal(seo.metaTitle, "Agent's own title");
    assert.equal(seo.metaDescription, "Agent's own description.");
  });

  it("builds a description from the listing when there is none", () => {
    const seo = deriveListingSeo({
      title: "Room available",
      typeLabel: "Shared house",
      area: "Harrow",
      outcode: "HA1",
      bedrooms: 4,
    });

    assert.ok(seo.metaDescription.includes("Harrow HA1"));
    assert.ok(seo.metaDescription.includes("4 bedroom"));
  });

  it("keeps a long description inside the limit", () => {
    const seo = deriveListingSeo({
      title: "A room",
      description: "Lovely spacious room. ".repeat(30),
    });

    assert.ok(seo.metaDescription.length <= MAX_DESCRIPTION_LENGTH);
  });

  it("strips markup out of a description", () => {
    const seo = deriveListingSeo({
      title: "A room",
      description: "<p>Bright <strong>double</strong> room.</p>",
    });

    assert.ok(!seo.metaDescription.includes("<"));
    assert.ok(seo.metaDescription.includes("Bright double room."));
  });

  it("always produces all three, even from almost nothing", () => {
    const seo = deriveListingSeo({ title: null });
    assert.ok(seo.metaTitle.length > 0);
    assert.ok(seo.metaDescription.length > 0);
    assert.ok(seo.keywords.length > 0);
  });
});
