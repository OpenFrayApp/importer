import { test } from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { Window } from "happy-dom";
import type { AllOptions } from "../utils/options.ts";

// The utils modules are written for WXT's bundler, so plain Node needs three
// bridges: extensionless relative imports get ".ts" appended, "cash-dom" is
// pointed at its ESM build (the CJS main exports no `Cash` name), and the
// type-only names the parsers value-import (AllOptions, the statblock
// interfaces) get runtime stand-ins appended to their modules.
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "cash-dom") return next("cash-dom/dist/cash.esm.js", context);
    try {
      return next(specifier, context);
    } catch (error) {
      if (specifier.startsWith(".")) return next(`${specifier}.ts`, context);
      throw error;
    }
  },
  load(url, context, next) {
    const result = next(url, context);
    const patch = url.endsWith("/utils/options.ts")
      ? "\nexport const AllOptions = undefined;"
      : url.endsWith("/utils/statblock.ts")
        ? "\nexport const StatBlock = undefined, AbilityScores = undefined, NameAndContent = undefined, NameAndModifier = undefined;"
        : "";
    return patch ? { ...result, source: `${result.source}${patch}` } : result;
  },
});

// cash-dom captures document/window at module load, so the happy-dom globals
// must exist before the parser graph is imported below.
const win = new Window({ url: "https://www.dndbeyond.com/monsters/5194-adult-red-dragon" });
Object.assign(globalThis, { window: win, document: win.document });

const cash = (await import("cash-dom")).default;
const { get2024StatBlock } = await import("../utils/get2024statblock.ts");
const { Options } = await import("../utils/options.ts");

// The parser logs debug objects on every parse; keep the test output readable.
console.log = () => {};

/** All three import options, "on" unless overridden. */
function opts(overrides: Partial<AllOptions> = {}): AllOptions {
  return {
    [Options.IncludePageNumberWithSource]: "on",
    [Options.IncludeDescription]: "on",
    [Options.IncludeLink]: "on",
    ...overrides,
  };
}

/** A 2024 attribute row: label with its value/extra wrapper as the next sibling. */
function attribute(label: string, value: string, extra = "") {
  return `<div class="mon-stat-block-2024__attribute">
    <span class="mon-stat-block-2024__attribute-label">${label}</span>
    <span class="mon-stat-block-2024__attribute-data">
      <span class="mon-stat-block-2024__attribute-data-value">${value}</span>
      ${extra ? `<span class="mon-stat-block-2024__attribute-data-extra">${extra}</span>` : ""}
    </span>
  </div>`;
}

/** A 2024 tidbit row: label and data as siblings. */
function tidbit(label: string, data: string) {
  return `<div class="mon-stat-block-2024__tidbit">
    <span class="mon-stat-block-2024__tidbit-label">${label}</span>
    <span class="mon-stat-block-2024__tidbit-data">${data}</span>
  </div>`;
}

/** The 2024 ability table from [ability, score, modifier, save] rows. */
function statsTable(rows: [string, number, string, string][]) {
  const body = rows
    .map(([name, score, mod, save]) => `<tr><th>${name}</th><td>${score}</td><td>${mod}</td><td>${save}</td></tr>`)
    .join("");
  return `<table class="mon-stat-block-2024__stats"><tbody>${body}</tbody></table>`;
}

/** A 2024 description block; pass an empty heading for a heading-less block. */
function section(heading: string, paragraphs: string[]) {
  return `<div class="mon-stat-block-2024__description-block">
    ${heading ? `<div class="mon-stat-block-2024__description-block-heading">${heading}</div>` : ""}
    <div class="mon-stat-block-2024__description-block-content">${paragraphs.join("")}</div>
  </div>`;
}

/** Parse `inner` wrapped in the 2024 stat-block root, invoked as extractStatBlock does. */
function parse(inner: string, options = opts(), pageExtras = "") {
  document.body.innerHTML = `${pageExtras}<div class="mon-stat-block-2024">${inner}</div>`;
  const doc = cash(document);
  return get2024StatBlock(options, doc, doc.find(".mon-stat-block-2024"));
}

