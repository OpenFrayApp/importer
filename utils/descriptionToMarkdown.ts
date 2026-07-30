import cash, { type Cash } from "cash-dom";

/**
 * Convert a DDB description block's child elements to markdown so OpenFray renders
 * its structure — headings (<h1>–<h6>), lists, and paragraphs — instead of `.text()`
 * flattening it all onto one run-together line. Inline emphasis (bold/italic) isn't
 * preserved; block structure is what matters here. `<hr>` is dropped (the rule reads
 * badly in OpenFray's stat block).
 */
export function descriptionToMarkdown(container: Cash): string {
  const parts: string[] = [];
  container.children().each((_, el: Element) => {
    const tag = (el.tagName || "").toLowerCase();
    if (/^h[1-6]$/.test(tag)) {
      const text = cash(el).text().trim();
      if (text) parts.push(`${"#".repeat(Number(tag[1]))} ${text}`);
    } else if (tag === "hr") {
      // skip — no horizontal rule in the rendered description
    } else if (tag === "ul" || tag === "ol") {
      cash(el)
        .children("li")
        .each((__, li: Element) => {
          const text = cash(li).text().trim();
          if (text) parts.push(`- ${text}`);
        });
    } else {
      const text = cash(el).text().trim();
      if (text) parts.push(text);
    }
  });
  return parts.join("\n\n");
}
