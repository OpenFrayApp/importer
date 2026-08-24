// OpenFray schema — the shapes this importer produces. Mirrors the console's
// src/schema/{creature,action,primitives,license}.ts, kept in sync by hand.
//
// The whole `Creature` is mirrored, including the fields the converter never writes:
// a field left out of this copy is a field nobody notices the console has grown, and
// the console drops anything its own schema doesn't name. Each unwritten field says
// who fills it in instead.

export type Ability = "str" | "dex" | "con" | "int" | "wis" | "cha";
export type AbilityScores = Record<Ability, number>;
export type SaveBonuses = Partial<Record<Ability, number>>;

export type Size =
  | "Tiny"
  | "Small"
  | "Medium or Small"
  | "Medium"
  | "Large"
  | "Huge"
  | "Gargantuan";

export type Skill =
  | "acrobatics"
  | "animalHandling"
  | "arcana"
  | "athletics"
  | "deception"
  | "history"
  | "insight"
  | "intimidation"
  | "investigation"
  | "medicine"
  | "nature"
  | "perception"
  | "performance"
  | "persuasion"
  | "religion"
  | "sleightOfHand"
  | "stealth"
  | "survival";

export type SkillBonuses = Partial<Record<Skill, number>>;

export type DamageType =
  | "acid"
  | "bludgeoning"
  | "cold"
  | "fire"
  | "force"
  | "lightning"
  | "necrotic"
  | "piercing"
  | "poison"
  | "psychic"
  | "radiant"
  | "slashing"
  | "thunder";

export interface Speeds {
  walk?: number;
  fly?: number;
  swim?: number;
  climb?: number;
  burrow?: number;
  hover?: boolean;
}

export interface Senses {
  passivePerception: number;
  darkvision?: number;
  blindsight?: number;
  tremorsense?: number;
  truesight?: number;
}

export type ContentSource = string;
export type Edition = "5.0" | "5.5";

/** How a stat block may be reused. Not written here: the console assumes one from the
 *  source book on paste — all rights reserved, unless the source names the free rules. */
export type ContentLicense =
  | "cc0-1.0"
  | "cc-by-4.0"
  | "cc-by-sa-4.0"
  | "cc-by-nc-4.0"
  | "cc-by-nc-sa-4.0"
  | "ogl-1.0a"
  | "reserved"
  | "unstated";

export type ActionKind = "melee" | "ranged" | "save" | "utility";
export type SaveOutcome = "half" | "none" | "negates";

export interface SaveRequirement {
  ability: Ability;
  dc: number;
  onSave: SaveOutcome;
}

export interface DamageRoll {
  formula: string;
  type: DamageType;
}

export interface Range {
  normal: number;
  long?: number;
}

export type Recharge =
  | { type: "dice"; value: number }
  | { type: "perDay"; value: number }
  | { type: "perRound"; value: number };

export interface Action {
  id: string;
  name: string;
  kind: ActionKind;
  toHit: number | null;
  reach?: number;
  range?: Range;
  damage?: DamageRoll[];
  save?: SaveRequirement | null;
  recharge?: Recharge;
  legendaryCost?: number;
  text?: string;
}

export interface Trait {
  name: string;
  text: string;
}

export type SpellUsage =
  | { type: "atWill" }
  /** `shared` marks one pool between the group's spells; the default is N uses each. */
  | { type: "perDay"; per: number; shared?: boolean }
  | { type: "slots"; level: number };

export type SpellLevel = "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9";
export type SpellSlots = Partial<Record<SpellLevel, number>>;

export interface SpellRef {
  name: string;
  /** Compendium id, e.g. "srd-5.2:fireball" — resolves the hover card in OpenFray. */
  ref?: string;
}

export interface SpellGroup {
  usage: SpellUsage;
  spells: SpellRef[];
}

export interface Spellcasting {
  ability?: Ability;
  /** The caster's save DC (the spell never owns the DC). */
  saveDc?: number;
  toHit?: number;
  groups: SpellGroup[];
  /** Per-level slot maxes for the 2014 slot model. */
  slots?: SpellSlots;
  /** A trailing note from the stat block (e.g. "*casts these on itself before combat"). */
  note?: string;
}

export interface LegendaryActions {
  perRound: number;
  /** The higher per-round budget while the creature is in its lair, when it has one. */
  perRoundLair?: number;
  actions: Action[];
}

/** A recharge / x-per-day ability tracked on its own. Not written here: DDB writes these
 *  into an action's name ("Fire Breath (Recharge 5-6)"), which becomes `Action.recharge`. */
export interface LimitedUse {
  id: string;
  name: string;
  recharge: Recharge;
  action: Action;
}

export interface Creature {
  id: string;
  source: ContentSource;
  edition?: Edition;
  /** Page in the source document. Not written here: DDB's page number stays in `source`. */
  sourcePage?: number;
  /** The compendium entry this was built from. Not written here, and never guessed at:
   *  a scrape is its own creature, not a derivative of one the console ships. */
  derivedFrom?: string;
  license?: ContentLicense;
  /** Brought in from outside the console. Not written here: the console sets it on every
   *  paste, and it is what stops an imported stat block reaching a public link. */
  imported?: boolean;
  name: string;
  size: Size;
  type: string;
  alignment?: string;
  /** Optional flavor/lore (markdown), display only. Absent for SRD. */
  description?: string;
  ac: number;
  maxHp: number;
  hpFormula?: string;
  initiative?: number;
  speed: Speeds;
  abilities: AbilityScores;
  saves?: SaveBonuses;
  skills?: SkillBonuses;
  senses: Senses;
  languages?: string[];
  resistances?: string[];
  immunities?: string[];
  vulnerabilities?: string[];
  conditionImmunities?: string[];
  /** Carried equipment from the 2024 Gear line. Reference/display only. */
  gear?: string[];
  cr?: number;
  xp?: number;
  /** The XP award while the creature is in its lair. Not written here: DDB's CR line
   *  carries one XP figure, and the lair one is prose inside the lair-actions section. */
  xpLair?: number;
  traits?: Trait[];
  actions?: Action[];
  bonusActions?: Action[];
  reactions?: Action[];
  legendaryActions?: LegendaryActions;
  lairActions?: Action[];
  spellcasting?: Spellcasting;
  limitedUse?: LimitedUse[];
  legendaryResistance?: number;
  legendaryResistanceLair?: number;
}
