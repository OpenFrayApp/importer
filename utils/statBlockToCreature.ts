// Convert a scraped `StatBlock` (DDB monster page) into an OpenFray `Creature`.
// Mechanics are pulled from the action prose into structured
// fields where the wording is unambiguous; the original prose is always kept in
// `text`, and anything that doesn't parse falls back to a `utility` action with
// `toHit: null` — never a wrong number. The same convention the openfray-compendium
// mappers follow, so an imported creature reads like an ingested one.

import {
  abilityMod,
  type StatBlock,
  type NameAndContent,
  type NameAndModifier,
} from "./statblock.ts";
import type {
  Ability,
  AbilityScores,
  Action,
  ActionKind,
  Creature,
  DamageRoll,
  DamageType,
  Edition,
  LegendaryActions,
  Range,
  Recharge,
  SaveBonuses,
  SaveOutcome,
  SaveRequirement,
  Senses,
  Size,
  Skill,
  SkillBonuses,
  Speeds,
  SpellGroup,
  SpellLevel,
  SpellRef,
  SpellSlots,
  Spellcasting,
  SpellUsage,
  Trait,
} from "./openfray/schema.ts";

const ABILITY_BY_NAME: Record<string, Ability> = {
  str: "str", strength: "str",
  dex: "dex", dexterity: "dex",
  con: "con", constitution: "con",
  int: "int", intelligence: "int",
  wis: "wis", wisdom: "wis",
  cha: "cha", charisma: "cha",
};

const SKILL_BY_LABEL: Record<string, Skill> = {
  acrobatics: "acrobatics",
  "animal handling": "animalHandling",
  arcana: "arcana",
  athletics: "athletics",
  deception: "deception",
  history: "history",
  insight: "insight",
  intimidation: "intimidation",
  investigation: "investigation",
  medicine: "medicine",
  nature: "nature",
  perception: "perception",
  performance: "performance",
  persuasion: "persuasion",
  religion: "religion",
  "sleight of hand": "sleightOfHand",
  stealth: "stealth",
  survival: "survival",
};

const SIZES: Size[] = [
  "Gargantuan", "Huge", "Large", "Medium or Small", "Medium", "Small", "Tiny",
];

const DAMAGE_TYPES = new Set<DamageType>([
  "acid", "bludgeoning", "cold", "fire", "force", "lightning",
  "necrotic", "piercing", "poison", "psychic", "radiant", "slashing", "thunder",
]);

/** Lowercase a name and collapse non-alphanumerics into hyphens for ids ("Adult Red Dragon" → "adult-red-dragon"). */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Strip the spaces DDB puts inside dice notation: "2d10 + 8" → "2d10+8". */
const normalizeFormula = (s: string): string => s.replace(/\s+/g, "");

/** Display source: the scraped book + page, tagged as a manual import for provenance. */
function importSource(raw: string | undefined): string {
  const book = raw?.trim();
  return book ? `${book} - Manual import` : "Manual import";
}

