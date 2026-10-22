# Tarkov Tooltips

**A compact, automatic item-price and ammo overlay for Escape from Tarkov on Windows.**

Hover over an item to see useful information without switching to another website. Tarkov Tooltips uses screen capture and OCR to recognize on-screen item names and displays the results in a small desktop popup.

> **Based on [FleaTooltip by Sammer (@sammereye)](https://github.com/sammereye/flea-tooltip).** This project began as a modified version of Sammer's work, with a redesigned overlay, new settings and additional functionality. Thanks to Sammer for the original application and source code. See [Credits & attribution](CREDITS.md).

## Download and install

When a release is published, go to **[Releases](https://github.com/Gibba223OG/Tarkov-Tooltips/releases)** to download it.

| Option | How it works |
| --- | --- |
| **Portable ZIP** | Download, extract into any folder, and run `Tarkov Tooltips.exe`. No installation needed. |
| **Small online installer (planned)** | Run a small setup program, select an installation folder, and have it download the application from GitHub Releases. The installed application uses the same files and folder layout as the portable version. |

**Note:** The GitHub releases page may be empty until the packages are uploaded. The online installer is not published yet. It will require a public repository/release so people can download the app without signing in.

## What does it show?

- **Item prices and best trader:** flea-market prices and the best trader to sell an item to, where data is available.
- **Quest requirements:** how many of a matching item you need, along with its quest.
- **Ammunition:** damage, penetration, and visual ratings for armor classes 1–6 based on Wiki-derived data.
- **PvE pricing:** optional PvE mode.
- **On-screen popups:** separate scales for normal items and ammunition, customizable background and border colors, and a bold-price setting.

## Getting started

1. Start **Tarkov Tooltips**.
2. Press **F1** to show or hide Settings.
3. Try **Test Price Popup**, **Test Quest Popup**, and **Test Ammo Popup**. You can test the design and size without running the game.
4. Open Tarkov and hover over inventory items. If detection needs calibration, press **F2** and follow the on-screen prompts.

### Controls

| Shortcut | Action |
| --- | --- |
| **F1** | Show / hide Settings |
| **F2** | Calibrate popup detection |

To quit completely, use **Quit Tarkov Tooltips** from the Windows system tray.

## Popup settings

- **Main Popup Scale:** 25–100%, default **55%**. The original main popup size is at the **50%** position.
- **Ammo Popup Scale:** 25–100%, default **45%**. Full-size ammunition popup is at the **100%** position.
- **Bold price:** enabled by default. Trader initials and quest quantities are always bold.
- **Colors:** background and border color pickers appear beside a live preview.

The scaling sliders are grouped with the three popup test buttons so you can quickly check changes.

## Important notes

- **Windows 64-bit** desktop application using Electron and a Tauri/WebView2 popup.
- Settings remain in `%APPDATA%\PriceChecker` for compatibility with older versions. Changing the installation folder does not reset them.
- Fully quit an earlier version from its system tray before launching another one.
- The overlay uses on-screen image recognition. It is not part of the game, and it is **not affiliated with or endorsed by Battlestate Games**.
- An unsigned Windows build may show a security warning. Only download releases from this repository.

## Credits

**Original application:** [FleaTooltip](https://github.com/sammereye/flea-tooltip) by [Sammer (@sammereye)](https://github.com/sammereye). Tarkov Tooltips is a modified derivative of that project, not a from-scratch replacement. The original project's `package.json` identifies its license as MIT; see [credits and licensing details](CREDITS.md) and the original repository.

Game names, trademarks and related assets belong to their respective owners.
