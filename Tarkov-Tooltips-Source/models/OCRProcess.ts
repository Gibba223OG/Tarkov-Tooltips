import { screen, app, BrowserWindow } from "electron";
import { spawn, ChildProcessWithoutNullStreams } from "child_process";
import TooltipWindow from "./TooltipWindow";
import QtPopupBridge from "./QtPopupBridge";
import Items from "./Items";
import IpcConstants from "./IpcConstants";
import path from "path";
import fs from "fs";
import { isDev } from "../utils";
import koffi from "koffi";
import log from "electron-log";
import Item from "./Item";
import AmmoWikiData from "./AmmoWikiData";
import { getUserConfigData } from "../main/services/config";

// Case-insensitive exact full OCR readings to hide, not substring/fuzzy matches.
const IGNORED_OCR_READINGS: ReadonlySet<string> = new Set([
  "all",
  "barter items",
  "weapon parts & mods",
  "functional mods",
  "gear mods",
  "vital parts",
  "weapon",
  "weapons",
  "assault carbines",
  "assault rifles",
  "bolt-action rifles",
  "grenade launchers",
  "machine guns",
  "marksman rifles",
  "melee weapon",
  "melee weapons",
  "pistols",
  "shotguns",
  "special weapons",
  "submachine guns",
  "throwables",
  "ammo",
  "ammo packs",
  "rounds",
  "magazine",
  "magazines",
  "drinks",
  "food",
  "injectors",
  "injury treatment",
  "medkits",
  "maps",
  "keys",
  "electronic keys",
  "mechanical keys",
  "meds",
  "info items",
  "notes",
  "special equipment",
  "grenade",
  "goggles",
  "container",
  "armor",
  "found in raid",
]);

export default class OCRProcess {
  constructor(items: Items, priceListWindow: BrowserWindow, private readonly ammoWiki: AmmoWikiData) {
    this.priceListWindow = priceListWindow;
    this.items = items;
    this.itemNamesLowerCaseList = this.items.items.map((item) =>
      item.name.toLowerCase()
    );
  }

  public tooltipWindow: TooltipWindow | null;
  public tauriPopup: QtPopupBridge | null = null;
  protected priceListWindow: BrowserWindow;
  protected items: Items;
  protected itemNamesLowerCaseList: string[] = [];
  // Invalidates a pending popup-show callback when the cursor moves away.
  protected tooltipVisibilityToken = 0;
  // Avoid repeatedly hiding and re-showing the same item under the cursor.
  protected currentTooltipItemId: string | null = null;
  protected scannerProcess: ChildProcessWithoutNullStreams | null = null;
  protected rapidWorker: ChildProcessWithoutNullStreams | null = null;
  protected scannerBuffer = "";
  protected workerBuffer = "";
  protected nextCaptureId = 1;
  protected pendingCaptures = new Map<number, { path: string; coords: string }>();
  protected lastOcrText = "";
  protected lastOcrMs = 0;
  protected user32: koffi.IKoffiLib;
  protected Point: koffi.IKoffiCType;

  public setPriceListWindow(priceListWindow: BrowserWindow): void {
    this.priceListWindow = priceListWindow;
  }

  getMousePos(): { x: number; y: number } | null {
    const GetCursorPos = this.user32.func(
      "int __stdcall GetCursorPos(_Out_ POINT *pos)"
    );

    // Get and show cursor position
    const pos = {};
    try {
      if (!GetCursorPos(pos)) throw new Error("Failed to get cursor position");
      return pos as { x: number; y: number };
    } catch (error) {
      console.error("Error getting cursor position:", error);
      return null;
    }
  }

  // Convert physical pixel coordinates to logical (DPI-scaled) coordinates for Electron
  getLogicalPosition(
    physicalX: number,
    physicalY: number
  ): { x: number; y: number } {
    // Get the display containing the cursor
    const display = screen.getDisplayNearestPoint({
      x: physicalX,
      y: physicalY,
    });
    const scaleFactor = display.scaleFactor;

    return {
      x: Math.round(physicalX / scaleFactor),
      y: Math.round(physicalY / scaleFactor),
    };
  }

