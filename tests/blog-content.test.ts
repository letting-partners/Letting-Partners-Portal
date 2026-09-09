import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { htmlToText, readingMinutes, sanitizeHtml, slugify } from "../services/blog-content";

/**
 * The sanitiser is the only thing between a pasted script and every visitor to
 * the website, so it is tested against the shapes an attack actually takes
 * rather than only the happy path.
 */

describe("sanitizeHtml", () => {
  it("keeps the tags an article is made of", () => {
    const input = "<h2>Heading</h2><p>Some <strong>bold</strong> and <em>italic</em>.</p><ul><li>One</li></ul>";
    assert.equal(sanitizeHtml(input), input);
  });

  it("removes a script element and its contents", () => {
    const output = sanitizeHtml('<p>Before</p><script>alert("x")</script><p>After</p>');
    assert.equal(output, "<p>Before</p><p>After</p>");
    assert.ok(!output.includes("alert"));
  });

  it("removes an unclosed script tag", () => {
    const output = sanitizeHtml('<p>Hi</p><script src="https://evil.example/x.js">');
    assert.equal(output, "<p>Hi</p>");
  });

  it("strips event handler attributes", () => {
    const output = sanitizeHtml('<p onclick="steal()">Text</p>');
    assert.equal(output, "<p>Text</p>");
  });

  it("drops a javascript: link but keeps the text", () => {
    const output = sanitizeHtml('<a href="javascript:alert(1)">Click</a>');
    assert.equal(output, "<a>Click</a>");
  });

  it("keeps ordinary links, including relative and mail ones", () => {
    assert.equal(
      sanitizeHtml('<a href="https://example.com">x</a>'),
      '<a href="https://example.com">x</a>',
    );
    assert.equal(sanitizeHtml('<a href="/properties">x</a>'), '<a href="/properties">x</a>');
    assert.equal(sanitizeHtml('<a href="mailto:a@b.co">x</a>'), '<a href="mailto:a@b.co">x</a>');
  });

  it("adds rel to links that open a new window", () => {
    const output = sanitizeHtml('<a href="https://example.com" target="_blank">x</a>');
    assert.ok(output.includes('rel="noopener noreferrer"'));
  });

  it("keeps images with their alt text", () => {
    const output = sanitizeHtml('<img src="https://cdn.example/a.jpg" alt="A room">');
    assert.ok(output.includes('src="https://cdn.example/a.jpg"'));
    assert.ok(output.includes('alt="A room"'));
  });

  it("drops a data: image, which can carry script", () => {
    const output = sanitizeHtml('<img src="data:text/html;base64,PHNjcmlwdD4=" alt="x">');
    assert.ok(!output.includes("data:"));
  });

  it("removes unknown tags but keeps their text", () => {
    assert.equal(sanitizeHtml("<marquee>Move</marquee>"), "Move");
  });

  it("removes iframes entirely", () => {
    assert.equal(sanitizeHtml('<iframe src="https://evil.example"></iframe><p>Hi</p>'), "<p>Hi</p>");
  });
});

describe("slugify", () => {
  it("makes a URL segment from a title", () => {
    assert.equal(slugify("How to Rent Out Your Property"), "how-to-rent-out-your-property");
  });

  it("collapses punctuation and trims dashes", () => {
    assert.equal(slugify("  Landlord's Guide: 2026!  "), "landlord-s-guide-2026");
  });

  it("returns an empty string when there is nothing usable", () => {
    assert.equal(slugify("!!!"), "");
  });
});

describe("readingMinutes", () => {
  it("never reports less than a minute", () => {
    assert.equal(readingMinutes("<p>Short.</p>"), 1);
  });

  it("scales with the word count", () => {
    const body = `<p>${"word ".repeat(600)}</p>`;
    assert.equal(readingMinutes(body), 3);
  });
});

describe("htmlToText", () => {
  it("strips markup and collapses whitespace", () => {
    assert.equal(htmlToText("<p>One</p>\n<p>Two</p>"), "One Two");
  });
});