/** A CR string ("1/2", "10") → its numeric value; undefined for blank or dash placeholders. */
function parseCr(raw: string): number | undefined {
  const s = (raw ?? "").trim();
  if (!s || s === "—" || s === "--") return undefined;
  if (s.includes("/")) {
    const [a, b] = s.split("/").map((x) => Number(x));
    if (b) return a / b;
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

/** Split "Large Fiend (Devil), Lawful Evil" into size, lowercased type (subtype dropped), and alignment. */
function parseSizeTypeAlignment(raw: string): {
  size: Size;
  type: string;
  alignment?: string;
} {
  const text = (raw ?? "").trim();
  const [left, ...rest] = text.split(",");
  const alignment = rest.join(",").trim().toLowerCase() || undefined;

  const size = SIZES.find((s) => new RegExp(`^${s}\\b`, "i").test(left)) ?? "Medium";
  const type = left
    .replace(new RegExp(`^${size}`, "i"), "")
    .replace(/\([^)]*\)/g, "") // drop "(Elf)" / "(Any Race)" subtypes
    .trim()
    .toLowerCase();

  return { size, type, alignment };
}

/** "(18d10 + 36)" / "18d10 + 36" → "18d10+36". */
function parseHpFormula(notes: string): string | undefined {
  const m = /(\d+d\d+(?:\s*[+-]\s*\d+)?)/.exec(notes ?? "");
  return m ? normalizeFormula(m[1]) : undefined;
}

/** Speed entries ("40 ft.", "fly 80 ft. (hover)") → the Speeds map; unlabeled numbers are walk. */
function parseSpeeds(entries: string[]): Speeds {
  const speed: Speeds = {};
  for (const entry of entries ?? []) {
    const value = Number(/(\d+)/.exec(entry)?.[1]);
    if (!Number.isFinite(value)) continue;
    const key = /\b(fly|swim|climb|burrow)\b/i.exec(entry)?.[1]?.toLowerCase() as
      | "fly" | "swim" | "climb" | "burrow" | undefined;
    if (key) {
      speed[key] = value;
      if (key === "fly" && /hover/i.test(entry)) speed.hover = true;
    } else {
      speed.walk = value;
    }
  }
  return speed;
}

/** Sense entries ("darkvision 120 ft.", "passive Perception 22") → Senses; passive defaults to 10. */
function parseSenses(entries: string[]): Senses {
  const senses: Senses = { passivePerception: 10 };
  for (const entry of entries ?? []) {
    const pp = /passive perception\s+(\d+)/i.exec(entry);
    if (pp) {
      senses.passivePerception = Number(pp[1]);
      continue;
    }
    const m = /(darkvision|blindsight|tremorsense|truesight)\s+(\d+)/i.exec(entry);
    if (m) {
      const key = m[1].toLowerCase() as
        | "darkvision" | "blindsight" | "tremorsense" | "truesight";
      senses[key] = Number(m[2]);
    }
  }
  return senses;
}

/** Saving-throw entries ("Dex +5") → SaveBonuses keyed by ability; undefined when none parse. */
function parseSaves(entries: NameAndModifier[]): SaveBonuses | undefined {
  const out: SaveBonuses = {};
  for (const { Name, Modifier } of entries ?? []) {
    const ability = ABILITY_BY_NAME[Name.trim().toLowerCase()];
    if (ability) out[ability] = Modifier;
  }
  return Object.keys(out).length ? out : undefined;
}

/** Skill entries ("Stealth +7") → SkillBonuses keyed by skill; undefined when none parse. */
function parseSkills(entries: NameAndModifier[]): SkillBonuses | undefined {
  const out: SkillBonuses = {};
  for (const { Name, Modifier } of entries ?? []) {
    const skill = SKILL_BY_LABEL[Name.trim().toLowerCase()];
    if (skill) out[skill] = Modifier;
  }
  return Object.keys(out).length ? out : undefined;
}

/** Trim entries and drop blanks and "--" placeholders; undefined when nothing remains. */
function cleanList(items: string[] | undefined): string[] | undefined {
  const out = (items ?? []).map((s) => s.trim()).filter((s) => s && s !== "--");
  return out.length ? out : undefined;
}

const DAMAGE_RE =
  /\d+\s*\(([0-9dD]+(?:\s*[+-]\s*\d+)?)\)\s*([A-Za-z]+)\s+damage/g;

/** All damage components in prose, in order ("19 (2d10 + 8) Piercing damage plus 7 (2d6) Fire damage"). */
function parseDamage(text: string): DamageRoll[] | undefined {
  const out: DamageRoll[] = [];
  for (const m of text.matchAll(DAMAGE_RE)) {
    const type = m[2].toLowerCase();
    out.push({
      formula: normalizeFormula(m[1]),
      // Keep the lowercased word even when it's outside the known set — the schema
      // type is a plain string at runtime, and dropping the damage would be worse.
      type: type as DamageType,
    });
  }
  return out.length ? out : undefined;
}

/** A recharge / x-per-day usage embedded in an action name, e.g. "Fire Breath (Recharge 5–6)". */
function parseRecharge(name: string): { recharge?: Recharge; cleanName: string } {
  const dice = /\(Recharge\s+(\d)(?:[–-]\d)?\)/i.exec(name);
  if (dice) {
    return {
      recharge: { type: "dice", value: Number(dice[1]) },
      cleanName: name.replace(dice[0], "").trim(),
    };
  }
  const perDay = /\((\d+)\s*\/\s*Day\)/i.exec(name);
  if (perDay) {
    return {
      recharge: { type: "perDay", value: Number(perDay[1]) },
      cleanName: name.replace(perDay[0], "").trim(),
    };
  }
  return { cleanName: name.trim() };
}

/** Parse an attack line, 2014 ("+4 to hit") or 2024 ("Attack Roll: +14"), into kind/toHit/reach/range. */
function parseAttack(text: string): {
  kind: ActionKind;
  toHit: number;
  reach?: number;
  range?: Range;
} | null {
  const toHit2024 = /(Melee or Ranged|Melee|Ranged)\s+Attack\s+Roll:\s*([+-]?\d+)/i.exec(text);
  const toHit2014 = /(Melee|Ranged)(?:\s+(?:Weapon|Spell))?\s+Attack:\s*([+-]?\d+)\s+to hit/i.exec(text);
  const m = toHit2024 ?? toHit2014;
  if (!m) return null;

  const toHit = Number(m[2]);
  const reachM = /reach\s+(\d+)\s*(?:ft|feet)/i.exec(text);
  const rangeM =
    /range\s+(\d+)\s*\/\s*(\d+)\s*(?:ft|feet)/i.exec(text) ??
    /range\s+(\d+)\s*(?:ft|feet)/i.exec(text);

  const reach = reachM ? Number(reachM[1]) : undefined;
  let range: Range | undefined;
  if (rangeM) {
    range = { normal: Number(rangeM[1]) };
    if (rangeM[2]) range.long = Number(rangeM[2]);
  }

  // "Melee or Ranged" and reach-only resolve to melee (the primary mode); range
  // without reach is a pure ranged attack.
  const kind: ActionKind = range && !reach ? "ranged" : "melee";
  return { kind, toHit, reach, range };
}

/** Parse a save line ("DC 13 Constitution saving throw", 2024 order too) into { ability, dc, onSave }. */
function parseSave(text: string): SaveRequirement | null {
  const m2024 = /([A-Za-z]+)\s+Saving\s+Throw:\s*DC\s+(\d+)/i.exec(text);
  const m2014 = /DC\s+(\d+)\s+([A-Za-z]+)\s+saving throw/i.exec(text);

  let ability: Ability | undefined;
  let dc: number | undefined;
  if (m2024) {
    ability = ABILITY_BY_NAME[m2024[1].toLowerCase()];
    dc = Number(m2024[2]);
  } else if (m2014) {
    dc = Number(m2014[1]);
    ability = ABILITY_BY_NAME[m2014[2].toLowerCase()];
  }
  if (!ability || dc == null) return null;

  const hasDamage = !!parseDamage(text);
  const onSave: SaveOutcome =
    /success:\s*half|half as much/i.test(text)
      ? "half"
      : hasDamage
        ? "none"
        : "negates";
  return { ability, dc, onSave };
}

// A usage-tier header inside a spellcasting block: "At Will:", "1/Day:", "2/Day Each:".
const TIER_NAME_RE = /^(at will|\d+\s*\/\s*day(?:\s+each)?)\s*:?$/i;
const TIER_MARKER_RE = /(at will|\d+\s*\/\s*day(?:\s+each)?)\s*:/gi;

// The real Spellcasting lead-in is named "Spellcasting", or its content *defines*
// the ability ("using Intelligence as the spellcasting ability" / "spellcasting
// ability is Intelligence"). An action that only *references* it ("…using the same
// spellcasting ability as Spellcasting" — Evocation Barrage, Protective Magic) must
// NOT match, or findIndex lands on it and the block never gets parsed.
const isSpellcastingLeadIn = (e: NameAndContent): boolean =>
  /spellcasting/i.test(e.Name) ||
  /using \w+ as the spellcasting ability/i.test(e.Content) ||
  /spellcasting ability is \w+/i.test(e.Content);

/** Spell hover-cards / cast mechanics resolve against OpenFray's bundled compendium,
 *  which ships both SRD 5.2 (2024) and SRD 5.1 (2014). Point a creature's spells at the
 *  library matching its edition so the lookup hits the right entry — a 5.0 creature's
 *  spells are 2014 spells. */
const spellRefSource = (edition: Edition): string =>
  edition === "5.0" ? "srd-5.1" : "srd-5.2";

// Words kept lowercase in a title-cased spell name ("Cone of Cold", "Wall of Force").
const MINOR_WORD = new Set(["of", "the", "and", "a", "an", "to", "in", "on", "or", "from", "with"]);

/** Title-case a spell name, keeping minor words ("of", "the") lowercase after the first word. */
function titleCaseSpell(name: string): string {
  return name
    .split(/\s+/)
    .map((w, i) =>
      i > 0 && MINOR_WORD.has(w.toLowerCase().replace(/[^a-z]/g, ""))
        ? w.toLowerCase()
        : w.charAt(0).toUpperCase() + w.slice(1),
    )
    .join(" ");
}

/** One spell reference from a raw list entry. The display name is title-cased (2014
 *  blocks list spells lowercase; 2024 already capitalized) and keeps any trailing "*"
 *  marker; the compendium ref slugs the de-asterisked name. */
function spellRef(raw: string, refSrc: string): SpellRef {
  const display = titleCaseSpell(
    raw.trim().replace(/\s*\([^)]*\)\s*$/, "").replace(/\.$/, "").trim(),
  );
  return {
    name: display,
    ref: `${refSrc}:${slugify(display.replace(/\*+$/, "").trim())}`,
  };
}