  // Scanner provides the original game's cropped tooltip bitmap. The
  // independent, persistent RapidOCR worker recognizes it (no Tesseract).
  protected onScannerChunk(data: Buffer | string): void {
    this.scannerBuffer += data.toString();
    let newline: number;
    while ((newline = this.scannerBuffer.indexOf("\n")) >= 0) {
      const line = this.scannerBuffer.slice(0, newline).trim();
      this.scannerBuffer = this.scannerBuffer.slice(newline + 1);
      if (line.startsWith("CAPTURE||")) {
        const parts = line.split("||");
        if (parts.length >= 3) this.queueRapidOCR(parts[1], parts[2]);
      } else if (line.startsWith("SCAN_BORDER||")) {
        // Diagnostic only: never pass border traces to item matching.
        log.info(line);
      } else if (line) {
        this.onNewData(line);
      }
    }
  }

  protected queueRapidOCR(imagePath: string, coords: string): void {
    if (!imagePath || !this.rapidWorker || !this.rapidWorker.stdin.writable) {
      try { if (imagePath) fs.unlinkSync(imagePath); } catch { /* ignore */ }
      return;
    }
    const id = this.nextCaptureId++;
    this.pendingCaptures.set(id, { path: imagePath, coords });
    if (this.pendingCaptures.size > 8) {
      const first = this.pendingCaptures.keys().next().value as number;
      const old = this.pendingCaptures.get(first);
      this.pendingCaptures.delete(first);
      if (old) fs.unlink(old.path, () => {});
    }
    this.rapidWorker.stdin.write(JSON.stringify({ id, path: imagePath }) + "\n");
  }

  protected onRapidWorkerChunk(data: Buffer | string): void {
    this.workerBuffer += data.toString();
    let newline: number;
    while ((newline = this.workerBuffer.indexOf("\n")) >= 0) {
      const line = this.workerBuffer.slice(0, newline).trim();
      this.workerBuffer = this.workerBuffer.slice(newline + 1);
      if (!line) continue;
      let message: any;
      try { message = JSON.parse(line); } catch { continue; }
      if (message.type === "ready") {
        log.info("PriceChecker RapidOCR worker ready");
        continue;
      }
      if (message.type === "fatal") {
        log.error("PriceChecker RapidOCR failed:", message.error);
        continue;
      }
      if (message.type !== "result" || typeof message.id !== "number") continue;
      const request = this.pendingCaptures.get(message.id);
      if (!request) continue;
      this.pendingCaptures.delete(message.id);
      fs.unlink(request.path, () => {});
      const raw = typeof message.text === "string" ? message.text : "";
      this.lastOcrText = raw || "(no text detected)";
      this.lastOcrMs = Number.isFinite(message.ms) ? message.ms : 0;
      if (message.error) log.warn("RapidOCR job:", message.error);
      // The original matching and popup-position logic processes recognized text.
      this.onNewData((raw || "(no text detected)") + "||" + request.coords);
    }
  }

  public dispose(): void {
    if (this.scannerProcess && !this.scannerProcess.killed) this.scannerProcess.kill();
    if (this.rapidWorker && !this.rapidWorker.killed) this.rapidWorker.kill();
    for (const pending of this.pendingCaptures.values()) {
      fs.unlink(pending.path, () => {});
    }
    this.pendingCaptures.clear();
  }

