# Source building — canonical checkout

The only maintained editable source is this Tarkov-Tooltips-Source directory.
See [BUILD_WINDOWS.md](BUILD_WINDOWS.md) for the Windows build entrypoint,
its pinned dependencies, third-party assets and precise limitations.

The 2026-10-26 verification independently rebuilt Qt, RapidOCR and the
active C++ scanner and calibration utility; Electron source compiled and launched on the VM.
The canonical renderer build now packages the missing Settings API/cache
status panel directly from editable source rather than altering bundled JS.

Not claimed: bit-for-bit match to released binaries, full real-gameplay
equivalence.

Prior source snapshots and published runtime-reference code remain accessible
through Git history. Do not maintain multiple parallel source directories.
