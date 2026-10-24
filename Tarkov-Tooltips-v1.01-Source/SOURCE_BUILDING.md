# Tarkov Tooltips 1.01 — source and build notes

This is the 1.01 Windows release source snapshot. It includes the historical
Electron/React TypeScript project, the latest PySide6/Qt popup source, the
live Tarkov.dev cache/data module, and copies of the **exact compiled
JavaScript runtime** from the public 1.01 portable ZIP for auditability.

## Key locations

- `models/TarkovLiveData.js` — active Tarkov.dev item, quest and barter API,
  validation, regular/PvE persistent last-known-good caches and IPC status.
- `models/Items.ts` and `models/QtPopupBridge.ts` — TypeScript integration
  surfaces for item loading and Qt payload enrichment.
- `qt-popup/prototype/python/qt_popup.py` — quest filtering (API first,
  legacy requirements only for keys/special-slot items; no Gunsmith quests).
- `qt-popup/prototype/qml/PriceCard.qml` — **exact file in the 1.01 ZIP**,
  including portraits, bold currency, barter icon, and +2 logical pixel
  bottom trader padding relative to the last internal test build.
- `qt-popup/prototype/data/quest_fallback_categories.json` — item IDs and
  type categories for the limited static quest supplement.
- `renderer/status_panel.js` — Settings-only API status.
- `runtime-reference/` — original released `.webpack` JS bundle excerpt,
  including the running main process, preload, renderer and HTML. This is
  preserved to distinguish distributed behavior from editable source.

## Important reproducibility limitation

The portable was created by verified binary-preserving updates to the
existing Electron/Qt/native build, **not** from a clean rebuild of the
TypeScript repository. The TypeScript project has been updated to reflect
active v1.01 integration points, but not independently verified to recreate
an identical portable ZIP. The exact shipped JS can be inspected under
`runtime-reference`. Some third-party/native components need separate
build/install steps.

For a full rebuild, supply Node.js/npm compatible with Electron 32 and Forge 7,
Windows C++ build tools, Python 3.13, PySide6 Essentials and PyInstaller,
RapidOCR and its ONNX model weights, and all runtime resources expected by
Forge. `npm ci` then `npm run package` packages Electron only after
the Qt and native OCR helpers have been built and correctly staged. It does
not independently reproduce the bundled EXEs/model weights.

The public source excludes licensed Bender/Nunito font binaries, OCR models
and compiled application runtimes other than the small JavaScript audit
reference. The trader portrait set was user supplied; redistribution
permissions for artwork are not independently established. Do not assume
that game artwork or third-party assets are freely relicensable.

## v1.01 online installer

The installer source is `installer/TarkovTooltips-v1.01-Online.iss`.
It uses Inno Setup 6.7.3 with the same AppId as v1.00 for normal
upgrade/uninstall identity. It downloads the *flat* installer payload:

`https://github.com/Gibba223OG/Tarkov-Tooltips/releases/download/1.01/Tarkov-Tooltips-v1.01-Win64-InstallerPayload.zip`

Installer payload SHA-256: `e968312dc5ab178f6e9c13bda00c66aba3a5381b0a19e65a5f9d555bed39b23c`.
The flat ZIP contains the same 1,897 application files as the separately
published portable ZIP, but has no common enclosing directory, allowing
Inno to extract directly into the selected install folder. Users should
not download the installer payload separately.

The small EXE has been built with Inno Setup; this source script has
local absolute `SetupIconFile`/`OutputDir` paths from the build VM, so
adjust those two paths when building elsewhere. For an identical release,
keep the stable AppId and the pinned download URL, payload size/hash.
Do not use the regular portable ZIP as the installer download; its
top-level directory creates broken installed paths.

Validation in a Windows VM used an isolated *test-only AppId* rather
than overwriting an existing v1.00 install. A live HTTPS download from
GitHub, checksum verification, extraction of all 1,897 files with SHA-256
comparison, and silent uninstall all passed. An actual upgrade from a
previous installed v1.00 has not been tested. See project's installer
test records for the isolated-build distinction.

## v1.01 testing

- Compared packaged price, quest and unmatched Qt renderings to internal
  v1.01.4: price-only +2 Qt logical pixels (+3 rendered pixels at the VM's
  55% scale); quest and unmatched geometry unchanged.
- Earlier regular/PvE quest API, offline-cache and executable startup tests
  remain recorded in the project history.
- Live Tarkov gameplay behavior has not been independently reproduced.

Project inherited from FleaTooltip by sammereye.
See top-level CREDITS.md and THIRD_PARTY_LICENSES.