  initialize(): void {
    this.user32 = koffi.load("user32.dll");
    this.Point = koffi.struct("POINT", {
      x: "long",
      y: "long",
    });

    // Get RGB border color values from config
    const userConfig = getUserConfigData();
    const redValue = userConfig.borderColorRed ?? 82;
    const greenValue = userConfig.borderColorGreen ?? 89;
    const blueValue = userConfig.borderColorBlue ?? 90;

    isDev()
      ? console.log(
          "Initializing OCR process with values:",
          redValue,
          greenValue,
          blueValue
        )
      : log.info("Initializing OCR process");

    const workerExe = isDev()
      ? path.join(app.getAppPath(), "lib", "ocr", "rapidocr_worker", "PriceCheckerRapidOCR.exe")
      : path.join(process.resourcesPath, "ocr", "rapidocr_worker", "PriceCheckerRapidOCR.exe");
    try {
      this.rapidWorker = spawn(workerExe, [], {
        cwd: path.dirname(workerExe),
        windowsHide: true
      });
      this.rapidWorker.stdout.on("data", this.onRapidWorkerChunk.bind(this));
      this.rapidWorker.stderr.on("data", (data) => log.warn("RapidOCR:", data.toString().trim()));
      this.rapidWorker.on("error", (err) => log.error("RapidOCR process error:", err));
      this.rapidWorker.on("exit", (code) => log.warn("RapidOCR process exited:", code));
      app.once("before-quit", () => this.dispose());
    } catch (error) {
      log.error("Unable to start RapidOCR worker:", error);
    }

    // const ocrProcess = ;
    const ocrProcess = isDev()
      ? spawn(path.join(app.getAppPath(), "/lib/ocr/ocr_cpp.exe"), [
          redValue.toString(),
          greenValue.toString(),
          blueValue.toString(),
        ])
      : spawn(path.join(process.resourcesPath, "/ocr/ocr_cpp.exe"), [
          redValue.toString(),
          greenValue.toString(),
          blueValue.toString(),
        ], { cwd: path.join(process.resourcesPath, "ocr") });

    this.scannerProcess = ocrProcess;
    ocrProcess.stdout.setEncoding("utf-8");
    ocrProcess.stdout.on("data", this.onScannerChunk.bind(this));
    ocrProcess.stderr.on("data", function (data) {
      isDev() ? console.log("stderr: " + data) : log.error("stderr: " + data);
    });

    ocrProcess.on("close", function (code) {
      isDev()
        ? console.log("closing code: " + code)
        : log.info("closing code: " + code);
    });

    isDev()
      ? console.log("Successfully initialized OCR process")
      : log.info("Successfully initialized OCR process");
    return;
  }

