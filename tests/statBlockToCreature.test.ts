import { test } from "node:test";
import assert from "node:assert/strict";
import { statBlockToCreature } from "../utils/statBlockToCreature.ts";

// Minimal StatBlock factory — only the fields under test, the rest empty.
function statBlock(overrides: any) {
  return {
    Name: "",
    Source: "",
    Type: "",
    HP: { Value: 0, Notes: "" },
    AC: { Value: 0, Notes: "" },
    Speed: [],
    Abilities: { Str: 10, Dex: 10, Con: 10, Int: 10, Wis: 10, Cha: 10 },
    DamageVulnerabilities: [],
    DamageResistances: [],
    DamageImmunities: [],
    ConditionImmunities: [],
    Saves: [],
    Skills: [],
    Senses: [],
    Languages: [],
    Challenge: "0",
    Traits: [],
    Actions: [],
    Reactions: [],
    LegendaryActions: [],
    BonusActions: [],
    MythicActions: [],
    Description: "",
    Player: "",
    ImageURL: "",
    ...overrides,
  };
}

test("2024 statblock: identity, defenses, senses, edition, initiative", () => {
  const c = statBlockToCreature(
    statBlock({
      Name: "Adult Red Dragon",
      Source: "Monster Manual (2024), pg. 10",
      Xp: 18000,
      Type: "Huge Dragon, Chaotic Evil",
      HP: { Value: 256, Notes: "(19d12 + 133)" },
      AC: { Value: 19, Notes: "" },
      Speed: ["40 ft.", "Climb 40 ft.", "Fly 80 ft."],
      Abilities: { Str: 27, Dex: 10, Con: 25, Int: 16, Wis: 13, Cha: 23 },
      InitiativeModifier: 10, // listed +10, Dex mod 0 → recorded 10
      Saves: [
        { Name: "Dex", Modifier: 6 },
        { Name: "Con", Modifier: 13 },
        { Name: "Wis", Modifier: 7 },
        { Name: "Cha", Modifier: 12 },
      ],
      Skills: [
        { Name: "Perception", Modifier: 13 },
        { Name: "Stealth", Modifier: 6 },
      ],
      Senses: ["Blindsight 60 ft.", "Darkvision 120 ft.", "Passive Perception 23"],
      Languages: ["Common", "Draconic"],
      DamageImmunities: ["Fire"],
      Challenge: "17",
      Description: "The biggest, vainest, and most covetous of the true dragons.",
    }),
  );

  assert.equal(c.id, "custom:adult-red-dragon");
  assert.equal(c.description, "The biggest, vainest, and most covetous of the true dragons.");
  assert.equal(c.source, "Monster Manual (2024), pg. 10 - Manual import");
  assert.equal(c.xp, 18000);
  assert.equal(c.edition, "5.5");
  assert.equal(c.size, "Huge");
  assert.equal(c.type, "dragon");
  assert.equal(c.alignment, "chaotic evil");
  assert.equal(c.ac, 19);
  assert.equal(c.maxHp, 256);
  assert.equal(c.hpFormula, "19d12+133");
  assert.equal(c.initiative, 10);
  assert.deepEqual(c.speed, { walk: 40, climb: 40, fly: 80 });
  assert.equal(c.saves?.dex, 6);
  assert.equal(c.saves?.cha, 12);
  assert.equal(c.skills?.perception, 13);
  assert.equal(c.senses.passivePerception, 23);
  assert.equal(c.senses.darkvision, 120);
  assert.equal(c.senses.blindsight, 60);
  assert.deepEqual(c.immunities, ["Fire"]);
  assert.equal(c.cr, 17);
});

