/**
 * Pure helpers for blog content: URL slugs, HTML sanitising, reading time.
 *
 * Deliberately free of `server-only` and of any database import, so the
 * sanitiser can be unit tested. It is the only thing standing between a pasted
 * script and every visitor to the site, which is not a guarantee to take on
 * trust.
 */

/* ---------------------------------------------------------------- slugs */

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 200);
}

/* ----------------------------------------------------------- sanitising */

const ALLOWED_TAGS = new Set([
  "p", "br", "strong", "b", "em", "i", "u", "s", "blockquote",
  "h2", "h3", "h4", "ul", "ol", "li", "a", "img", "figure", "figcaption",
  "hr", "code", "pre", "table", "thead", "tbody", "tr", "th", "td",
]);

const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(["href", "title", "target", "rel"]),
  img: new Set(["src", "alt", "width", "height", "loading"]),
};

/**
 * Strip anything that could execute.
 *
 * The body is written by staff and rendered as markup on the public site, so a
 * pasted script or an onclick handler would run for every visitor. Allowing a
 * known set of tags is the only version of this that stays safe as the editor
 * grows; blocking a list of bad ones never does.
 */
export function sanitizeHtml(input: string): string {
  let html = input;

  // Whole elements whose content is code, not text.
  html = html.replace(/<\s*(script|style|iframe|object|embed|form)[\s\S]*?<\s*\/\s*\1\s*>/gi, "");
  html = html.replace(/<\s*(script|style|iframe|object|embed|form)[^>]*\/?>/gi, "");

  html = html.replace(/<\s*(\/?)\s*([a-zA-Z0-9]+)((?:\s[^>]*)?)\/?\s*>/g, (match, closing, rawTag, rawAttrs) => {
    const tag = String(rawTag).toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) return "";
    if (closing) return `</${tag}>`;

    const allowed = ALLOWED_ATTRS[tag];
    if (!allowed) return `<${tag}>`;

    const kept: string[] = [];
    const attrPattern = /([a-zA-Z-]+)\s*=\s*"([^"]*)"|([a-zA-Z-]+)\s*=\s*'([^']*)'/g;
    let attr: RegExpExecArray | null;

    while ((attr = attrPattern.exec(String(rawAttrs))) !== null) {
      const name = (attr[1] ?? attr[3] ?? "").toLowerCase();
      const value = attr[2] ?? attr[4] ?? "";
      if (!allowed.has(name)) continue;

      // javascript: and data: URLs are how a link becomes a script.
      if ((name === "href" || name === "src") && !/^(https?:\/\/|\/|mailto:|tel:|#)/i.test(value)) {
        continue;
      }
      kept.push(`${name}="${value.replace(/"/g, "&quot;")}"`);
    }

    // Anything leaving the site should not hand over the referring window.
    if (tag === "a" && kept.some((a) => a.startsWith('target="_blank"'))) {
      if (!kept.some((a) => a.startsWith("rel="))) kept.push('rel="noopener noreferrer"');
    }

    return kept.length > 0 ? `<${tag} ${kept.join(" ")}>` : `<${tag}>`;
  });

  return html.trim();
}

/** Plain text of the body, for reading time and a fallback excerpt. */
export function htmlToText(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

export function readingMinutes(html: string): number {
  const words = htmlToText(html).split(" ").filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}