/** Map raw spell-name fragments to SpellRefs, dropping blanks. */
const toSpellRefs = (names: string[], refSrc: string): SpellRef[] =>
  names.map((n) => n.trim()).filter(Boolean).map((n) => spellRef(n, refSrc));

/** Split a "At Will: a, b 1/Day: c" blob into usage-grouped spells. Tolerates the
 *  tiers being run together by the scraper ("…Mage Hand, Message1/Day: Lightning Bolt"). */
function parseSpellGroups(blob: string, refSrc: string): SpellGroup[] {
  const groups: SpellGroup[] = [];
  const markers = [...blob.matchAll(TIER_MARKER_RE)];
  for (let i = 0; i < markers.length; i++) {
    const header = markers[i][1].toLowerCase();
    const start = markers[i].index! + markers[i][0].length;
    const end = i + 1 < markers.length ? markers[i + 1].index! : blob.length;
    const spells = toSpellRefs(blob.slice(start, end).split(","), refSrc);
    if (spells.length === 0) continue;

    let usage: SpellUsage;
    if (/at will/.test(header)) usage = { type: "atWill" };
    else {
      const per = /(\d+)\s*\/\s*day/.exec(header);
      usage = { type: "perDay", per: per ? Number(per[1]) : 1 };
    }
    groups.push({ usage, spells });
  }
  return groups;
}