  onNewData(data: any): void {
    try {
      if (data.includes("IGNORE||NO CONFIG FILE FOUND")) {
        this.priceListWindow.webContents.send(
          IpcConstants.ScreenConfigureNeeded
        );
        return;
      }

      const text = new String(data);
      const incomingData = text.toString().trim();
      if (incomingData === "MOUSEMOVE") {
        // A capture can finish in RapidOCR after the game's border vanished.
        // Drop those orphaned jobs so a late response cannot re-show a stale item.
        for (const capture of this.pendingCaptures.values()) {
          fs.unlink(capture.path, () => {});
        }
        this.pendingCaptures.clear();
        this.tooltipVisibilityToken++;
        this.currentTooltipItemId = null;
        if (this.tauriPopup) this.tauriPopup.hide();
        if (this.tooltipWindow && !this.tooltipWindow.isDestroyed()) {
          this.tooltipWindow.webContents.send(
            IpcConstants.NewTooltipItem,
            null
          );
          this.tooltipWindow.hide();
        }
      } else if (incomingData.includes("||")) {
        // eslint-disable-next-line no-control-regex
        const incomingDataCleanedUp = incomingData.replace(/\r/g, "");
        const fields = incomingDataCleanedUp.split("||");
        let itemName = fields[0];
        const coords = fields[1];
        const diagId = fields[2]?.startsWith("DIAG:")
          ? fields[2].slice(5).trim() : "";
        const x = parseInt(coords.split(",")[0]);
        const y = parseInt(coords.split(",")[1]);
        // Reject UI category labels before item database matching.
        // Trim outer whitespace and ignore casing only; do not fuzzy-match exclusions.
        if (IGNORED_OCR_READINGS.has(itemName.trim().toLowerCase())) {
          this.tooltipVisibilityToken++;
          this.currentTooltipItemId = null;
          if (this.tauriPopup) this.tauriPopup.hide();
          if (this.tooltipWindow && !this.tooltipWindow.isDestroyed()) {
            this.tooltipWindow.webContents.send(IpcConstants.NewTooltipItem, null);
            this.tooltipWindow.hide();
          }
          return;
        }

        let item: Item | null = null;
        // Fuzzy remains enabled regardless of saved legacy toggle state.
        const fuzzyEnabled = true;

        if (
          !itemName.toLowerCase().includes("thicc") &&
          !itemName.toLowerCase().includes("junk") &&
          !itemName.toLowerCase().includes("items case")
        ) {
          if (this.itemNamesLowerCaseList.includes(itemName.toLowerCase())) {
            // Route exact names through the same duplicate-name verification.
            item = this.items.search(itemName, 0, fuzzyEnabled);
          } else {
            if (itemName.includes("WD-40 (1")) {
              itemName = "WD-40 (100ml)";
            } else if (itemName.includes("WD-40 (4")) {
              itemName = "WD-40 (400ml)";
            }

            if (itemName.toLowerCase().includes("kektape")) {
              itemName = "kektape";
            }

            if (itemName.toLowerCase().includes("pc cpi")) {
              itemName = "pc cpu";
            }

            if (itemName.toLowerCase().includes("mule")) {
              itemName = "M.U.L.E stimulant injector";
            }

            const allowedLowerScoreItems = [
              "magnet",
              "arena",
              "cult",
              "poste",
              "kektape",
              "military",
              "matche",
              "sewing",
              "key tool",
            ];

            if (this.items && this.items.search) {
              const userConfig = getUserConfigData();
              item = this.items.search(
                itemName,
                allowedLowerScoreItems.filter((i) =>
                  itemName.toLowerCase().includes(i)
                ).length > 0
                  ? 12
                  : userConfig.lowestAcceptableScore ?? 50,
                fuzzyEnabled
              );
            }
          }
        }

        // Diagnostic-only audit, including failures: coordinates and unique
        // capture ID pair this decision to the exact OCR input BMP and raw text.
        // At most 60 BMPs are written per helper session by the C++ process.
        if (diagId) {
          try {
            const output = path.join(process.resourcesPath, "ocr", "OCR-Diagnostics");
            fs.mkdirSync(output, { recursive: true });
            fs.appendFileSync(path.join(output, "match-results.ndjson"),
              JSON.stringify({
                time: new Date().toISOString(),
                captureId: diagId,
                rawOcrAfterOriginalCleanup: fields[0],
                lookupQuery: itemName,
                cursor: coords,
                resultId: item?.id ?? null,
                resultName: item?.name ?? null,
                rejected: !item,
                matcher: this.items.lastSearchReport
              }) + "\n", "utf8");
          } catch (error) {
            log.warn("Failed to save optional OCR matching audit", error);
          }
        }

        if (!item) {
          // No database match: never construct an artificial "unmatched"
          // tooltip. Also hide a stale popup from a preceding hover.
          this.tooltipVisibilityToken++;
          this.currentTooltipItemId = null;
          if (this.tauriPopup) this.tauriPopup.hide();
          if (this.tooltipWindow && !this.tooltipWindow.isDestroyed()) {
            this.tooltipWindow.webContents.send(IpcConstants.NewTooltipItem, null);
            this.tooltipWindow.hide();
          }
          return;
        }

        const matchedAmmo = this.ammoWiki.getForItem(item);
        if (matchedAmmo) item = {...item, ammoStats:matchedAmmo};

        // If the catalog cannot recommend a trader, omit the entire popup
        // (including quests/Flea) as requested. This also prevents leaving
        // stale price information visible from the previous hovered item.
        const trader = item?.prices?.trader?.name?.trim() || "";
        if (item && !item.ammoStats && (!trader || ["n/a", "unknown", "trader unknown"].includes(trader.toLowerCase()))) {
          this.tooltipVisibilityToken++;
          this.currentTooltipItemId = null;
          if (this.tauriPopup) this.tauriPopup.hide();
          if (this.tooltipWindow && !this.tooltipWindow.isDestroyed()) {
            this.tooltipWindow.webContents.send(IpcConstants.NewTooltipItem, null);
            this.tooltipWindow.hide();
          }
          return;
        }

        if (item && item.name !== "T H I C C item case") {
          const mousePos = this.getMousePos();
          const electronMousePos = screen.getCursorScreenPoint();

          if (
            mousePos.x < 2560 / 2 + 10 &&
            mousePos.y < 1440 / 2 + 10 &&
            mousePos.x > 2560 / 2 - 10 &&
            mousePos.y > 1440 / 2 - 10
          ) {
            return;
          }

          // Tolerate 10 physical desktop pixels of cursor jitter after OCR capture.
          const dx = mousePos.x - x;
          const dy = mousePos.y - y;
          if (dx * dx + dy * dy <= 100) {
            if (
              !incomingData.includes("||MENU") &&
              this.priceListWindow.isVisible()
            ) {
              this.priceListWindow.webContents.send(
                IpcConstants.NewTooltipItem,
                item
              );
            }

            if (this.tauriPopup) {
              // The Windows API supplies desktop physical pixels. Do NOT
              // divide by Electron's display DPI and then pass to Tauri.
              if (this.tauriPopup.visible && this.currentTooltipItemId === item.id) return;
              this.tooltipVisibilityToken++;
              this.currentTooltipItemId = item.id;
              this.tauriPopup.showItem(
                { ...item, ocrText: this.lastOcrText, ocrMs: this.lastOcrMs },
                mousePos.x, mousePos.y, getUserConfigData()
              );
              return;
            }

            if (this.tooltipWindow && !this.tooltipWindow.isDestroyed()) {
              const popup = this.tooltipWindow;
              // Repeated OCR detections should not cause window flicker.
              if (popup.isVisible() && this.currentTooltipItemId === item.id) {
                return;
              }
              const visibilityToken = ++this.tooltipVisibilityToken;
              this.currentTooltipItemId = item.id;

              // Chromium transparency is unreliable over some games. Never
              // show the 500x500 measurement viewport over Tarkov.
              popup.hide();
              const logicalPos = this.getLogicalPosition(mousePos.x, mousePos.y);
              popup.setBounds({
                x: logicalPos.x + 13,
                y: logicalPos.y + 13,
                width: 850,
                height: 700,
              });
              const displayItem = {
                ...item, ocrText: this.lastOcrText, ocrMs: this.lastOcrMs
              };
              popup.webContents.send(IpcConstants.NewTooltipItem, displayItem);
              setTimeout(async () => {
                if (popup.isDestroyed() || visibilityToken !== this.tooltipVisibilityToken) {
                  return;
                }
                try {
                  // Read the real rendered card dimensions, including optional
                  // quest rows and the loaded font, before exposing the window.
                  const dimensions = await popup.webContents.executeJavaScript(`
                    (() => {
                      const card = document.querySelector("#root > div");
                      if (!card || !card.textContent?.trim()) return null;
                      const rect = card.getBoundingClientRect();
                      return {
                        width: Math.ceil(Math.max(rect.width, card.scrollWidth)),
                        height: Math.ceil(Math.max(rect.height, card.scrollHeight))
                      };
                    })()
                  `, true) as { width: number; height: number } | null;
                  if (popup.isDestroyed() || visibilityToken !== this.tooltipVisibilityToken) {
                    return;
                  }
                  if (!dimensions || !Number.isFinite(dimensions.width) ||
                      !Number.isFinite(dimensions.height) ||
                      dimensions.width < 12 || dimensions.height < 12) {
                    return; // Never show an unmeasured/blank window.
                  }
                  // Fit the native window to the visible card, not a scrolling
                  // 500x500 viewport. Extra pixels avoid DPI rounding scrollbars.
                  const area = screen.getDisplayNearestPoint(logicalPos).workArea;
                  const width = Math.min(area.width - 16, Math.max(40, dimensions.width));
                  const height = Math.min(area.height - 16, Math.max(32, dimensions.height));
                  const x = logicalPos.x + 13 + width > area.x + area.width
                    ? Math.max(area.x, logicalPos.x - width - 13) : logicalPos.x + 13;
                  const y = logicalPos.y + 13 + height > area.y + area.height
                    ? Math.max(area.y, logicalPos.y - height - 13) : logicalPos.y + 13;
                  popup.setBounds({ x, y, width, height });
                  // On Windows, transparent frameless Electron windows can be
                  // physically >=65x65 even when the card is smaller. Mask
                  // the extra native area, not just the old shadow style.
                  // Keep the card's 10px transparent shadow gutter inside
                  // this shape. Apply after showing as well: a show/resize
                  // can reset or recompute the underlying HWND region.
                  if (process.platform === "win32") {
                    popup.setHasShadow(false);
                    popup.setShape([{ x: 0, y: 0, width, height }]);
                  }
                  popup.showInactive();
                  if (process.platform === "win32" &&
                      !popup.isDestroyed() && visibilityToken === this.tooltipVisibilityToken) {
                    popup.setShape([{ x: 0, y: 0, width, height }]);
                    const actual = popup.getBounds();
                    if (actual.width > width + 1 || actual.height > height + 1) {
                      log.info("POPUP_MIN_SIZE_MASK", JSON.stringify({
                        requestedWidth: width, requestedHeight: height,
                        actualWidth: actual.width, actualHeight: actual.height,
                        x, y
                      }));
                    }
                  }
                } catch (error) {
                  console.error("Could not measure popup card:", error);
                }
              }, 35);
            }
          }
        }
      }
    } catch (error) {
      console.log(error);
    }
  }
}
