import cash, { type Cash } from "cash-dom";
import { descriptionToMarkdown } from "./descriptionToMarkdown.ts";
import { Options, type AllOptions } from "./options.ts";
import { powerNodes, powerText } from "./powernodes.ts";
import {
  abilityMod,
  normalizeMinus,
  parseSignedInt,
  type AbilityScores,
  type NameAndContent,
  type NameAndModifier,
  type StatBlock,
} from "./statblock.ts";

/** Build a StatBlock from a DDB 2024-layout monster page (".mon-stat-block-2024"). */
export function get2024StatBlock(
  options: AllOptions,
  doc: Cash,
  statBlockElements: Cash
): StatBlock {
  console.log("Found 2024 Statblock");
  const statBlockElement = statBlockElements.first();
  const statBlock: StatBlock = {
    Layout: "2024",
    Source: getSource(
      doc.find(".monster-source"),
      options[Options.IncludePageNumberWithSource] == "on"
    ),
    Name: getName(statBlockElement),
    Type: getType(statBlockElement),
    HP: getHitPoints(statBlockElement),
    AC: getArmorClass(statBlockElement),
    Abilities: getAbilities(statBlockElement),
    Speed: getDelimitedStrings(statBlockElement, "Speed"),
    InitiativeModifier: getInitiativeModifier(statBlockElement),
    // InitiativeSpecialRoll?: "advantage" | "disadvantage" | "take-ten",
    // InitiativeAdvantage?: boolean,
    DamageVulnerabilities: getDelimitedStrings(
      statBlockElement,
      "Vulnerabilities"
    ),
    DamageResistances: getDelimitedStrings(statBlockElement, "Resistances"),
    DamageImmunities: getImmunities(statBlockElement).Damage,
    ConditionImmunities: getImmunities(statBlockElement).Condition,
    Saves: getSaves(statBlockElement),
    Skills: getDelimitedModifiers(statBlockElement, "Skills"),
    Senses: getDelimitedStrings(statBlockElement, "Senses"),
    Languages: getDelimitedStrings(statBlockElement, "Languages"),
    Challenge: getChallenge(statBlockElement),
    Xp: getXp(statBlockElement),
    Traits: getPowers(statBlockElement, "Traits"),
    Actions: getPowers(statBlockElement, "Actions"),
    Reactions: getPowers(statBlockElement, "Reactions"),
    LegendaryActions: getPowers(statBlockElement, "Legendary Actions"),
    BonusActions: getPowers(statBlockElement, "Bonus Actions"),
    MythicActions: getPowers(statBlockElement, "Mythic Actions"),
    ImageURL: doc.find(".details-aside .image a").attr("href") || "",
    Description: getDescription(doc, options),
    Player: "",
  };

  return statBlock;
}

/** The source-book line, whitespace-normalized; the ", pg. N" tail kept only when requested. */
function getSource(element: Cash, includePageNumber: boolean) {
  console.log("getSource element", element);
  const source = element.text().replace(/\s+/g, " ").replace(" ,", ",").trim();
  if (includePageNumber) {
    return source;
  } else {
    return source.split(",")[0];
  }
}

/** The monster's description block, converted to markdown, with an optional link
 *  back to the source page. */
function getDescription(doc: Cash, options: AllOptions) {
  let retVal = "";
  if (options[Options.IncludeDescription] === "on") {
    retVal = descriptionToMarkdown(
      doc.find(".mon-details__description-block-content")
    );
  }
  if (options[Options.IncludeLink] === "on")
    retVal += `\n\n[See this creature on DDB.](${document.location.href})`;

  return retVal.trim();
}

/** The monster's name from the stat-block name link. */
function getName(element: Cash) {
  return element.find(".mon-stat-block-2024__name-link").text().trim();
}

/** The size/type/alignment meta line under the name ("Large Fiend (Devil), Lawful Evil"). */
function getType(element: Cash) {
  return element.find(".mon-stat-block-2024__meta").text().trim();
}

/** The "AC" attribute as { Value, Notes }. */
function getArmorClass(element: Cash) {
  return getAttribute(element, "AC");
}

/** The "HP" attribute as { Value, Notes } (Notes carries the dice formula). */
function getHitPoints(element: Cash) {
  return getAttribute(element, "HP");
}