/**
 * Lift a monster's spellcasting out of the scraped action list into a structured
 * block, and return the remaining (non-spellcasting) entries. The 2024 DDB layout
 * scrapes as a "Spellcasting" lead-in (ability + DC) followed by tier entries
 * ("At Will:", "N/Day:") — which the scraper sometimes merges into one. Mirrors
 * parseSpellcasting in the openfray-compendium mappers; OpenFray itself never
 * parses prose at runtime — only importers and ingest do.
 */
function extractSpellcasting(
  entries: NameAndContent[],
  refSrc: string,
): { spellcasting?: Spellcasting; rest: NameAndContent[] } {
  const idx = entries.findIndex(isSpellcastingLeadIn);
  if (idx < 0) return { rest: entries };

  const leadIn = entries[idx];
  const ability =
    ABILITY_BY_NAME[
      (/using (\w+) as the spellcasting ability/i.exec(leadIn.Content)?.[1] ??
        /spellcasting ability is (\w+)/i.exec(leadIn.Content)?.[1] ??
        "").toLowerCase()
    ];
  const saveDc = Number(/spell save DC (\d+)/i.exec(leadIn.Content)?.[1]) || undefined;
  const toHit = (() => {
    const m = /([+-]?\d+) to hit with spell/i.exec(leadIn.Content);
    return m ? Number(m[1]) : undefined;
  })();

  // Consume the tier entries that follow the lead-in (their spell lists may be
  // glued together in one entry's content; parseSpellGroups untangles that).
  const consumed = new Set<NameAndContent>([leadIn]);
  let blob = "";
  for (let j = idx + 1; j < entries.length; j++) {
    if (!TIER_NAME_RE.test(entries[j].Name.trim())) break;
    consumed.add(entries[j]);
    blob += ` ${entries[j].Name} ${entries[j].Content}`;
  }
  // Fallback: some layouts keep the whole list in the lead-in's own content.
  if (!blob.trim()) blob = leadIn.Content;

  const groups = parseSpellGroups(blob, refSrc);
  const rest = entries.filter((e) => !consumed.has(e));

  if (groups.length === 0 && !ability && saveDc == null) {
    return { rest: entries }; // not actually a spellcasting block
  }
  const spellcasting: Spellcasting = { groups };
  if (ability) spellcasting.ability = ability;
  if (saveDc != null) spellcasting.saveDc = saveDc;
  if (toHit != null) spellcasting.toHit = toHit;
  return { spellcasting, rest };
}