const DRAGON_STATS = statsTable([
  ["Str", 27, "+8", "+8"],
  ["Dex", 10, "+0", "+6"],
  ["Con", 25, "+7", "+13"],
  ["Int", 16, "+3", "+3"],
  ["Wis", 13, "+1", "+7"],
  ["Cha", 23, "+6", "+12"],
]);

test("identity and attribute lines: name, type line, source, AC, HP with formula, speeds", () => {
  const block = parse(
    `<a class="mon-stat-block-2024__name-link" href="/monsters/5194">Adult Red Dragon</a>
     <div class="mon-stat-block-2024__meta">Huge Dragon, Chaotic Evil</div>
     ${attribute("AC", "19")}
     ${attribute("HP", "256", "(19d12 + 133)")}
     ${attribute("Speed", "40 ft., Climb 40 ft., Fly 80 ft.")}`,
    opts(),
    `<p class="monster-source">Monster Manual
       , pg. 42</p>
     <div class="details-aside"><div class="image"><a href="https://example.invalid/dragon.png">img</a></div></div>`,
  );

  assert.equal(block.Name, "Adult Red Dragon");
  assert.equal(block.Type, "Huge Dragon, Chaotic Evil");
  assert.equal(block.Source, "Monster Manual, pg. 42");
  assert.deepEqual(block.AC, { Value: 19, Notes: "" });
  assert.deepEqual(block.HP, { Value: 256, Notes: "(19d12 + 133)" });
  assert.deepEqual(block.Speed, ["40 ft.", "Climb 40 ft.", "Fly 80 ft."]);
  assert.equal(block.ImageURL, "https://example.invalid/dragon.png");
});

test("initiative modifier: the listed bonus minus the Dex modifier", () => {
  const withDex16 = parse(
    `${attribute("Initiative", "+7", "(17)")}
     ${statsTable([["Dex", 16, "+3", "+3"]])}`,
  );
  assert.equal(withDex16.InitiativeModifier, 4);

  const withDex10 = parse(
    `${attribute("Initiative", "+10", "(20)")}
     ${statsTable([["Dex", 10, "+0", "+0"]])}`,
  );
  assert.equal(withDex10.InitiativeModifier, 10);
});

test("ability table: all six scores, saves only where the save differs from the modifier", () => {
  const block = parse(DRAGON_STATS);

  assert.deepEqual(block.Abilities, { Str: 27, Dex: 10, Con: 25, Int: 16, Wis: 13, Cha: 23 });
  assert.deepEqual(block.Saves, [
    { Name: "Dex", Modifier: 6 },
    { Name: "Con", Modifier: 13 },
    { Name: "Wis", Modifier: 7 },
    { Name: "Cha", Modifier: 12 },
  ]);
});

test("tidbit lists: skills, resistances, vulnerabilities, senses, languages, CR and XP", () => {
  const block = parse(
    `${tidbit("Skills", "Perception +13, Stealth +6")}
     ${tidbit("Resistances", "Cold, Necrotic")}
     ${tidbit("Vulnerabilities", "Thunder")}
     ${tidbit("Senses", "Blindsight 60 ft., Darkvision 120 ft.; Passive Perception 23")}
     ${tidbit("Languages", "Common, Draconic")}
     ${tidbit("CR", "17 (XP 18,000; PB +6)")}`,
  );

  assert.deepEqual(block.Skills, [
    { Name: "Perception", Modifier: 13 },
    { Name: "Stealth", Modifier: 6 },
  ]);
  assert.deepEqual(block.DamageResistances, ["Cold", "Necrotic"]);
  assert.deepEqual(block.DamageVulnerabilities, ["Thunder"]);
  // A semicolon switches the splitter, so the comma-joined senses stay merged.
  assert.deepEqual(block.Senses, ["Blindsight 60 ft., Darkvision 120 ft.", "Passive Perception 23"]);
  assert.deepEqual(block.Languages, ["Common", "Draconic"]);
  assert.equal(block.Challenge, "17");
  assert.equal(block.Xp, 18000);

  const mute = parse(tidbit("Languages", "--"));
  assert.deepEqual(mute.Languages, []);

  const fraction = parse(tidbit("CR", "1/8 (XP 25; PB +2)"));
  assert.equal(fraction.Challenge, "1/8");
  assert.equal(fraction.Xp, 25);
});

