Guidance for AI agents (and humans) working on the OpenFray Importer. The
[README](./README.md) covers what the extension does, building both browser
targets, and store packaging — read it first. This file adds the rules for
changing things.

## The working rules live with the app

This repo follows the main repo's
[AGENTS.md](https://github.com/SirDarcanos/openfray/blob/main/AGENTS.md) working
rules, with the license swapped out (this extension is **MIT**, not AGPL — no
license headers in source files, matching the existing files). In brief:

- **Code style:** self-explaining code; every named function and component opens
  with a one-line header comment saying what it does; no other comments unless the
  code can't say it (a why, a DDB-markup quirk, a workaround); one definition per
  concept.
- **Tests:** everything testable ships with tests, in `tests/` (`node --test`,
  run with `npm test`). Parsing is the heart of this extension — a parser change
  without a fixture-driven test is not done.
- **Committing:** one concern per commit, `Area: what changed` subjects (areas in
  use: `Popup`, `Options`, `Firefox`, `Chrome`, `Parse`, `Docs`, `Tests`,
  `Release`), DCO sign-off via `git commit -s`, authorship is human — never add AI
  co-author trailers — and don't push without the maintainer's go-ahead.
- **Copy:** user-facing text follows the app's `STYLE.md` (sentence case,
  **Game Master** never DM, "sign in" never "log in").

## Rules specific to this extension

1. **`utils/openfray/schema.ts` is a vendored copy** of the app's
   `Creature`/`Spell` types. The source of truth is the app repo — change it there
   first, then mirror it here. Never let the two drift; "Sync schema with the app"
   is its own commit.
2. **The user extracts their own page.** The extension reads the D&D Beyond
   monster page the user has open and converts it locally; it never fetches DDB
   itself, never scrapes in bulk, and never ships DDB content. Keep it that way —
   it is the legal posture as much as the design.
3. **Mechanics from prose only where unambiguous.** Attack/save lines that parse
   cleanly become structured fields; anything else stays a `utility` action with
   its prose intact. When in doubt, keep the prose — a wrong number is worse than
   a missing one (the GM can read; the roller can't unparse).
4. **Both targets stay green.** A change is done when `npm run build` (Chrome
   MV3) and `npm run build:firefox` (MV2) both succeed; `npm run compile` is the
   typecheck gate. Store metadata (the AMO id, data-collection declarations)
   lives in `wxt.config.ts` — treat it like the legal pages in the app repo:
   deliberate edits only.
5. **DDB markup changes are the maintenance burden.** When a parse breaks, fix it
   against a fixture captured from the real page (trimmed to the relevant
   markup), and keep the fixture in `tests/` so the regression stays caught.