test("2024 actions: attack damage components, save + recharge, legendary", () => {
  const c = statBlockToCreature(
    statBlock({
      Name: "Adult Red Dragon",
      Type: "Huge Dragon, Chaotic Evil",
      InitiativeModifier: 10,
      Traits: [
        {
          Name: "Legendary Resistance",
          Content:
            "(3/Day, or 4/Day in Lair). If the dragon fails a saving throw, it can choose to succeed instead.",
        },
      ],
      Actions: [
        { Name: "Multiattack", Content: "The dragon makes three Rend attacks." },
        {
          Name: "Rend",
          Content:
            "Melee Attack Roll: +14, reach 10 ft. Hit: 19 (2d10 + 8) Slashing damage plus 7 (2d6) Fire damage.",
        },
        {
          Name: "Fire Breath (Recharge 5–6)",
          Content:
            "Dexterity Saving Throw: DC 21, each creature in a 90-foot Cone. Failure: 91 (26d6) Fire damage. Success: Half damage.",
        },
      ],
      LegendaryActions: [
        { Name: "", Content: "The dragon can take 3 legendary actions." },
        {
          Name: "Tail Swipe",
          Content: "Melee Attack Roll: +14, reach 15 ft. Hit: 17 (2d8 + 8) Bludgeoning damage.",
        },
      ],
    }),
  );

  const multiattack = c.actions?.[0];
  assert.equal(multiattack?.name, "Multiattack");
  assert.equal(multiattack?.kind, "utility");
  assert.equal(multiattack?.toHit, null);

  const rend = c.actions?.[1];
  assert.equal(rend?.kind, "melee");
  assert.equal(rend?.toHit, 14);
  assert.equal(rend?.reach, 10);
  assert.deepEqual(rend?.damage, [
    { formula: "2d10+8", type: "slashing" },
    { formula: "2d6", type: "fire" },
  ]);

  const breath = c.actions?.[2];
  assert.equal(breath?.name, "Fire Breath");
  assert.equal(breath?.kind, "save");
  assert.deepEqual(breath?.recharge, { type: "dice", value: 5 });
  assert.deepEqual(breath?.save, { ability: "dex", dc: 21, onSave: "half" });
  assert.deepEqual(breath?.damage, [{ formula: "26d6", type: "fire" }]);

  assert.equal(c.legendaryActions?.perRound, 3);
  assert.equal(c.legendaryActions?.actions.length, 1);
  assert.equal(c.legendaryActions?.actions[0].name, "Tail Swipe");
  assert.equal(c.legendaryActions?.actions[0].reach, 15);
  assert.equal(c.legendaryResistance, 3);
  assert.equal(c.legendaryResistanceLair, 4);
});

test("2014 statblock: edition, no initiative, weapon attacks, prose save", () => {
  const c = statBlockToCreature(
    statBlock({
      Name: "Young Red Dragon",
      Type: "Large Dragon, Chaotic Evil",
      HP: { Value: 178, Notes: "(17d10 + 85)" },
      AC: { Value: 18, Notes: "" },
      Abilities: { Str: 23, Dex: 10, Con: 21, Int: 14, Wis: 11, Cha: 19 },
      Senses: ["Blindsight 30 ft.", "Darkvision 120 ft.", "Passive Perception 18"],
      DamageImmunities: ["Fire"],
      Challenge: "10",
      Actions: [
        {
          Name: "Bite",
          Content:
            "Melee Weapon Attack: +10 to hit, reach 10 ft., one target. Hit: 17 (2d10 + 6) piercing damage plus 3 (1d6) fire damage.",
        },
        {
          Name: "Fire Breath (Recharge 5–6)",
          Content:
            "The dragon exhales fire in a 30-foot cone. Each creature in that area must make a DC 17 Dexterity saving throw, taking 56 (16d6) fire damage on a failed save, or half as much damage on a successful one.",
        },
      ],
    }),
  );

  assert.equal(c.edition, "5.0");
  assert.equal(c.initiative, undefined);
  assert.equal(c.size, "Large");
  assert.equal(c.hpFormula, "17d10+85");
  assert.equal(c.cr, 10);

  const bite = c.actions?.[0];
  assert.equal(bite?.kind, "melee");
  assert.equal(bite?.toHit, 10);
  assert.equal(bite?.reach, 10);
  assert.deepEqual(bite?.damage, [
    { formula: "2d10+6", type: "piercing" },
    { formula: "1d6", type: "fire" },
  ]);

  const breath = c.actions?.[1];
  assert.equal(breath?.kind, "save");
  assert.deepEqual(breath?.recharge, { type: "dice", value: 5 });
  assert.deepEqual(breath?.save, { ability: "dex", dc: 17, onSave: "half" });
  assert.deepEqual(breath?.damage, [{ formula: "16d6", type: "fire" }]);
});

