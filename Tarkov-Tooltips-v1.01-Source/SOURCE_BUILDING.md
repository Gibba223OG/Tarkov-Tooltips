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

## v1.01 testing

- Compared packaged price, quest and unmatched Qt renderings to internal
  v1.01.4: price-only +2 Qt logical pixels (+3 rendered pixels at the VM's
  55% scale); quest and unmatched geometry unchanged.
- Earlier regular/PvE quest API, offline-cache and executable startup tests
  remain recorded in the project history.
- Live Tarkov gameplay behavior has not been independently reproduced.

Project inherited from FleaTooltip by sammereye.
See top-level CREDITS.md and THIRD_PARTY_LICENSES.
