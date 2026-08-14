Guidance for AI agents (and humans) working on the OpenFray Importer. The
cross-repo agreements (code style, writing style, committing) live in the
[openfray repo's AGENTS.md](https://github.com/OpenFrayApp/openfray/blob/main/AGENTS.md).
**Read it before working here.** The [README](./README.md) documents the build,
store packaging, and reviewer instructions; this file carries the rules.

## What this repo is

A [WXT](https://wxt.dev) browser extension (React + TypeScript) that reads a D&D
Beyond **monster** page and outputs OpenFray `Creature` JSON. The scraping is
`utils/extractstatblock.ts` (2014 layout) and `utils/get2024statblock.ts` (2024);
`utils/statBlockToCreature.ts` maps a scraped block into OpenFray's schema.

```bash
npm run dev            # Chrome, live reload
npm test               # converter unit tests (node --test)
npm run compile        # tsc --noEmit
npm run build && npm run zip   # store packages; never Finder-compress the folder
```

## The rules

- **Monsters only, never characters.** Importing a character sheet would hand the
  console a player's build, which its scope principle forbids. The extension stays
  on the monster Details page.
- **No game content ships in this repo.** No monster, spell, or stat data is
  bundled or downloaded; the extension only reformats the page the user is already
  viewing, on their machine.
- **The output must match the console's schema.** Custom ids use the `custom:`
  prefix; the scraped book and page become `source`. When the console's `Creature`
  type moves, this repo follows in the same release.
- **License is MIT**, and the LICENSE keeps Evan Bailey's copyright line: the
  scraping started from his MIT code, and the notice travels with it.
- **Store zips come from `npm run zip` / `npm run zip:firefox` only.** macOS
  Finder writes `__MACOSX/._*` siblings into archives and AMO flags every one.

Commit subjects use the `App:` and `Tests:` areas.
