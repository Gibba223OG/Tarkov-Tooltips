# Build Tarkov Tooltips from maintained source (Windows x64)

This is the **only maintained editable source tree**. The historical folders were consolidated because the original v1.01 portable included release-only packaging not reproduced by the previous scripts. Git history retains earlier snapshots.

## What builds from source

- **Electron + React + Node.js:** checked-in TS/JS/HTML/CSS plus package-lock.json.
- **Qt popup:** qt-popup/prototype Python, QML, trader assets, quest data and the portable Qt PyInstaller spec.
- **RapidOCR:** rapidocr_worker.py and PriceCheckerRapidOCR.spec; model weights supplied by pinned pip dependencies.
- **C++ capture scanner:** lib/ocr_cpp/pricechecker_capture.cpp, not the obsolete Tesseract scanner; the VCXPROJ target was corrected.
- **C++ calibration:** lib/configure_screen/configure_screen.cpp, compiled with MSVC after removing two unused legacy OCR includes.

**External resources:** Bender/Nunito font files are recovered from the verified release into ignored local directories and are **not** checked into Git. The C++ calibration tool is independently built and VM-tested for its startup/EXIT handshake; its full in-game DPI and border-detection workflow still needs a user-PC test. No historical VM working directory is required by the build script.

## Prerequisites

Windows x64, Node/npm compatible with Electron 32 and Forge 7, Python 3.13, and Visual Studio 2022 Build Tools C++ workload/Windows SDK. The script downloads official NuGet nlohmann.json 3.12.0 with a pinned SHA-256 hash.

From PowerShell inside the maintained Tarkov-Tooltips-Source folder:

    py -3 -m venv .qt-venv
    .\.qt-venv\Scripts\python.exe -m pip install -r requirements-qt.txt
    py -3 -m venv .ocr-venv
    .\.ocr-venv\Scripts\python.exe -m pip install -r requirements-ocr.txt

Restore the *published reference release* to a fresh, short local path. This downloads/checks the official 1.01 portable SHA-256 and file count, without changing your existing working app:

    py -3 tools\restore_verified_release.py --destination C:\TTVerifiedRelease

Then execute the source build (one line shown to avoid PowerShell continuation escaping):

    py -3 tools\build_windows_from_source.py --qt-python .\.qt-venv\Scripts\python.exe --ocr-python .\.ocr-venv\Scripts\python.exe --release-dir C:\TTVerifiedRelease

The build uses a separate short temporary build folder, compiles scanner/calibration/Qt/RapidOCR, stages them into the local checkout, runs npm ci, TypeScript typechecking and Electron packaging, and checks that packaged native EXEs have the hashes of the newly compiled outputs.

Output: out/Tarkov Tooltips-win32-x64/. Test separately; do not replace a working installation.

## What was wrong and what changed

- The released runtime includes a Settings API/cache status panel, but the old source build did not package it. The build now copies the maintained renderer/status_panel.js into the proper main_window Webpack output and references it from editable HTML.
- models/TarkovLiveData.js is already byte-identical to the published v1.01 live_data.js module; the maintained source builds it through the app's normal Electron module integration, not a post-build minified-JavaScript patch.
- The old scanner VCXPROJ referenced obsolete Tesseract ocr_cpp.cpp rather than active pricechecker_capture.cpp; it has been corrected, and a tested direct MSVC compile is scripted.
- The Qt spec uses source-relative paths, embeds original QML/data/trader art, and expects external locally recovered fonts.

## Verification boundaries

A source compile plus an Electron VM startup test does not prove behavior is identical to the stable application inside Escape from Tarkov. Native EXE hashes may differ across compilers and PyInstaller invocations. Item prices, OCR under actual Tarkov capture, mouse positioning, quests, ammo, cache status and settings require user-PC testing before replacing the public stable application.

GitHub release assets 1.00 and 1.01 are not modified by source consolidation. The runtime-reference folder is an **audit reference**, not another editable source. Do not commit local fonts, compiled EXEs, ONNX weights, out, node_modules or PyInstaller output. Review third-party/trader-image redistribution rights before publishing those assets elsewhere.