test("immunities: semicolon splits damage from condition, tooltips mark condition-only, plain lists are damage", () => {
  const both = parse(tidbit("Immunities", "Fire; Frightened, Poisoned"));
  assert.deepEqual(both.DamageImmunities, ["Fire"]);
  assert.deepEqual(both.ConditionImmunities, ["Frightened", "Poisoned"]);

  const conditionOnly = parse(
    tidbit("Immunities", '<a class="condition-tooltip">Charmed</a>, <a class="condition-tooltip">Exhaustion</a>'),
  );
  assert.deepEqual(conditionOnly.DamageImmunities, []);
  assert.deepEqual(conditionOnly.ConditionImmunities, ["Charmed", "Exhaustion"]);

  const damageOnly = parse(tidbit("Immunities", "Cold, Necrotic"));
  assert.deepEqual(damageOnly.DamageImmunities, ["Cold", "Necrotic"]);
  assert.deepEqual(damageOnly.ConditionImmunities, []);
});

test("powers: traits vs actions split, recharge kept in the name, follow-on paragraphs collapsed", () => {
  const block = parse(
    section("Traits", [
      "<p><strong>Legendary Resistance</strong> (3/Day, or 4/Day in Lair). If the dragon fails a saving throw, it can choose to succeed instead.</p>",
      "<p><strong>Amphibious.</strong> The dragon can breathe air and water.</p>",
      "<p>It can hold its breath indefinitely.</p>",
    ]) +
      section("Actions", [
        "<p><strong>Multiattack.</strong> The dragon makes three Rend attacks.</p>",
        "<p><strong>Rend.</strong> <em>Melee Attack Roll:</em> +14, reach 10 ft. <em>Hit:</em> 19 (2d10 + 8) Slashing damage plus 7 (2d6) Fire damage.</p>",
        "<p><strong>Fire Breath (Recharge 5–6).</strong> <em>Dexterity Saving Throw:</em> DC 21, each creature in a 90-foot Cone. <em>Failure:</em> 91 (26d6) Fire damage. <em>Success:</em> Half damage.</p>",
      ]),
  );

  assert.deepEqual(block.Traits, [
    {
      Name: "Legendary Resistance",
      Content: "(3/Day, or 4/Day in Lair). If the dragon fails a saving throw, it can choose to succeed instead.",
    },
    {
      Name: "Amphibious",
      Content: "The dragon can breathe air and water.\n\nIt can hold its breath indefinitely.",
    },
  ]);

  assert.deepEqual(block.Actions.map((a) => a.Name), ["Multiattack", "Rend", "Fire Breath (Recharge 5–6)"]);
  assert.equal(
    block.Actions[1].Content,
    "Melee Attack Roll: +14, reach 10 ft. Hit: 19 (2d10 + 8) Slashing damage plus 7 (2d6) Fire damage.",
  );
  assert.equal(
    block.Actions[2].Content,
    "Dexterity Saving Throw: DC 21, each creature in a 90-foot Cone. Failure: 91 (26d6) Fire damage. Success: Half damage.",
  );

  assert.deepEqual(block.Reactions, []);
  assert.deepEqual(block.BonusActions, []);
  assert.deepEqual(block.MythicActions, []);
});

test("a heading-less description block is filed under traits", () => {
  const block = parse(
    section("", ["<p><strong>Pack Tactics.</strong> The wolf has Advantage on attack rolls near an ally.</p>"]) +
      section("Actions", ["<p><strong>Bite.</strong> <em>Melee Attack Roll:</em> +4. <em>Hit:</em> 5 (1d6 + 2) Piercing damage.</p>"]),
  );

  assert.deepEqual(block.Traits.map((t) => t.Name), ["Pack Tactics"]);
  assert.deepEqual(block.Actions.map((a) => a.Name), ["Bite"]);
});

