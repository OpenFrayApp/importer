import { test } from "node:test";
import assert from "node:assert/strict";
import { Window } from "happy-dom";
import type { AllOptions } from "../utils/options.ts";

// cash-dom and extractStatBlock both read the document global, so the happy-dom
// window must exist before the parser graph is imported below.
const win = new Window({ url: "https://www.dndbeyond.com/monsters/17033-young-red-dragon" });
Object.assign(globalThis, { window: win, document: win.document });

const { extractStatBlock } = await import("../utils/extractstatblock.ts");
const { Options } = await import("../utils/options.ts");

// The 2024 branch logs debug objects on every parse; keep the test output readable.
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

/** A 2014 attribute row: label with the value/extra wrapper beside it. */
function attribute(label: string, value: string, extra = "") {
  return `<div class="mon-stat-block__attribute">
    <span class="mon-stat-block__attribute-label">${label}</span>
    <span class="mon-stat-block__attribute-value">
      <span class="mon-stat-block__attribute-data-value">${value}</span>
      ${extra ? `<span class="mon-stat-block__attribute-data-extra">${extra}</span>` : ""}
    </span>
  </div>`;
}

/** A 2014 tidbit row: label and data as siblings. */
function tidbit(label: string, data: string) {
  return `<div class="mon-stat-block__tidbit">
    <span class="mon-stat-block__tidbit-label">${label}</span>
    <span class="mon-stat-block__tidbit-data">${data}</span>
  </div>`;
}

/** The six 2014 ability blocks from a Str-to-Cha score list. */
function abilityBlocks(scores: { [ability: string]: number }) {
  return Object.entries(scores)
    .map(
      ([ability, score]) => `<div class="ability-block__stat ability-block__stat--${ability}">
        <span class="ability-block__score">${score}</span>
      </div>`,
    )
    .join("");
}

/** A 2014 description block; heading omitted for the leading traits block. */
function section(heading: string, content: string) {
  return `<div class="mon-stat-block__description-block">
    ${heading ? `<div class="mon-stat-block__description-block-heading">${heading}</div>` : ""}
    <div class="mon-stat-block__description-block-content">${content}</div>
  </div>`;
}

/** Parse `inner` wrapped in the 2014 stat-block root, plus any page furniture. */
function parse(inner: string, options = opts(), pageExtras = "") {
  document.body.innerHTML = `${pageExtras}<div class="mon-stat-block">${inner}</div>`;
  return extractStatBlock(options);
}

test("2014 identity and attributes: source, name, type line, AC and HP notes, speeds, abilities", () => {
  const block = parse(
    `<div class="mon-stat-block__name"><a href="/monsters/17033">Young Red Dragon</a></div>
     <div class="mon-stat-block__meta">Large dragon, chaotic evil</div>
     ${attribute("Armor Class", "18", "(Natural Armor)")}
     ${attribute("Hit Points", "178", "(17d10 + 85)")}
     ${attribute("Speed", "40 ft., climb 40 ft., fly 80 ft.")}
     ${abilityBlocks({ str: 23, dex: 10, con: 21, int: 14, wis: 11, cha: 19 })}`,
    opts(),
    `<p class="monster-source">Monster Manual
       , pg. 98</p>
     <div class="details-aside"><div class="image"><a href="https://example.invalid/young-dragon.png">img</a></div></div>`,
  );

  assert.ok(block);
  assert.equal(block.Name, "Young Red Dragon");
  assert.equal(block.Type, "Large dragon, chaotic evil");
  assert.equal(block.Source, "Monster Manual, pg. 98");
  assert.deepEqual(block.AC, { Value: 18, Notes: "(Natural Armor)" });
  assert.deepEqual(block.HP, { Value: 178, Notes: "(17d10 + 85)" });
  assert.deepEqual(block.Speed, ["40 ft.", "climb 40 ft.", "fly 80 ft."]);
  assert.deepEqual(block.Abilities, { Str: 23, Dex: 10, Con: 21, Int: 14, Wis: 11, Cha: 19 });
  assert.equal(block.InitiativeModifier, undefined);
  assert.equal(block.ImageURL, "https://example.invalid/young-dragon.png");
});

test("2014 tidbits: saves, skills, immunities, senses, languages, challenge and XP", () => {
  const block = parse(
    `${tidbit("Saving Throws", "DEX +4, CON +9, WIS +4, CHA +8")}
     ${tidbit("Skills", "Perception +8, Stealth +4")}
     ${tidbit("Damage Immunities", "Fire")}
     ${tidbit("Condition Immunities", "Charmed, Frightened")}
     ${tidbit("Senses", "Blindsight 30 ft., Darkvision 120 ft., Passive Perception 18")}
     ${tidbit("Languages", "Common, Draconic")}
     ${tidbit("Challenge", "10 (5,900 XP)")}`,
  );

  assert.ok(block);
  assert.deepEqual(block.Saves, [
    { Name: "DEX", Modifier: 4 },
    { Name: "CON", Modifier: 9 },
    { Name: "WIS", Modifier: 4 },
    { Name: "CHA", Modifier: 8 },
  ]);
  assert.deepEqual(block.Skills, [
    { Name: "Perception", Modifier: 8 },
    { Name: "Stealth", Modifier: 4 },
  ]);
  assert.deepEqual(block.DamageImmunities, ["Fire"]);
  assert.deepEqual(block.ConditionImmunities, ["Charmed", "Frightened"]);
  assert.deepEqual(block.Senses, ["Blindsight 30 ft.", "Darkvision 120 ft.", "Passive Perception 18"]);
  assert.deepEqual(block.Languages, ["Common", "Draconic"]);
  assert.equal(block.Challenge, "10");
  assert.equal(block.Xp, 5900);

  const fraction = parse(tidbit("Challenge", "1/4 (50 XP)"));
  assert.equal(fraction?.Challenge, "1/4");
  assert.equal(fraction?.Xp, 50);
});