test("2024 spellcasting: structured block, junk pseudo-actions removed", () => {
  // Real scrape of "Aarakocra Aeromancer" — the scraper merged the two usage tiers
  // into one entry ("…Message1/Day: Lightning Bolt").
  const c = statBlockToCreature(
    statBlock({
      Name: "Aarakocra Aeromancer",
      Type: "Medium Elemental, Neutral",
      InitiativeModifier: 0,
      Abilities: { Str: 10, Dex: 16, Con: 12, Int: 13, Wis: 17, Cha: 12 },
      Actions: [
        {
          Name: "Multiattack",
          Content: "The aarakocra makes two Wind Staff attacks, and it can use Spellcasting to cast Gust of Wind.",
        },
        {
          Name: "Wind Staff",
          Content: "Melee or Ranged Attack Roll: +5, reach 5 ft. or range 120 ft. Hit: 7 (1d8 + 3) Bludgeoning damage plus 11 (2d10) Lightning damage.",
        },
        {
          Name: "Spellcasting",
          Content: "The aarakocra casts one of the following spells, requiring no Material components and using Wisdom as the spellcasting ability (spell save DC 13):",
        },
        {
          Name: "At Will:",
          Content: "Elementalism, Gust of Wind, Mage Hand, Message1/Day: Lightning Bolt",
        },
      ],
    }),
  );

  // Only the real actions remain; the spellcasting pseudo-actions are gone.
  assert.deepEqual(c.actions?.map((a) => a.name), ["Multiattack", "Wind Staff"]);

  assert.equal(c.spellcasting?.ability, "wis");
  assert.equal(c.spellcasting?.saveDc, 13);
  assert.deepEqual(c.spellcasting?.groups[0].usage, { type: "atWill" });
  assert.deepEqual(
    c.spellcasting?.groups[0].spells.map((s) => s.name),
    ["Elementalism", "Gust of Wind", "Mage Hand", "Message"],
  );
  assert.equal(c.spellcasting?.groups[0].spells[1].ref, "srd-5.2:gust-of-wind");
  assert.deepEqual(c.spellcasting?.groups[1].usage, { type: "perDay", per: 1 });
  assert.deepEqual(
    c.spellcasting?.groups[1].spells.map((s) => s.name),
    ["Lightning Bolt"],
  );
});

test("2024 spellcasting: a preceding action that references the ability doesn't shadow the block", () => {
  // Evoker Archmage: "Evocation Barrage" and the "Protective Magic" reaction both say
  // "…using the same spellcasting ability as Spellcasting", which used to trip the
  // lead-in finder before it reached the real "Spellcasting" action.
  const c = statBlockToCreature(
    statBlock({
      Name: "Evoker Archmage",
      Type: "Medium Humanoid, Neutral",
      Abilities: { Str: 10, Dex: 16, Con: 12, Int: 20, Wis: 15, Cha: 16 },
      Actions: [
        { Name: "Multiattack", Content: "The archmage makes four Arcane Burst attacks. It can replace one attack with a use of Spellcasting to cast Shatter." },
        { Name: "Arcane Burst", Content: "Melee or Ranged Attack Roll: +10, reach 5 ft. or range 150 ft. Hit: 27 (4d10 + 5) Force damage." },
        { Name: "Evocation Barrage", Content: "The archmage casts Fireball, Ice Storm, or Lightning Bolt twice in any combination, using the same spellcasting ability as Spellcasting." },
        { Name: "Spellcasting", Content: "The archmage casts one of the following spells, using Intelligence as the spellcasting ability (spell save DC 18):" },
        { Name: "At Will:", Content: "Detect Magic, Mage Armor (included in AC), Mage Hand, Prestidigitation, Shatter (level 3 version)" },
      ],
      Reactions: [
        { Name: "Protective Magic", Content: "The archmage casts Counterspell or Shield in response to the spell's trigger, using the same spellcasting ability as Spellcasting." },
      ],
    }),
  );

  // The real Spellcasting block is parsed; the referencing actions are left intact.
  assert.equal(c.spellcasting?.ability, "int");
  assert.equal(c.spellcasting?.saveDc, 18);
  assert.deepEqual(c.spellcasting?.groups[0].usage, { type: "atWill" });
  assert.deepEqual(
    c.spellcasting?.groups[0].spells.map((s) => s.name),
    ["Detect Magic", "Mage Armor", "Mage Hand", "Prestidigitation", "Shatter"],
  );
  // Multiattack, Arcane Burst, and Evocation Barrage remain real actions.
  assert.deepEqual(c.actions?.map((a) => a.name), ["Multiattack", "Arcane Burst", "Evocation Barrage"]);
});