// 2014 prepared-caster slot lines: "1st level (4 slots): detect magic, identify, …".
const SLOT_LINE_RE = /(\d+)(?:st|nd|rd|th)\s+level\s*\(\s*(\d+)\s*slots?\s*\):\s*([^\n]+)/gi;
const CANTRIP_RE = /cantrips?\s*\(at will\):\s*([^\n]+)/i;
const AT_WILL_PHRASE_RE = /can (?:innately )?cast ([^.\n]+?) at will/i;

/**
 * Lift a 2014 spellcasting *trait* into a structured block. Two shapes:
 *  - **Prepared/slot casters** (Archmage): "Cantrips (at will): …", "Nth level (M slots): …".
 *    Cantrips + "can cast X at will" → an at-will group; each level → a `slots` group
 *    with the per-level counts in `slots`.
 *  - **Innate casters**: "At will: …", "N/Day Each: …" — same markers as 2024, so the
 *    shared `parseSpellGroups` handles them (at-will / per-day groups).
 * Returns the remaining (non-spellcasting) traits.
 */
function extractSpellcastingFromTraits(
  traits: NameAndContent[],
  refSrc: string,
): { spellcasting?: Spellcasting; rest: NameAndContent[] } {
  const idx = traits.findIndex(
    (t) =>
      /spellcasting/i.test(t.Name) &&
      /spellcasting ability|spell save dc|\(\d+ slots?\)|at will/i.test(t.Content),
  );
  if (idx < 0) return { rest: traits };

  const text = traits[idx].Content;
  const ability =
    ABILITY_BY_NAME[(/spellcasting ability is (\w+)/i.exec(text)?.[1] ?? "").toLowerCase()];
  const saveDc = Number(/spell save DC (\d+)/i.exec(text)?.[1]) || undefined;
  const toHit = (() => {
    const m = /([+-]?\d+) to hit with spell/i.exec(text);
    return m ? Number(m[1]) : undefined;
  })();

  const groups: SpellGroup[] = [];
  const slots: SpellSlots = {};

  if (/\(\s*\d+\s*slots?\s*\)/i.test(text)) {
    const atWill: SpellRef[] = [];
    const phrase = AT_WILL_PHRASE_RE.exec(text);
    if (phrase) atWill.push(...toSpellRefs(phrase[1].split(/,|\band\b/i), refSrc));
    const cantrips = CANTRIP_RE.exec(text);
    if (cantrips) atWill.push(...toSpellRefs(cantrips[1].split(","), refSrc));
    if (atWill.length) groups.push({ usage: { type: "atWill" }, spells: atWill });

    for (const m of text.matchAll(SLOT_LINE_RE)) {
      const level = Number(m[1]);
      const spells = toSpellRefs(m[3].split(","), refSrc);
      if (spells.length === 0) continue;
      groups.push({ usage: { type: "slots", level }, spells });
      slots[String(level) as SpellLevel] = Number(m[2]);
    }
  } else {
    groups.push(...parseSpellGroups(text, refSrc));
  }

  if (groups.length === 0 && !ability && saveDc == null) return { rest: traits };
  // Footnote lines ("*The archmage casts these spells on itself before combat.").
  const note = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("*"))
    .join(" ")
    .trim();

  const spellcasting: Spellcasting = { groups };
  if (ability) spellcasting.ability = ability;
  if (saveDc != null) spellcasting.saveDc = saveDc;
  if (toHit != null) spellcasting.toHit = toHit;
  if (Object.keys(slots).length) spellcasting.slots = slots;
  if (note) spellcasting.note = note;
  return { spellcasting, rest: traits.filter((_, i) => i !== idx) };
}