test("the Bludgeoning, Piercing, and Slashing phrase survives the comma split", () => {
  const plain = parse(tidbit("Damage Resistances", "Bludgeoning, Piercing, and Slashing from Nonmagical Attacks"));
  assert.deepEqual(plain?.DamageResistances, ["Bludgeoning, Piercing, and Slashing from Nonmagical Attacks"]);

  const mixed = parse(tidbit("Damage Resistances", "Cold; Bludgeoning, Piercing, and Slashing from Nonmagical Attacks"));
  assert.deepEqual(mixed?.DamageResistances, ["Cold", "Bludgeoning, Piercing, and Slashing from Nonmagical Attacks"]);
});

test("2014 powers: heading-less traits, actions with recharge names, follow-on paragraphs collapsed", () => {
  const block = parse(
    section(
      "",
      `<p><strong>Amphibious.</strong> The dragon can breathe air and water.</p>
       <p>It can hold its breath indefinitely.</p>`,
    ) +
      section(
        "Actions",
        `<p><strong>Bite.</strong> <em>Melee Weapon Attack:</em> +10 to hit, reach 10 ft., one target. <em>Hit:</em> 17 (2d10 + 6) piercing damage plus 3 (1d6) fire damage.</p>
         <p><strong>Fire Breath (Recharge 5–6).</strong> The dragon exhales fire in a 30-foot cone. Each creature in that area must make a DC 17 Dexterity saving throw, taking 56 (16d6) fire damage on a failed save, or half as much damage on a successful one.</p>`,
      ),
  );

  assert.ok(block);
  assert.deepEqual(block.Traits, [
    {
      Name: "Amphibious",
      Content: "The dragon can breathe air and water.\n\nIt can hold its breath indefinitely.",
    },
  ]);
  assert.deepEqual(block.Actions.map((a) => a.Name), ["Bite", "Fire Breath (Recharge 5–6)"]);
  assert.equal(
    block.Actions[0].Content,
    "Melee Weapon Attack: +10 to hit, reach 10 ft., one target. Hit: 17 (2d10 + 6) piercing damage plus 3 (1d6) fire damage.",
  );
  assert.deepEqual(block.Reactions, []);
  assert.deepEqual(block.BonusActions, []);
});

test("legendary actions inside a nested content wrapper still parse, and stay out of traits", () => {
  // Partnered and homebrew pages wrap a section's paragraphs in a second nested
  // description-block-content div; the section filter must not lose them.
  const block = parse(
    section("", "<p><strong>Legendary Resistance (3/Day).</strong> The dragon can choose to succeed instead.</p>") +
      section(
        "Legendary Actions",
        `<div class="mon-stat-block__description-block-content">
           <p>The dragon can take 3 legendary actions, choosing from the options below.</p>
           <p><strong>Detect.</strong> The dragon makes a Wisdom (Perception) check.</p>
         </div>`,
      ),
  );

  assert.ok(block);
  assert.deepEqual(block.LegendaryActions, [
    { Name: "", Content: "The dragon can take 3 legendary actions, choosing from the options below." },
    { Name: "Detect", Content: "The dragon makes a Wisdom (Perception) check." },
  ]);
  assert.deepEqual(block.Traits.map((t) => t.Name), ["Legendary Resistance (3/Day)"]);
});

test("2014 options: page-number, description, and link toggles shape source and description", () => {
  const page = `<p class="monster-source">Monster Manual , pg. 98</p>
    <div class="mon-details__description-block-content"><h2>Habitat</h2><p>A young tyrant.</p></div>`;

  const allOn = parse("", opts(), page);
  assert.equal(allOn?.Source, "Monster Manual, pg. 98");
  assert.equal(
    allOn?.Description,
    "## Habitat\n\nA young tyrant.\n\n[See this creature on DDB.](https://www.dndbeyond.com/monsters/17033-young-red-dragon)",
  );

  const bare = parse(
    "",
    opts({
      [Options.IncludePageNumberWithSource]: "off",
      [Options.IncludeDescription]: "off",
      [Options.IncludeLink]: "off",
    }),
    page,
  );
  assert.equal(bare?.Source, "Monster Manual");
  assert.equal(bare?.Description, "");
});

test("dispatch: a 2024 layout goes to the 2024 parser, and no stat block returns null", () => {
  document.body.innerHTML = `<div class="mon-stat-block-2024">
    <a class="mon-stat-block-2024__name-link" href="/monsters/5194">Adult Red Dragon</a>
    <table class="mon-stat-block-2024__stats"><tbody>
      <tr><th>Dex</th><td>10</td><td>+0</td><td>+0</td></tr>
    </tbody></table>
    <div class="mon-stat-block-2024__attribute">
      <span class="mon-stat-block-2024__attribute-label">Initiative</span>
      <span class="mon-stat-block-2024__attribute-data-value">+10</span>
    </div>
  </div>`;
  const block2024 = extractStatBlock(opts());
  assert.equal(block2024?.Name, "Adult Red Dragon");
  assert.equal(block2024?.InitiativeModifier, 10);

  document.body.innerHTML = "<p>No monster here.</p>";
  assert.equal(extractStatBlock(opts()), null);
});