test("legendary actions: the heading-less intro paragraph rides along as a nameless entry", () => {
  const block = parse(
    section("Legendary Actions", [
      "<p>The dragon can take 3 legendary actions, choosing from the options below.</p>",
      "<p><strong>Tail Swipe.</strong> The dragon makes one Rend attack.</p>",
      "<p><strong>Fiery Rays (Costs 2 Actions).</strong> The dragon uses Scorching Ray.</p>",
    ]),
  );

  assert.deepEqual(block.LegendaryActions, [
    { Name: "", Content: "The dragon can take 3 legendary actions, choosing from the options below." },
    { Name: "Tail Swipe", Content: "The dragon makes one Rend attack." },
    { Name: "Fiery Rays (Costs 2 Actions)", Content: "The dragon uses Scorching Ray." },
  ]);
});

test("spellcasting block: only the first strong is the name, so a second usage tier merges into the content", () => {
  const block = parse(
    section("Actions", [
      "<p><strong>Spellcasting.</strong> The aarakocra casts one of the following spells, using Wisdom as the spellcasting ability (spell save DC 13):</p>",
      "<p><strong>At Will:</strong> Elementalism, Gust of Wind, Mage Hand, Message<strong>1/Day:</strong> Lightning Bolt</p>",
    ]),
  );

  assert.deepEqual(block.Actions, [
    {
      Name: "Spellcasting",
      Content: "The aarakocra casts one of the following spells, using Wisdom as the spellcasting ability (spell save DC 13):",
    },
    {
      Name: "At Will:",
      Content: "Elementalism, Gust of Wind, Mage Hand, Message1/Day: Lightning Bolt",
    },
  ]);
});

test("options: page-number, description, and link toggles shape source and description", () => {
  const page = `<p class="monster-source">Monster Manual , pg. 42</p>
    <div class="mon-details__description-block-content"><h2>Habitat</h2><p>Fire-breathing tyrant.</p></div>`;

  const allOn = parse("", opts(), page);
  assert.equal(allOn.Source, "Monster Manual, pg. 42");
  assert.equal(
    allOn.Description,
    "## Habitat\n\nFire-breathing tyrant.\n\n[See this creature on DDB.](https://www.dndbeyond.com/monsters/5194-adult-red-dragon)",
  );

  const noLink = parse("", opts({ [Options.IncludeLink]: "off" }), page);
  assert.equal(noLink.Description, "## Habitat\n\nFire-breathing tyrant.");

  const bare = parse(
    "",
    opts({
      [Options.IncludePageNumberWithSource]: "off",
      [Options.IncludeDescription]: "off",
      [Options.IncludeLink]: "off",
    }),
    page,
  );
  assert.equal(bare.Source, "Monster Manual");
  assert.equal(bare.Description, "");
});

test("an empty stat block degrades to empty lists, CR 0, and NaN numerics", () => {
  const block = parse("", opts({ [Options.IncludeDescription]: "off", [Options.IncludeLink]: "off" }));

  assert.equal(block.Name, "");
  assert.equal(block.Challenge, "0");
  assert.equal(block.Xp, undefined);
  assert.deepEqual(block.Speed, []);
  assert.deepEqual(block.Saves, []);
  assert.deepEqual(block.Skills, []);
  assert.deepEqual(block.Traits, []);
  assert.deepEqual(block.Actions, []);
  assert.equal(block.ImageURL, "");
  assert.equal(block.Description, "");
  // parseInt never throws, so the score fallback of 10 never engages; a change
  // away from NaN here should be a deliberate one.
  assert.ok(Number.isNaN(block.Abilities.Str));
  assert.ok(Number.isNaN(block.AC.Value));
  assert.ok(Number.isNaN(block.InitiativeModifier));
});