/** Convert one scraped power (Action/Reaction/Bonus/Legendary entry) into an Action. */
function toAction(entry: NameAndContent): Action {
  const { recharge, cleanName } = parseRecharge(entry.Name);
  const text = entry.Content?.trim() || undefined;
  const content = entry.Content ?? "";

  const action: Action = {
    id: slugify(cleanName) || slugify(entry.Name),
    name: cleanName,
    kind: "utility",
    toHit: null,
  };
  if (recharge) action.recharge = recharge;
  if (text) action.text = text;

  const attack = parseAttack(content);
  if (attack) {
    action.kind = attack.kind;
    action.toHit = attack.toHit;
    if (attack.reach != null) action.reach = attack.reach;
    if (attack.range) action.range = attack.range;
    const damage = parseDamage(content);
    if (damage) action.damage = damage;
    return action;
  }

  const save = parseSave(content);
  if (save) {
    action.kind = "save";
    action.save = save;
    const damage = parseDamage(content);
    if (damage) action.damage = damage;
    return action;
  }

  // No attack, no save: keep auto / area damage rollable; otherwise prose-only.
  const damage = parseDamage(content);
  if (damage) action.damage = damage;
  return action;
}

/** Convert the named entries to Actions; nameless intro paragraphs are dropped. */
const namedActions = (entries: NameAndContent[] | undefined): Action[] =>
  (entries ?? []).filter((e) => e.Name.trim()).map(toAction);

// A legendary action can cost more than one of the round's budget. DDB writes the
// cost in the action name ("Ice Trick (Costs 2 Actions)") or, when the name is split
// across two <strong>s, at the head of the body ("Misty Step" + "(Costs 2 Actions).").
const LEGENDARY_COST_RE = /\(Costs?\s+(\d+)\s+Actions?\)\.?/i;

/** Assemble LegendaryActions with per-action costs and the per-round budget from the intro (default 3). */
function buildLegendary(
  entries: NameAndContent[] | undefined,
): LegendaryActions | undefined {
  const all = entries ?? [];
  const actions = all
    .filter((e) => e.Name.trim())
    .map((entry) => {
      const cost =
        LEGENDARY_COST_RE.exec(entry.Name) ?? LEGENDARY_COST_RE.exec(entry.Content ?? "");
      const action = toAction({
        Name: entry.Name.replace(LEGENDARY_COST_RE, "").trim(),
        Content: (entry.Content ?? "").replace(LEGENDARY_COST_RE, "").trim(),
      });
      if (cost) action.legendaryCost = Number(cost[1]);
      return action;
    });
  if (actions.length === 0) return undefined;
  // The intro paragraph ("can take 3 legendary actions") carries the per-round
  // budget; when the page words it differently, 3 is the 5e default.
  const perRound =
    Number(/take\s+(\d+)\s+legendary action/i.exec(all.map((e) => e.Content).join(" "))?.[1]) || 3;
  return { perRound, actions };
}

export interface ConvertOptions {
  /** Overrides the 2024-vs-2014 edition heuristic. */
  edition?: Edition;
}

