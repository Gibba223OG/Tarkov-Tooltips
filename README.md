# Tarkov Tooltips v1.00

**Tarkov Tooltips** is an in-game overlay for *Escape from Tarkov* that automatically identifies items and displays useful information, including market prices, the best trader to sell to, quest requirements, and ammunition statistics.

Get the information you need without constantly switching to external websites.

## Initial Setup — Screen Calibration

After installing the app, calibrate it to recognize where Tarkov's item tooltips appear on your screen:

1. Launch **Tarkov Tooltips** and open *Escape from Tarkov*.
2. Open your inventory and press **F2** once to start calibration.
3. Hover over an item until **Tarkov's own item tooltip** appears. **Keep the mouse completely still.**
4. Once Tarkov Tooltips shows that calibration is ready, press **F2** again to scan the tooltip border. **Do not move the mouse until the scan finishes.**
5. When you see **Calibration complete**, press **F2** a third time. Tarkov Tooltips will restart and apply the saved calibration.

You can repeat these steps with **F2** whenever you need to recalibrate.

## Features

- **Automatic Item Recognition** — Uses OCR to detect items when hovering over them in-game.
- **Flea Market Prices** — Displays item prices directly in the tooltip.
- **Best Trader to Sell To** — Identifies the trader offering the best selling price for an item.
- **Quest Requirements** — Shows which quests require an item and how many are needed.
- **Ammunition Statistics** — Displays damage, penetration, and visual effectiveness ratings against armor classes 1–6.
- **PvE Support** — Switch between regular and PvE market pricing.
- **Customizable Popups** — Independently adjust the size of normal item and ammunition tooltips.
- **Appearance Settings** — Customize background and border colors, with a live preview and optional bold pricing.
- **Tooltip Popup Testing** — Preview price, quest, and ammunition popups without launching Tarkov.
- **System Tray Support** — Keep the application running with Settings hidden.

The current v1.00 uses the native **Qt Quick popup renderer**. Ammo charts use the Tarkov Wiki's Ballistics table including multi-projectile damage rows. See the v1.00 Source folder for source and build requirements.

## Downloads

### Online Installer (.exe)

- Small download (~2.5 MB).
- Automatically downloads the application from GitHub.
- Choose your preferred installation directory.
- Creates shortcuts and provides an uninstaller.

### Portable Version (.zip)

- No installation required.
- Extract the ZIP into any folder.
- Launch `Tarkov Tooltips.exe`.

Both versions provide the same functionality.

## Controls

| Key    | Function                    |
| ------ | --------------------------- |
| **F1** | Show / hide Settings        |
| **F2** | Calibrate tooltip detection |

## Credits

Tarkov Tooltips is based on the original open-source project **[FleaTooltip by Sammer (@sammereye)](https://github.com/sammereye/flea-tooltip)**.

Special thanks to Sammer for developing and sharing the original application that served as the foundation for this project.

---

*This is an unofficial community application and is not affiliated with or endorsed by Battlestate Games.*
