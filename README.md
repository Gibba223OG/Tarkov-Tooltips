# Tarkov Tooltips 1.01

**Tarkov Tooltips** is an unofficial Windows OCR overlay for *Escape from
Tarkov*. It recognizes item tooltips in-game and displays flea prices,
best sell trader, quest requirements and ammunition statistics.

## Download

Download **Tarkov-Tooltips-v1.01-Win64-Portable.zip** from
[Release 1.01](https://github.com/Gibba223OG/Tarkov-Tooltips/releases/tag/1.01).
Extract into a new folder and run `Tarkov Tooltips.exe`.

The v1.00 online installer is retained only under the historical
[v1.00 release](https://github.com/Gibba223OG/Tarkov-Tooltips/releases/tag/1.00);
it does **not** install 1.01. Version 1.01 provides a portable ZIP only.

## Setup

1. Launch Tarkov Tooltips and Escape from Tarkov.
2. Open your inventory and press **F2** to begin screen calibration.
3. Hover an item and keep the pointer still when its game tooltip appears.
4. Press F2 to scan the border. Do not move the mouse while it scans.
5. At "Calibration complete", press F2 again to restart/apply settings.

Press **F1** to show or hide Settings.

## New in 1.01

- **Tarkov.dev** for live item prices, quests and trader barter-input uses.
- **Persistent validated caches** with last-good fallback across restarts
  and separate Regular/PvE data.
- **Quest indicators:** API item requirements and FIR quantities; limited
  key/special-slot supplement; Gunsmith weapon-build objectives excluded.
- **Trader portraits and currencies:** Peacekeeper uses $, others use ₽.
- **Barter-exchange marker** for items used in at least one trader barter.
- **Settings API/cache status**, with Calibration instructions first.
- **Tarkov Wiki ammo status** now records successful live verification.
- Compact Qt popup visual adjustments, including a 2-logical-pixel lower
  trader margin addition over the latest internal test.

## Source

[Version 1.01 source](https://github.com/Gibba223OG/Tarkov-Tooltips/tree/main/Tarkov-Tooltips-v1.01-Source)
contains current Qt/data source and exact released JavaScript runtime
reference. Read **SOURCE_BUILDING.md** for native dependencies and the
important qualification that a clean-source reproducible build has not
yet been established.

## Verification

The release was tested with Qt snapshots, regular/PvE cache and quest
checks, Electron startup and native OCR launch in a Windows VM. **Live
in-game behavior on the user's PC remains unverified.**

Based on [FleaTooltip by Sammer](https://github.com/sammereye/flea-tooltip).
Not affiliated with Battlestate Games.