test("2014 slot spellcasting (Archmage trait): structured slots + at-will, trait removed", () => {
  const c = statBlockToCreature(
    statBlock({
      Name: "Archmage",
      Type: "Medium Humanoid (Any Race), Any Alignment",
      Abilities: { Str: 10, Dex: 14, Con: 12, Int: 20, Wis: 15, Cha: 16 },
      Challenge: "12",
      Traits: [
        {
          Name: "Magic Resistance",
          Content: "The archmage has advantage on saving throws against spells and other magical effects.",
        },
        {
          Name: "Spellcasting",
          Content:
            "The archmage is an 18th-level spellcaster. Its spellcasting ability is Intelligence (spell save DC 17, +9 to hit with spell attacks). The archmage can cast disguise self and invisibility at will and has the following wizard spells prepared:\n\n" +
            "Cantrips (at will): fire bolt, light, mage hand, prestidigitation, shocking grasp\n\n" +
            "1st level (4 slots): detect magic, identify, mage armor*, magic missile\n\n" +
            "2nd level (3 slots): detect thoughts, mirror image, misty step\n\n" +
            "3rd level (3 slots): counterspell, fly, lightning bolt\n\n" +
            "9th level (1 slot): time stop\n\n" +
            "*The archmage casts these spells on itself before combat.",
        },
      ],
    }),
  );

  // The Spellcasting trait is lifted out; only Magic Resistance remains.
  assert.deepEqual(c.traits?.map((t) => t.name), ["Magic Resistance"]);

  const sc = c.spellcasting!;
  assert.equal(sc.ability, "int");
  assert.equal(sc.saveDc, 17);
  assert.equal(sc.toHit, 9);

  // At-will = the "can cast … at will" spells + cantrips, merged. Names are title-cased.
  assert.deepEqual(sc.groups[0].usage, { type: "atWill" });
  assert.deepEqual(sc.groups[0].spells.map((s) => s.name), [
    "Disguise Self", "Invisibility",
    "Fire Bolt", "Light", "Mage Hand", "Prestidigitation", "Shocking Grasp",
  ]);

  // First slot group: 1st level; the "*" marker is kept on the display name but the
  // ref slugs the de-asterisked name. A 2014 creature's spells point at the SRD 5.1 library.
  assert.deepEqual(sc.groups[1].usage, { type: "slots", level: 1 });
  assert.deepEqual(sc.groups[1].spells.map((s) => s.name), [
    "Detect Magic", "Identify", "Mage Armor*", "Magic Missile",
  ]);
  assert.equal(sc.groups[1].spells[2].ref, "srd-5.1:mage-armor");
  assert.equal(sc.groups[0].spells[0].ref, "srd-5.1:disguise-self");

  // Per-level slot maxes.
  assert.deepEqual(sc.slots, { "1": 4, "2": 3, "3": 3, "9": 1 });

  // The footnote line is preserved as a note.
  assert.equal(sc.note, "*The archmage casts these spells on itself before combat.");
});

test("legendary actions: per-round budget + (Costs N Actions) in name or split body", () => {
  // As the (fixed) scraper yields them for Jack Frost: a heading-less intro
  // paragraph, then named actions — one with the cost in its name, one with the
  // cost split into the body (the name was a separate <strong>).
  const c = statBlockToCreature(
    statBlock({
      Name: "Jack Frost",
      Type: "Medium Fey, Chaotic Good",
      Challenge: "9",
      LegendaryActions: [
        {
          Name: "",
          Content:
            "Jack Frost can take 3 legendary actions, choosing from the options below. Only one legendary action option can be used at a time and only at the end of another creature's turn. Jack Frost regains spent legendary actions at the start of its turn.",
        },
        { Name: "Staff", Content: "Jack Frost makes a Staff attack." },
        { Name: "Ice Trick (Costs 2 Actions)", Content: "Jack Frost uses his Ice Trick action." },
        {
          Name: "Misty Step",
          Content:
            "(Costs 2 Actions). A gust of frozen wind magically teleports Jack Frost in a free spot within 60 ft.",
        },
      ],
    }),
  );

  const la = c.legendaryActions!;
  assert.equal(la.perRound, 3);
  assert.deepEqual(la.actions.map((a) => a.name), ["Staff", "Ice Trick", "Misty Step"]);
  assert.equal(la.actions[0].legendaryCost, undefined);
  assert.equal(la.actions[1].legendaryCost, 2);
  assert.equal(la.actions[2].legendaryCost, 2);
  // The cost marker is stripped from the displayed prose, not left in the text.
  assert.match(la.actions[2].text!, /^A gust of frozen wind/);
  assert.doesNotMatch(la.actions[1].name, /Costs/);
});

