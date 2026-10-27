# Tarkov Tooltips v1.02 — tooltip dismissal fix

Promoted from the VM's v1.01.5 TEST application. Public GitHub release numbering advances from 1.01 to 1.02. This release contains the same portable runtime files as the user-tested 1.01.5 package. Source scope is limited to lib/ocr_cpp/pricechecker_capture.cpp and models/OCRProcess.ts.

- Detect a disappearing in-game item tooltip even if the mouse doesn't move: sample the active popup border every 180 milliseconds and hide after two consecutive absent samples.
- Drop pending OCR results on hide to avoid a delayed stale popup.
- No intended changes to prices, trader rates, item matching, quests, ammo, saved settings or overlays outside an active tooltip.

Validation: Clean build from maintained source (scanner, calibration, Qt, RapidOCR and Electron) and local VM startup passed for the 1.01.5 test. User subsequently confirmed the 1.01.5 version works in actual gameplay. The full range of supported monitor/DPI arrangements and long-term regression coverage have not been independently exhaustively tested.

Portable: Extract the entire ZIP into a new folder and run Tarkov Tooltips.exe. Online installer: downloads and verifies the separate release-specific payload ZIP; uses the stable application ID for upgrades. The earlier 1.01 release remains available for rollback.

Build prerequisites: See BUILD_WINDOWS.md. Required external licensed font files and OCR model weights are not committed as source code; use the documented pinned local reference-release restoration. This public repository does not include secret values or generated dependency caches.

Note: The internally compiled Electron package still carries its original package.json version metadata because the proven runtime was promoted unchanged. The GitHub release and installer version are 1.02.
