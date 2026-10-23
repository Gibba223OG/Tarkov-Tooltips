# Building Tarkov Tooltips v1.00 from source

This repository is derived from FleaTooltip by sammereye:
https://github.com/sammereye/flea-tooltip

The source tree includes the edited Electron/React/TypeScript application, native
C++ helper sources, Python RapidOCR worker source, Tauri/Rust native popup source
and the Tauri frontend.

## Prerequisites

- Windows x64
- Node.js and npm compatible with Electron Forge 7 / Electron 32
- Rust toolchain with Windows target, for the Tauri 2 popup
- Visual Studio 2022 C++ build tools / Windows SDK
- Python, PyInstaller, RapidOCR and ONNX dependencies for OCR worker

## Build overview

- Run npm ci from the repository root to install Electron project dependencies.
- Run npm run package for Electron packaging step.
- The popup is built in tauri-popup/src-tauri with cargo build --release.
- Native C++ projects: lib/ocr_cpp, lib/configure_screen, lib/setalwaysontop.
- Python worker source: rapidocr_worker.py; PyInstaller spec: PriceCheckerRapidOCR.spec.
- The Electron packager copies lib/ocr into packaged resources. Native OCR
  executables and the Python OCR worker must be compiled and staged there first.
- The separately built Tauri popup executable also needs to be included in
  the final application resources.
- The exact complete v1.00 packaging pipeline has NOT been scripted here.
  npm run package on its own does NOT reproduce the full published portable ZIP.
- OCR language/model data, prebuilt executables and installed dependencies
  are intentionally not included in this source ZIP.
- Bender/Nunito fonts are intentionally not included in the prepared source
  upload; check their provenance and licenses before obtaining them. The app
  styles reference those fonts.
- No user configurations or machine-specific build products are included.

For a ready-to-run version, get the portable ZIP or online installer from Releases.

## Credits and licenses

Based on the FleaTooltip project by sammereye.
See CREDITS.md in this GitHub repository and THIRD_PARTY_LICENSES included here.
The original FleaTooltip package.json declares MIT; individual fonts/models/
third-party components may have different licensing.