test("spell refs follow the creature's edition (2014 → srd-5.1, 2024 → srd-5.2)", () => {
  const traits = [
    {
      Name: "Innate Spellcasting",
      Content:
        "The creature's innate spellcasting ability is Charisma (spell save DC 14). It can innately cast the following spells:\n\nAt will: cone of cold, gust of wind",
    },
  ];
  // 2014: no InitiativeModifier → edition 5.0.
  const c14 = statBlockToCreature(statBlock({ Name: "Jack Frost", Traits: traits }));
  assert.equal(c14.edition, "5.0");
  assert.deepEqual(
    c14.spellcasting?.groups[0].spells.map((s) => s.ref),
    ["srd-5.1:cone-of-cold", "srd-5.1:gust-of-wind"],
  );

  // 2024: an InitiativeModifier marks the 2024 layout → edition 5.5.
  const c24 = statBlockToCreature(statBlock({ Name: "Jack Frost", InitiativeModifier: 0, Traits: traits }));
  assert.equal(c24.edition, "5.5");
  assert.deepEqual(
    c24.spellcasting?.groups[0].spells.map((s) => s.ref),
    ["srd-5.2:cone-of-cold", "srd-5.2:gust-of-wind"],
  );

  // An explicit edition override wins.
  const cForced = statBlockToCreature(statBlock({ Name: "Jack Frost", Traits: traits }), { edition: "5.5" });
  assert.equal(cForced.spellcasting?.groups[0].spells[0].ref, "srd-5.2:cone-of-cold");
});

test("2014 ranged weapon attack: range normal/long, no reach", () => {
  const c = statBlockToCreature(
    statBlock({
      Name: "Goblin",
      Type: "Small Humanoid (Goblinoid), Neutral Evil",
      HP: { Value: 7, Notes: "(2d6)" },
      AC: { Value: 15, Notes: "" },
      Abilities: { Str: 8, Dex: 14, Con: 10, Int: 10, Wis: 8, Cha: 8 },
      Challenge: "1/4",
      Actions: [
        {
          Name: "Shortbow",
          Content:
            "Ranged Weapon Attack: +4 to hit, range 80/320 ft., one target. Hit: 5 (1d6 + 2) piercing damage.",
        },
      ],
    }),
  );

  assert.equal(c.type, "humanoid");
  assert.equal(c.alignment, "neutral evil");
  assert.equal(c.cr, 0.25);
  const shortbow = c.actions?.[0];
  assert.equal(shortbow?.kind, "ranged");
  assert.equal(shortbow?.toHit, 4);
  assert.equal(shortbow?.reach, undefined);
  assert.deepEqual(shortbow?.range, { normal: 80, long: 320 });
});

test("the edition follows the scraped layout, not a lucky number parse", () => {
  // The bug this guards: a 2024 page whose Initiative is negative ("−1 (9)") used to
  // parse to NaN, which JSON message passing turns into null — and a null Initiative
  // read as a 2014 page, so a Monster Manual 2024 creature imported as 5e.
  const scraped = statBlock({ Name: "Beholder Zombie", Layout: "2024", InitiativeModifier: NaN });
  const overTheWire = JSON.parse(JSON.stringify(scraped));
  assert.equal(overTheWire.InitiativeModifier, null);

  const c = statBlockToCreature(overTheWire);
  assert.equal(c.edition, "5.5");
  // NaN must not surface as a null initiative either; the field is simply absent.
  assert.equal(c.initiative, undefined);
  assert.ok(!("initiative" in c));

  // A recorded layout decides on its own, with no Initiative in play at all.
  assert.equal(statBlockToCreature(statBlock({ Layout: "2024" })).edition, "5.5");
  assert.equal(statBlockToCreature(statBlock({ Layout: "2014" })).edition, "5.0");
  // An explicit override still wins over the recorded layout.
  assert.equal(statBlockToCreature(statBlock({ Layout: "2024" }), { edition: "5.0" }).edition, "5.0");
});

test("negative dice formulas written with U+2212 survive instead of being dropped", () => {
  const c = statBlockToCreature(
    statBlock({
      Layout: "2024",
      Abilities: { Str: 10, Dex: 8, Con: 10, Int: 10, Wis: 10, Cha: 10 },
      InitiativeModifier: 0,
      HP: { Value: 3, Notes: "(1d6 - 1)" },
      Actions: [
        {
          Name: "Bite",
          Content: "Melee Attack Roll: -1, reach 5 ft. Hit: 2 (1d4 - 1) Piercing damage.",
        },
      ],
    }),
  );

  // The scrapers hand these over already folded to ASCII; the regexes only ever
  // matched [+-], so before the fix the formula and the whole attack vanished.
  assert.equal(c.hpFormula, "1d6-1");
  assert.equal(c.initiative, -1);
  assert.equal(c.actions?.[0].toHit, -1);
  assert.equal(c.actions?.[0].kind, "melee");
  assert.deepEqual(c.actions?.[0].damage, [{ formula: "1d4-1", type: "piercing" }]);
});
