# Tarkov Tooltips v1.00 source (Qt + Wiki ammo fix)

This source tree matches the Electron/React application, Qt Quick/PySide6 tooltip sidecar, native C++ OCR helpers, and RapidOCR worker that produced the v1.00 portable package. The old Tauri helper is superseded and removed.

Windows dependencies: Node.js/npm compatible with Electron 32 and Electron Forge 7; Windows C++ build tools; Python 3.13; PySide6-Essentials 6.10.3 and PyInstaller; RapidOCR and ONNX models for the OCR sidecar.

- Run npm ci, then npm run package for Electron.
- The packager requires a complete Qt runtime at qt-popup-dist/TarkovTooltipsQtPopup and an OCR runtime at lib/ocr.
- Qt source code is under qt-popup/prototype/python, the user-tested QML files under qt-popup/prototype/qml, and static quest data under qt-popup/prototype/data.
- The Qt helper executable was generated with PyInstaller and the 6.10.3 Essentials wheel; its runtime requires prototype/qml and prototype/data under the PyInstaller _internal directory, plus licensed Bender and Nunito font assets under assets/fonts.
- Font binaries, OCR models, prebuilt executables, local credentials, dependencies, and build outputs are not part of this public source archive.

The complete reproducible pipeline for compiling all native OCR and Qt components is NOT supplied here; running npm run package alone will not reproduce the final distributed ZIP until required native components are built and staged.

Ammunition data: models/AmmoWikiParser.ts recognizes the two actual Ballistics Wiki table formats, reads the Wiki's six armor class ratings directly, and preserves multi-projectile damage strings such as 8x39. models/AmmoWikiExpandedSeed.ts includes 42 rows from the Wiki omitted by the previous parser. The original 148 seed records remain unchanged. An old v1 ammo cache is ignored in favor of the validated v2 cache.

Audit dated 2026-10-23: 190 Wiki Ballistics records match 186 of 200 items classified as ammunition by Tarkov's item catalog. Grenades, signal flares and one regular bullet (.50 AE FMJ Bull) remain without matching Wiki rows; the app does not invent values.

See CREDITS.md and THIRD_PARTY_LICENSES. Based on FleaTooltip by sammereye: https://github.com/sammereye/flea-tooltip
