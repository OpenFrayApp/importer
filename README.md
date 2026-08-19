# OpenFray Importer

A browser extension that reads a **D&D Beyond monster page** and outputs an
**OpenFray `Creature` JSON** you can import into [OpenFray](https://openfray.app),
so monsters don't have to be re-typed by hand.

Open a monster's **Details** page, click the extension, and copy or download the
JSON. Spell references, structured attacks/saves, recharge, legendary actions, and
the flavor description are all mapped into OpenFray's schema.

## Install

```bash
npm install
npm run build           # Chrome  → output/chrome-mv3
npm run build:firefox   # Firefox → output/firefox-mv2
```

- **Chrome:** `chrome://extensions` → enable Developer mode → **Load unpacked** →
  `output/chrome-mv3`.
- **Firefox:** `about:debugging` → This Firefox → **Load Temporary Add-on** →
  `output/firefox-mv2/manifest.json`.

## Package for the stores

```bash
npm run zip           # Chrome  → output/openfray-ddb-import-<version>-chrome.zip
npm run zip:firefox   # Firefox → output/openfray-ddb-import-<version>-firefox.zip
```

Always use these, never the Finder's **Compress** on the build folder: macOS writes
resource-fork siblings into the archive (`__MACOSX/._*`), and AMO flags every one of
them as a hidden file.

`npm run zip:firefox` also writes `openfray-ddb-import-<version>-sources.zip`, the
source archive AMO asks for alongside the build.

## Building from source (add-on reviewers)

The shipped files are generated, so they can't be read as-is: **[wxt](https://wxt.dev)**
bundles the TypeScript/React sources with Vite and Rollup, minifies them with esbuild
in production, and compiles the styles with Tailwind and PostCSS. It also generates
`manifest.json`. Nothing else preprocesses the code, and no code is downloaded or
evaluated at runtime.

### Build environment

- **Operating system:** any that runs Node — built and verified on macOS 26.5
  (Apple silicon); Linux and Windows work equally well. The build script needs a
  POSIX shell, so on Windows use WSL or Git Bash, or run the two npm commands below
  directly.
- **Node.js 18 or newer** — verified on **24.15.0**. Install from
  <https://nodejs.org/en/download> (LTS installer), or with
  [nvm](https://github.com/nvm-sh/nvm): `nvm install 24 && nvm use 24`.
- **npm 9 or newer** — verified on **11.12.1**. It ships with Node, so installing
  Node is enough; `npm install -g npm@latest` upgrades it.
- **No other tools are required** — no compilers, no global packages, no network
  access beyond the npm registry.

### Build

```bash
bash scripts/build.sh         # Firefox → output/firefox-mv2
```

(Invoked via `bash` because zip archives don't carry the executable bit.)

That script is the whole process: it checks the Node version, runs `npm ci`, and
builds. If you'd rather run the steps yourself, they are exactly:

```bash
npm ci
npm run build:firefox
```

`npm ci` installs the exact versions pinned in `package-lock.json` (and runs
`wxt prepare`, which generates the TypeScript types under `.wxt/`). The build is
deterministic: from this archive it reproduces the submitted `output/firefox-mv2`
byte for byte.

### Where to read the code

The popup UI is `components/`; the page scraping is `utils/extractstatblock.ts`
(2014 stat-block layout) and `utils/get2024statblock.ts` (2024); and
`utils/statBlockToCreature.ts` maps a scraped block into OpenFray's schema.
`npm test` runs the converter's unit tests.

### A note on `npm audit`

`npm ci` reports advisories in the build toolchain — `wxt`'s browser-launching dev
runner (`web-ext-run`, `fx-runner`, `firefox-profile`) and its template downloader
(`giget`, `tar`). These are **devDependencies used only to build and to run a local
dev browser; none of them is part of the extension**. The three packages that ship
inside the bundle are `react`, `react-dom`, and `cash-dom`, none of which has an
advisory. Upgrading `wxt` to the current major doesn't clear them either — the same
transitive chain comes along — so the lockfile keeps the versions this build was
verified against.

Then open a monster's Details page on D&D Beyond and click the extension.

## Develop

```bash
npm run dev          # Chrome, live reload (keep this running)
npm run dev:firefox  # Firefox, live reload
npm test             # converter unit tests (node --test)
npm run compile      # tsc --noEmit
npm run icons        # regenerate public/icon/*.png from assets/icon.svg
```

The converter is `utils/statBlockToCreature.ts`; the scraping lives in
`utils/extractstatblock.ts` (2014 layout) and `utils/get2024statblock.ts` (2024).

### Limitations

- **Monster spellcasting** is parsed into OpenFray's structured spellcasting block
  for both editions: 2024 spellcasting actions, and 2014 spellcasting **traits** —
  innate (at-will / N-per-day) and prepared-slot casters alike.
- **Mythic actions** aren't mapped (OpenFray's schema has no equivalent).
- **Edition** follows the page layout the scraper read (2024 → 5.5, otherwise 5.0).
- The flavor description keeps headings, lists, and paragraphs; inline emphasis
  (bold/italic) is not preserved.

## Legal

This extension is an unofficial fan tool. It is **not affiliated with, endorsed,
sponsored, or approved by Wizards of the Coast or D&D Beyond.** *Compatible with
fifth edition.*

It ships **no game content** — no monster, spell, or other stat data is bundled in
this repository. It only reads the page you are currently viewing in your own
browser and reformats it into OpenFray's schema on your machine. Game content
remains the property of its respective rights holders, and you are responsible for
using it in accordance with D&D Beyond's Terms of Use and applicable copyright law.

## License

Released under the [MIT License](./LICENSE).
