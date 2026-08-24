# Changelog

All notable changes to OpenFray Importer are documented here.

## [1.0.1] (2026-08-24)

- The Gear line of a 2024 stat block now imports. A Bandit Captain arrives carrying its
  studded leather, scimitar and daggers, where before the equipment was read off the page
  and dropped. OpenFray lists it beside the block; carrying it does nothing on its own.
- 2024 monsters with a negative Initiative imported as 5e instead of 5.5. D&D Beyond
  writes negative numbers with a Unicode minus sign that the parser could not read.
  The Beholder Zombie is one, along with every creature of Dexterity 9 or lower.
- Negative saving throws, skill modifiers, and attack bonuses now import. So do damage
  rolls and hit-point formulas that carry a negative modifier, such as `(1d4 − 1)`,
  which were dropped from the creature.
- Eye rays import as separate rollable actions, each with its own saving throw and
  damage. The Beholder's ten arrived as a single action holding every ray's damage.
  The Beholder Zombie's four did not arrive.

## [1.0.0]

- First stable release.
- Firefox: declare the add-on id and `data_collection_permissions` (none — the page is
  read and converted on your machine, nothing leaves the browser), both required by AMO.
- Popup: the creature name no longer gets squeezed out of view by a long stat block.
- Popup: Options moved to a cog in the header.

## [0.1.0]

- Initial commit.
