export interface AbilityScores {
  Str: number;
  Dex: number;
  Con: number;
  Cha: number;
  Int: number;
  Wis: number;
}

export interface NameAndModifier {
  Name: string;
  Modifier: number;
}

export interface ValueAndNotes {
  Value: number;
  Notes: string;
}

export interface NameAndContent {
  Name: string;
  Content: string;
  Usage?: string;
}

export interface StatBlock {
  /** Which DDB page layout this was scraped from; the edition tell. */
  Layout?: "2014" | "2024";
  Name: string;
  Source: string;
  Type: string;
  HP: ValueAndNotes;
  AC: ValueAndNotes;
  Speed: string[];
  Abilities: AbilityScores;
  InitiativeModifier?: number;
  InitiativeSpecialRoll?: "advantage" | "disadvantage" | "take-ten";
  InitiativeAdvantage?: boolean;
  DamageVulnerabilities: string[];
  DamageResistances: string[];
  DamageImmunities: string[];
  ConditionImmunities: string[];
  Saves: NameAndModifier[];
  Skills: NameAndModifier[];
  Senses: string[];
  Languages: string[];
  /** The 2024 "Gear" line; absent from the 2014 layout, which has no such line. */
  Gear?: string[];
  Challenge: string;
  Xp?: number;
  Traits: NameAndContent[];
  Actions: NameAndContent[];
  Reactions: NameAndContent[];
  LegendaryActions: NameAndContent[];
  BonusActions?: NameAndContent[];
  MythicActions?: NameAndContent[];
  Description: string;
  Player: string;
  ImageURL: string;
}

/** The standard 5e modifier for an ability score: floor((score - 10) / 2). */
export const abilityMod = (score: number): number => Math.floor((score - 10) / 2);

// DDB writes negative numbers with U+2212 MINUS SIGN (and the occasional
// non-breaking hyphen), which parseInt/Number and our [+-] regexes reject: a
// scraped "−1" parses to NaN, and a "(1d4 − 1)" damage roll matches nothing.
const UNICODE_MINUS = /[−‑]/g;

/** Fold DDB's Unicode minus signs to ASCII "-", leaving prose em/en dashes alone. */
export const normalizeMinus = (s: string): string => s.replace(UNICODE_MINUS, "-");

/** parseInt over DDB text, tolerating its Unicode minus; undefined when there's no number. */
export const parseSignedInt = (s: string): number | undefined => {
  const n = parseInt(normalizeMinus(s), 10);
  return Number.isNaN(n) ? undefined : n;
};
