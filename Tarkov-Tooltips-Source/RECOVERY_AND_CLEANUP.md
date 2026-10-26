# Recover Tarkov Tooltips from GitHub — Windows

This is the **VM-reset recovery path** for the public **v1.01** application. Source lives in this repository; the full Windows executable, Qt runtime and OCR models live in the **published v1.01 GitHub Release**. There is no requirement to preserve the old VM `node_modules`, `.webpack`, Rust `target`, `out`, or experimental build directories merely to reinstall the released app.

## 1. Fresh clone and working application restore

Requires Git and Python 3 on Windows. Use an ordinary local development folder, **not a VMware shared-folder execution directory**.

```powershell
git clone https://github.com/Gibba223OG/Tarkov-Tooltips.git
cd Tarkov-Tooltips\Tarkov-Tooltips-Source
python tools\restore_verified_release.py --destination "C:\TarkovTooltips-Restored-v1.01"
```

The destination **must not exist** and its parent must exist. The script downloads the **official v1.01 portable ZIP**, enforces the published size and SHA-256, checks every ZIP path against traversal, checks the expected file count and full unpacked size, and extracts the flat application to your chosen new destination. It does **not** launch the app, modify an installed version, or build from editable source.

If you have a previously downloaded portable ZIP, recover without downloading again:

```powershell
python tools\restore_verified_release.py --archive "C:\path\to\Tarkov-Tooltips-v1.01-Win64-Portable.zip" --destination "C:\TarkovTooltips-Restored-v1.01"
```

To validate a saved ZIP without extraction:

```powershell
python tools\restore_verified_release.py --archive "C:\path\to\Tarkov-Tooltips-v1.01-Win64-Portable.zip" --verify-only
```

The pinned official archive digest is `7fb863ec8906d0f07db602e8339d10e82a723f29f0f34094bdf53f2c33df1977`, with 1,897 regular application files. The pinned digest detects a changed or replaced GitHub release asset. Do not bypass it to “get a build working.”

## 2. Prepare a GitHub clone for editable Electron development

The repository includes the application's TypeScript/React, Qt/Python/QML, scanner C++ sources and exact shipped JS references. **The legacy v1.01 binary release was not compiled completely from these editable sources.** For development, the source's Electron Forge configuration expects two prebuilt native resource folders.

First complete Step 1. Then from `Tarkov-Tooltips-Source`:

```powershell
python tools\stage_native_from_verified_release.py --release-dir "C:\TarkovTooltips-Restored-v1.01"
npm.cmd ci
npm.cmd run package
```

The staging tool copies the known-good **OCR and Qt native runtimes and ten CSS font files** from the checksum-verified portable into `lib/ocr`, `qt-popup-dist/TarkovTooltipsQtPopup`, and `renderer/styles`. It refuses to overwrite modified files; repeating it accepts only identical existing assets. Those are generated/staged **binary artifacts**, ignored by Git; they are not substitutes for the editable C++ or Qt/Python source.

The Electron source relies on **Electron 32.1.2**, **Forge 7**, the `package-lock.json` lockfile, Windows tooling and appropriate Node/npm. On the Windows VM using Node 24.20.0, npm 11.19.0, and Python 3.13.15, **`npm.cmd ci`, TypeScript `tsc --noEmit`, and `npm.cmd run package` all passed** after staging the verified release assets. Do not imply the application or every native component is reproduced byte-for-byte until a clean package and behavioral checks pass.

If `npm.cmd run package` succeeds, the result is in the source checkout's `out` directory. **Do not publish a rebuilt executable as equivalent to the public v1.01 release solely because compilation passes.** Verify the native scanner, calibration, RapidOCR, Qt popup, item prices, quest flags, and regular/PvE caches.

## 3. What GitHub backs up — and what it does not

| Recovered from GitHub | Additional steps/limitations |
|---|---|
| Editable Electron TypeScript/React | Source published; build parity with released `app.asar` is not fully demonstrated |
| Native scanner source, Qt/Python/QML | Source published; standalone native rebuild is not fully automated |
| Public v1.01 portable Windows runtime | Verified by the pinned release checksum; includes native executables and OCR weights |
| Release installer and separate installer payload | Both published as v1.01 release assets; installer source also on GitHub |
| Exact released JS `runtime-reference/` | Reference for reconciling source and deployed behavior, not a replacement for proper source parity |
| Historical VM test builds and unreleased changes | **Not necessarily backed up**. Commit them or archive them separately before deleting the VM project |
| Private credentials / licensed Bender & Nunito fonts / third-party art | Do not upload secret data or redistribute without rights. Released binaries may contain licensed resources for their intended use; source licensing remains separate |

For deep source rebuild requirements, see [SOURCE_BUILDING.md](SOURCE_BUILDING.md) and [SOURCE_RUNTIME_MAPPING.md](SOURCE_RUNTIME_MAPPING.md). v1.00 source remains available through Git history, not a duplicate maintained folder; v1.00 released binaries stay at GitHub tag 1.00.

## 4. Before clearing a large VM project

1. Commit all new **editable** source, configs, assets with redistribution rights, scripts, manifests, and important test/decision records to GitHub; confirm the remote commit has them. GitHub `main` should be the project source of truth, not the last binary patch directory.
2. For each release, upload an installable/portable artifact to GitHub Releases and record its SHA-256. Confirm the public asset is retrievable and the recovery script works on a fresh checkout.
3. Confirm new GitHub source can at least run dependency installation and build tests; separately report unresolved native/behavioral parity. Maintain one verified rollback until parity is proven.
4. Preserve **any user-specific assets, credentials, proprietary content, third-party materials with unverified redistribution permission, unreleased experiments, and source-build tooling that is not yet on GitHub** in another approved backup location. Do not dump local VM state into a public repository.
5. Only after the checks succeed, remove *generated* build caches and redundant VM-local binaries. Keep project history/manifests and all user-provided originals unless separately authorized.

**Verification status (October 26, 2026):** The source snapshot was compared with GitHub `main`: no local v1.01 source file was missing from GitHub; two newer installer files exist only on GitHub. The source code comparison does not establish parity with the compiled portable. The checksum-verified ZIP restore completed in an isolated Windows VM folder and extracted all 1,897 files, both from the saved ZIP and from an actual HTTPS download of the public GitHub Release. A clean GitHub checkout also passed npm dependency installation, TypeScript checking, and Electron packaging with recovered native dependencies and fonts. **Behavioral parity with the public v1.01 build and independent compilation of native sidecars remain unverified.** The VM project's `Diagnostics/Evidence` contains the detailed test results.
