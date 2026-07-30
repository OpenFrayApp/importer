import { test } from "node:test";
import assert from "node:assert/strict";
import { Window } from "happy-dom";

// cash-dom captures document/window at module load, so the happy-dom globals
// must exist before the imports below evaluate it.
const win = new Window();
Object.assign(globalThis, { window: win, document: win.document });

const cash = (await import("cash-dom")).default;
const { descriptionToMarkdown } = await import("../utils/descriptionToMarkdown.ts");

/** Run the converter over a container div holding `html`. */
function markdown(html: string) {
  const container = document.createElement("div");
  container.innerHTML = html;
  return descriptionToMarkdown(cash(container));
}

test("headings map to markdown heading levels", () => {
  assert.equal(
    markdown("<h1>Red Dragons</h1><h2>Habitat</h2><h3>Lairs</h3><h6>Footnotes</h6>"),
    "# Red Dragons\n\n## Habitat\n\n### Lairs\n\n###### Footnotes",
  );
});

test("paragraphs join with blank lines and empty elements are skipped", () => {
  assert.equal(
    markdown("<p>First paragraph.</p><p>   </p><p>Second paragraph.</p>"),
    "First paragraph.\n\nSecond paragraph.",
  );
});

test("inline emphasis flattens to plain text", () => {
  assert.equal(
    markdown("<p>The <strong>vainest</strong> and <em>most covetous</em> of dragons.</p>"),
    "The vainest and most covetous of dragons.",
  );
});

test("unordered and ordered lists both become dash items, blank-line separated", () => {
  assert.equal(
    markdown("<ul><li>Claw</li><li>Bite</li></ul><ol><li>First</li><li>Second</li></ol>"),
    "- Claw\n\n- Bite\n\n- First\n\n- Second",
  );
});

test("horizontal rules are dropped", () => {
  assert.equal(markdown("<p>Before.</p><hr><p>After.</p>"), "Before.\n\nAfter.");
});

test("unhandled blocks fall back to their flattened text", () => {
  assert.equal(markdown("<blockquote>Never bargain with a dragon.</blockquote>"), "Never bargain with a dragon.");
  assert.equal(
    markdown("<table><tbody><tr><td>CR</td><td>17</td></tr></tbody></table>"),
    "CR17",
  );
});
