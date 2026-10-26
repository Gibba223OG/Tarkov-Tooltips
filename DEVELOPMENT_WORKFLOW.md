# Reproducible App Development and Release Standard

This repository uses **one authoritative editable source tree**, `Tarkov-Tooltips-Source/`. Git history holds prior source revisions. The published working portable is the behavior reference, **not** an editable source substitute.

This standard is intended for future work with ChatGPT/VM tooling. The operating rule is **Source → Clean Build → Differential Verification → User Test → Release → Cleanup**.

## 1. Never lose the source of truth

1. Identify the repository, default branch, last verified commit, current working release and requested change scope before editing.
2. Apply all product changes to maintained source files, build specs, configuration, assets and dependencies. Do **not** make changes only to a packaged executable, `app.asar`, `.webpack`, PyInstaller output or temporary working copy.
3. One-off fixes to generated code are diagnostic/temporary only. Before declaring success, port every fix into editable source/build definitions and verify the same change is produced by a fresh build.
4. Where a tool needs fonts, licensed assets or model weights that cannot be checked into Git, document the dependency, its source, allowed redistribution, pinned digest/version, and a complete reproducible restore procedure. Never quietly rely on an old VM work directory.
5. Keep all active subprojects (Electron, Qt/QML/Python, RapidOCR, C++ capture, calibration, assets, packaging/installer) mapped to the same versioned source tree. Avoid a second “full source” folder.

## 2. Build from a clean checkout

1. Read `Tarkov-Tooltips-Source/BUILD_WINDOWS.md` and its pinned tool versions.
2. Use a fresh Git checkout/temporary build workspace. Install declared dependencies; build *all* relevant native helpers rather than silently copying old builds.
3. Run type checks, compile/native build commands and packaging. Record the actual commands, exit codes, tool versions, commit SHA, and input/output artifact hashes.
4. Verify each packaged native helper SHA-256 equals the newly built executable from the same run; verify packaged JS, assets, fonts, data, and configuration are present.
5. Fail verification if the build depends on another work folder, an undocumented VM path, a missing binary, a broken project reference, or a post-build modification that is not generated from maintained source.
6. Build success or a log message indicating initial startup **does not** prove features or gameplay work.

## 3. Verify against the current working portable

1. Preserve the known-good baseline *unchanged*. Inventory both builds recursively and compare sizes and SHA-256s (enable Windows extended-length paths).
2. Inspect missing, extra, and different files. Treat binary differences as **findings**, not automatic evidence of feature changes; establish whether each difference is semantic, generated-output-only, dependency version change, or a real regression.
3. Compare Electron main/renderer/preload behavior, API and offline cache, Regular/PvE mode, Settings and IPC; check all standalone scripts and post-build injections from the reference have corresponding maintained implementations.
4. Run controlled paired tests for scanner and calibration protocols; OCR recognition on identical inputs; Qt price, trader/barter, ammo, FIR/quest rendering and popup positioning; representative cache/network states and cold-start behavior.
5. Compare screenshots pixel by pixel where deterministic, use functional assertions for nondeterministic output, and record any known difference or remaining untested path.
6. Isolate user configuration during VM tests when possible; don't accidentally migrate or overwrite stable app settings. Keep the known-good installation and published releases unchanged.

## 4. Test before promoting a new version

1. Deliver a **new, clearly labeled TEST build** in a separate folder. Transfer every file, then independently SHA-256 verify the transfer including long paths.
2. Include a short test/readme with build commit, baseline, what changed, minimum tests and rollback.
3. Run or request the real target-environment test for anything the VM cannot reproduce (especially Escape from Tarkov item hover, border capture, delays, location, prices, barter, quest/FIR and user settings).
4. Do not label a build “working,” “fully rebuilt,” “equivalent,” or “released” solely from compiling, VM launching, or synthetic tests. Distinguish **build verified**, **VM behavior verified**, **user/gameplay verified** and **published**.
5. If the user reports a regression, return to the working baseline, locate a reproducer, fix the maintained source, and repeat the build/verify/test cycle.
6. Publish to main/official release only after approved change scope and adequate verification. Avoid overwriting existing good release tags or binaries.

## 5. Cleanup after source publication and user verification

1. Treat local VM build folders as disposable only after verifying the authoritative repository can be cloned and rebuilt without depending on them, and the user has confirmed the new TEST build works.
2. Before deleting, audit every project subtree, its size and category: current source, uncommitted/unpushed changes, unique assets/fonts, release artifacts, user settings/data, logs/evidence, temporary outputs, archives and unrelated projects.
3. **Do not infer “it is on GitHub” means every local asset is recoverable.** Confirm remote branch/commit and recovery of any excluded dependency. Never delete unique or unpushed work, potentially restricted third-party assets, or the only known-good rollback.
4. When the user authorizes cleanup, restrict removal to the named project; use a manifest and strict allowlist, skip symlinks/junctions and locked files, leave unrelated projects and shared delivery folders alone. Verify every deletion and final free disk space.
5. Retain a concise `START_HERE.md` (project name, repo URL, verified commit/tag, build instructions link, working release, external asset dependencies, rollback, last verification date and known limitations). Historical details belong in Git history or release metadata, not piles of VM experiment folders.
6. Do not create recurring duplicate source snapshots as a replacement for Git. A new checkout or scratch build can be generated on demand.

## Verification example (2026-10-26)

Tarkov Tooltips repository source was consolidated into one maintained folder. All four native components and Electron built successfully; reference-vs-built comparison and deterministic Qt/OCR/scanner/Settings tests passed. The user subsequently confirmed the test portable **works in Tarkov**. That statement is user-confirmed operational behavior, not a claim of bit-identical app binaries or exhaustive feature testing. Third-party fonts remain external, with a documented pinned-release restore mechanism.

**A successful delivery is not the end of the workflow:** the final source commit and build instructions must remain recoverable; the old disposable VM work can then be deleted within the approved cleanup scope.