/** Convert a scraped StatBlock into an OpenFray Creature (edition inferred unless overridden). */
export function statBlockToCreature(sb: StatBlock, opts: ConvertOptions = {}): Creature {
  const { size, type, alignment } = parseSizeTypeAlignment(sb.Type);
  const abilities: AbilityScores = {
    str: sb.Abilities.Str,
    dex: sb.Abilities.Dex,
    con: sb.Abilities.Con,
    int: sb.Abilities.Int,
    wis: sb.Abilities.Wis,
    cha: sb.Abilities.Cha,
  };

  // The scraper records which DDB layout it read, and that is the edition tell.
  // Blocks built without a Layout (older callers, test fixtures) fall back to the
  // 2024-only Initiative line, whose recorded value is the listed total minus Dex.
  const is2024 =
    sb.Layout === "2024" || (sb.Layout == null && sb.InitiativeModifier != null);
  const edition: Edition = opts.edition ?? (is2024 ? "5.5" : "5.0");

  const creature: Creature = {
    // `custom:` namespace so OpenFray treats it as editable user content (its
    // Custom badge / Edit / Delete key off this prefix). Source = the scraped book +
    // page ("Monster Manual (2024), pg. 12") plus a provenance marker.
    id: `custom:${slugify(sb.Name)}`,
    source: importSource(sb.Source),
    edition,
    name: sb.Name,
    size,
    type,
    ac: sb.AC.Value,
    maxHp: sb.HP.Value,
    speed: parseSpeeds(sb.Speed),
    abilities,
    senses: parseSenses(sb.Senses),
  };

  if (alignment) creature.alignment = alignment;
  // DDB flavor text (option-gated at scrape time). OpenFray keeps it display-only;
  // SRD creatures have none, so this is import/custom lore only.
  if (sb.Description?.trim()) creature.description = sb.Description.trim();
  const hpFormula = parseHpFormula(sb.HP.Notes);
  if (hpFormula) creature.hpFormula = hpFormula;
  // Finite, not just non-null: a NaN would reach the emitted JSON as null.
  if (sb.InitiativeModifier != null && Number.isFinite(sb.InitiativeModifier)) {
    creature.initiative = sb.InitiativeModifier + abilityMod(abilities.dex);
  }

  const saves = parseSaves(sb.Saves);
  if (saves) creature.saves = saves;
  const skills = parseSkills(sb.Skills);
  if (skills) creature.skills = skills;

  creature.languages = cleanList(sb.Languages);
  creature.resistances = cleanList(sb.DamageResistances);
  creature.immunities = cleanList(sb.DamageImmunities);
  creature.vulnerabilities = cleanList(sb.DamageVulnerabilities);
  creature.conditionImmunities = cleanList(sb.ConditionImmunities);
  // The 2024 Gear line ("Chain Mail, Shield"). OpenFray keeps it display-only — the
  // console doesn't model equipment — so the entries travel as DDB wrote them.
  creature.gear = cleanList(sb.Gear);

  const cr = parseCr(sb.Challenge);
  if (cr != null) creature.cr = cr;
  if (sb.Xp != null) creature.xp = sb.Xp;

  // Spellcasting lives in a trait (2014) or an action (2024); lift whichever exists
  // into a structured block and drop it from the rendered traits/actions.
  const refSrc = spellRefSource(edition);
  const { spellcasting: traitSpellcasting, rest: restTraits } =
    extractSpellcastingFromTraits(sb.Traits ?? [], refSrc);
  const traits: Trait[] = restTraits
    .filter((t) => t.Name.trim())
    .map((t) => ({ name: t.Name.trim(), text: t.Content.trim() }));
  if (traits.length) creature.traits = traits;

  const { spellcasting: actionSpellcasting, rest } = extractSpellcasting(sb.Actions ?? [], refSrc);
  const actions = namedActions(rest);
  if (actions.length) creature.actions = actions;
  const spellcasting = actionSpellcasting ?? traitSpellcasting;
  if (spellcasting) creature.spellcasting = spellcasting;
  const bonus = namedActions(sb.BonusActions);
  if (bonus.length) creature.bonusActions = bonus;
  const reactions = namedActions(sb.Reactions);
  if (reactions.length) creature.reactions = reactions;
  const legendary = buildLegendary(sb.LegendaryActions);
  if (legendary) creature.legendaryActions = legendary;

  // Legendary Resistance is a trait on DDB; surface its per-day count(s).
  const lr = traits.find((t) => /^Legendary Resistance/i.test(t.name));
  if (lr) {
    const lrText = `${lr.name} ${lr.text}`;
    const base = Number(/\((\d+)\s*\/\s*day/i.exec(lrText)?.[1]);
    if (Number.isFinite(base)) creature.legendaryResistance = base;
    const lair = Number(/(\d+)\s*\/\s*day\s+in\s+lair/i.exec(lrText)?.[1]);
    if (Number.isFinite(lair)) creature.legendaryResistanceLair = lair;
  }

  return creature;
}
