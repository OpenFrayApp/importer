// DDB doesn't give every power its own <p>. The beholder's ten eye rays share one
// paragraph, separated by <br>; the beholder zombie writes the same table as an
// <ol>. Reading one power per <p> merged the ten into the first and dropped the
// list outright, so the converter saw one save and every ray's damage at once.

/** A power entry names itself when its first meaningful child is a <strong>; DDB
 *  wraps that name in an <em> as often as not. */
export function leadsWithName(el: Element): boolean {
  for (const node of Array.from(el.childNodes)) {
    // Skip the whitespace DDB leaves after a <br>.
    if (node.nodeType === 3) {
      if (!node.textContent?.trim()) continue;
      return false;
    }
    if (node.nodeName === "STRONG") return true;
    if (node.nodeName === "EM") return !!(node as Element).querySelector("strong");
    return false;
  }
  return false;
}

/** Split a paragraph that packs several <strong>-led entries into one node each. A
 *  <br> that merely breaks a line inside a single power leaves the paragraph whole. */
export function splitOnBreaks(el: Element): Element[] {
  const segments: Element[] = [];
  let current = el.ownerDocument.createElement("p");
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeName === "BR") {
      segments.push(current);
      current = el.ownerDocument.createElement("p");
      continue;
    }
    current.appendChild(node.cloneNode(true));
  }
  segments.push(current);

  return segments.filter(leadsWithName).length < 2 ? [el] : segments;
}

/** One node per power, in document order: the paragraphs and list items under
 *  `roots`, at whatever depth DDB nested them — some pages wrap a section's content
 *  in another div — minus any sitting inside one already taken, since a <p> inside
 *  an <li> is part of that item rather than a power of its own. */
export function powerNodes(roots: Element[]): Element[] {
  const taken: Element[] = [];
  for (const root of roots) {
    for (const el of Array.from(root.querySelectorAll("p, li"))) {
      // contains() counts the node itself, so this also drops repeats when the
      // roots overlap.
      if (taken.some((t) => t.contains(el))) continue;
      taken.push(el);
    }
  }
  return taken.flatMap((el) => (el.nodeName === "P" ? splitOnBreaks(el) : [el]));
}

/** A power's text, keeping the blank line between paragraphs DDB nests inside one
 *  entry — a list item whose ray spills into a second <p>. Flattening the node
 *  outright would run them together. */
export function powerText(el: Element): string {
  const paragraphs = Array.from(el.children).filter((c) => c.nodeName === "P");
  if (paragraphs.length > 1) {
    return paragraphs
      .map((c) => c.textContent?.trim() ?? "")
      .filter(Boolean)
      .join("\n\n");
  }
  return el.textContent?.trim() ?? "";
}