/** The 2024 Initiative line minus the Dex mod — the extra bonus DDB folded into the listed total. */
function getInitiativeModifier(element: Cash): number | undefined {
  const dexScore = getAbility(element, "dex");
  const dexModifier = abilityMod(dexScore);
  const initiativeHeader = element
    .find(".mon-stat-block-2024__attribute-label")
    .filter((_, e: Element) => e.innerHTML.trim() == "Initiative")
    .first();
  const initiativeListed = parseSignedInt(initiativeHeader.next().text().trim());
  // Never let NaN escape: it survives the extension's JSON message passing as null,
  // and a null initiative used to read downstream as "this is a 2014 page".
  if (initiativeListed == null) return undefined;
  return initiativeListed - dexModifier;
}

/** A labelled attribute row as { Value: the leading number, Notes: the extra text beside it }. */
function getAttribute(element: Cash, attributeName: string) {
  const label = element
    .find(".mon-stat-block-2024__attribute-label")
    .filter((_, e: Element) => e.innerHTML.trim() == attributeName)
    .first();

  const value = parseInt(
    label
      .parent()
      .find(".mon-stat-block-2024__attribute-data-value")
      .text()
      .trim()
  );
  const notes = normalizeMinus(
    label.parent().find(".mon-stat-block-2024__attribute-data-extra").text().trim()
  );
  return {
    Value: value,
    Notes: notes,
  };
}

/** All six ability scores from the 2024 stats table. */
function getAbilities(element: Cash): AbilityScores {
  return {
    Str: getAbility(element, "str"),
    Dex: getAbility(element, "dex"),
    Con: getAbility(element, "con"),
    Int: getAbility(element, "int"),
    Wis: getAbility(element, "wis"),
    Cha: getAbility(element, "cha"),
  };
}

/** One score from the stats table: the row's <th> names the ability, its first <td> holds the score. */
function getAbility(element: Cash, ability: string) {
  let score = 10;

  const scoreHeader = element
    .find(".mon-stat-block-2024__stats tbody th")
    .filter(
      (_, e: Element) => e.innerHTML.trim().toLocaleLowerCase() == ability
    )
    .first();

  const scoreText = scoreHeader.siblings("td").first().text();

  try {
    score = parseInt(scoreText);
  } catch (e) {}
  return score;
}

/** Proficient saves from the stats table: rows whose SAVE cell differs from the MOD cell. */
function getSaves(element: Cash) {
  let saves: NameAndModifier[] = [];

  const scoreHeaders = element.find(".mon-stat-block-2024__stats tbody th");
  scoreHeaders.each((_, scoreHeader: Element) => {
    const siblingCells = cash(scoreHeader).siblings("td");
    console.log({
      cash_scoreHeader: cash(scoreHeader),
      scoreHeader,
      siblingCells,
      parent: cash(scoreHeader).parent(),
    });
    if (siblingCells.length < 3) {
      return;
    }
    const scoreModifier = siblingCells.eq(1).text();
    const scoreSave = siblingCells.eq(2).text();
    if (scoreSave !== scoreModifier) {
      saves.push({
        Name: cash(scoreHeader).text().trim(),
        Modifier: parseSignedInt(scoreSave) ?? 0,
      });
    }
  });

  return saves;
}

/** Split the merged 2024 "Immunities" tidbit into Damage/Condition lists (";" or tooltip markup decides). */
function getImmunities(element: Cash) {
  const immunitiesListLabel = element
    .find(".mon-stat-block-2024__tidbit-label")
    .filter((_, e: Element) => e.innerHTML.trim() == "Immunities")
    .first();
  const immunitiesList = immunitiesListLabel
    .siblings(".mon-stat-block-2024__tidbit-data")
    .first();

  if (immunitiesList.text().includes(";")) {
    const [damage, condition] = immunitiesList.text().split(";");
    return {
      Damage: damage
        .split(",")
        .map((i) => i.trim())
        .filter((i) => i.length > 0),
      Condition: condition
        .split(",")
        .map((i) => i.trim())
        .filter((i) => i.length > 0),
    };
  }
  if (immunitiesList.has(".condition-tooltip").length > 0) {
    return {
      Damage: [],
      Condition: immunitiesList
        .text()
        .split(",")
        .map((i) => i.trim())
        .filter((i) => i.length > 0),
    };
  } else {
    return {
      Damage: immunitiesList
        .text()
        .split(",")
        .map((i) => i.trim())
        .filter((i) => i.length > 0),
      Condition: [],
    };
  }
}

/** Split a tidbit line into items on ";" when present, else ",". */
function getDelimitedStrings(element: Cash, tidbitName: string) {
  const label = element
    .find(
      ".mon-stat-block-2024__attribute-label, .mon-stat-block-2024__tidbit-label"
    )
    .filter((_, e: Element) => e.innerHTML.trim() == tidbitName)
    .first();

  const delimitedString = label
    .parent()
    .find(
      ".mon-stat-block-2024__attribute-data-value, .mon-stat-block-2024__tidbit-data"
    )
    .text()
    .replace("--", "")
    .trim();

  if (delimitedString.length > 0) {
    const commaPattern = /, ?/;
    const semicolonPattern = /; ?/;
    const splitPattern = delimitedString.includes(";")
      ? semicolonPattern
      : commaPattern;

    return delimitedString.split(splitPattern).map((s) => s.trim());
  }
  return [];
}

/** Entries like "Dex +5" as { Name, Modifier }, parsing the modifier off the last word. */
function getDelimitedModifiers(element: Cash, tidbitName: string) {
  const entries = getDelimitedStrings(element, tidbitName);
  return entries.map((e) => {
    // Extract the last piece of the name/modifier, and parse an int from only that, ensuring the name can contain any manner of spacing.
    const nameAndModifier = e.split(" ");
    const modifierValue = parseSignedInt(nameAndModifier.pop() ?? "") ?? 0;

    // Join the remaining string name, and trim outside spacing just in case.
    return {
      Name: nameAndModifier.join(" ").trim(),
      Modifier: modifierValue,
    };
  });
}

/** The CR string ("1/2", "10") from the CR tidbit; "0" when absent. */
function getChallenge(element: Cash) {
  const challengeText = getDelimitedStrings(element, "CR");
  if (challengeText.length == 0) {
    return "0";
  }
  const matches = challengeText[0].match(/(\d|\/){1,4}/);
  return matches?.[0] || "0";
}

/** The XP number that rides on the CR line ("XP 1,100" / "1,100 XP"). */
function getXp(element: Cash): number | undefined {
  // XP rides on the CR line. 2024 writes it "XP 1,100" ("CR 4 (XP 1,100; PB +2)"),
  // 2014 "1,100 XP" — handle both orders. Read the whole block so the comma in
  // "1,100" doesn't trip the comma/semicolon delimiter splitters.
  const m = element.text().match(/XP[\s:]*([\d,]+)|([\d,]+)\s*XP/i);
  const raw = m?.[1] ?? m?.[2];
  return raw ? parseInt(raw.replace(/,/g, ""), 10) : undefined;
}

/** A section's powers as Name/Content pairs; each entry's leading <strong> is its name. */
function getPowers(element: Cash, type: string): NameAndContent[] {
  const section = getPowerSection(element, type);

  const powerEntries = powerNodes(section.get()).map((el) => {
    const contentNode = cash(el).clone();
    const powerName = contentNode.find("strong").first().remove();
    return {
      Name: powerName.text().trim().replace(/\.$/, ""),
      Content: normalizeMinus(powerText(contentNode.get(0) as Element)),
    };
  });

  return collapsePowerDescriptions(powerEntries);
}

/** Merge nameless follow-on paragraphs into the preceding named power's Content. */
function collapsePowerDescriptions(powerEntries: NameAndContent[]) {
  return powerEntries.reduce<NameAndContent[]>((p, c, i) => {
    const isFirstParagraph = i == 0 || c.Name.length > 0;
    let fullPowerText = c.Content;

    let lookAhead = i;
    if (isFirstParagraph) {
      while (
        powerEntries[++lookAhead] &&
        powerEntries[lookAhead].Name.length == 0
      ) {
        fullPowerText += "\n\n" + powerEntries[lookAhead].Content;
      }
      return p.concat({
        Name: c.Name,
        Content: fullPowerText,
      });
    }
    return p;
  }, []);
}

/** The content divs for a section by heading; Traits also matches the heading-less lead block. */
function getPowerSection(element: Cash, type: string) {
  if (type == "Traits") {
    return element
      .find(".mon-stat-block-2024__description-block-content")
      .filter(
        (i, e) =>
          cash(e)
            .parent()
            .has(".mon-stat-block-2024__description-block-heading").length ==
            0 ||
          cash(e)
            .parent()
            .find(".mon-stat-block-2024__description-block-heading")
            .text() == "Traits"
      );
  }

  return element
    .find(".mon-stat-block-2024__description-block-content")
    .filter(
      (i, e) =>
        cash(e)
          .parent()
          .find(".mon-stat-block-2024__description-block-heading")
          .text() == type
    );
}
