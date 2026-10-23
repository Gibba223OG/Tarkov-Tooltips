import {
  app,
  BrowserWindow,
  globalShortcut,
  ipcMain,
  Menu,
  session,
  Tray,
} from "electron";
import { openMainWindow } from "./services/windows";
import Items from "../models/Items";
import TooltipWindow from "../models/TooltipWindow";
import OCRProcess from "../models/OCRProcess";
import QtPopupBridge from "../models/QtPopupBridge";
import AlwaysOnTopProcess from "../models/AlwaysOnTopProcess";
import path from "path";
import IpcConstants from "../models/IpcConstants";
import log from "electron-log/main";
import { isDev } from "../utils";
import { ChildProcessWithoutNullStreams, spawn } from "child_process";
import fs from "fs";
import { getUserConfigData, setUserConfigData } from "./services/config";

// Preserve the original Tarkov Tooltips configuration folder after the public rename.
// Set it before Electron's ready event so the existing saved settings and
// calibration are not silently reset by a new productName/userData directory.
const legacyUserData = path.join(app.getPath("appData"), "PriceChecker");
fs.mkdirSync(legacyUserData, { recursive: true });
app.setPath("userData", legacyUserData);
import { UserConfig } from "../models/UserConfig";
import Item from "../models/Item";
import AmmoWikiData from "../models/AmmoWikiData";

// The system tray is separate from the popup: hiding Settings keeps OCR
// running. Keep the Tray object strongly referenced for the app lifetime.
let appTray: Tray | null = null;

function openSettingsFromTray() {
  const win = BrowserWindow.getAllWindows().find(w =>
    !w.isDestroyed() && !(w instanceof TooltipWindow));
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

function installMinimizeToTray(win: BrowserWindow) {
  win.on("minimize", (event: Electron.Event) => {
    if (!appTray || win.isDestroyed()) return; // no tray: normal minimize
    event.preventDefault();
    win.hide();
  });
}

function startSystemTray() {
  if (appTray) return;
  // The packager copies favicon.ico as a native loose resource, not ASAR.
  const iconFile = isDev()
    ? path.join(app.getAppPath(), "favicon.ico")
    : path.join(process.resourcesPath, "favicon.ico");
  try {
    appTray = new Tray(iconFile);
    appTray.setToolTip("Tarkov Tooltips");
    appTray.setContextMenu(Menu.buildFromTemplate([
      { label: "Open Settings", click: openSettingsFromTray },
      { type: "separator" },
      { label: "Quit Tarkov Tooltips", click: () => app.quit() },
    ]));
    appTray.on("double-click", openSettingsFromTray);
    log.info("Tarkov Tooltips system tray ready", iconFile);
  } catch (error) {
    appTray = null;
    log.error("Unable to create Tarkov Tooltips tray:", error);
  }
}

// Tarkov Tooltips v1.1.2 registers only two global keys: F1 (Settings) and
// F2 (calibrate -> save -> restart). The obsolete loot keys are not installed.
type CalibrationPhase = "idle" | "preparing" | "ready" | "scanning" | "restartReady" | "error";
let calibrationPhase: CalibrationPhase = "idle";
let calibrationChild: ChildProcessWithoutNullStreams | null = null;
let calibrationBuffer = "";
let calibrationSettled = false;

function calibrationWindow(): BrowserWindow | undefined {
  return BrowserWindow.getAllWindows().find(w => !w.isDestroyed() && !w.getTitle().includes("Popup")) ||
    BrowserWindow.getAllWindows().find(w => !w.isDestroyed());
}

function calibrationStatus(stage: "preparing" | "ready" | "scanning" | "success" | "error", message: string) {
  const win = calibrationWindow();
  if (!win) return;
  if (!win.isVisible()) win.show();
  win.webContents.send("pricechecker-calibration-status", { stage, message });
}

function failCalibration(message: string) {
  log.error("Tarkov Tooltips calibration failure:", message);
  calibrationPhase = "error";
  calibrationSettled = true;
  calibrationStatus("error", message);
  if (calibrationChild && !calibrationChild.killed) {
    calibrationChild.kill();
  }
  calibrationChild = null;
}

function beginCalibration() {
  if (calibrationChild && !calibrationChild.killed) calibrationChild.kill();
  calibrationChild = null;
  calibrationSettled = false;
  calibrationBuffer = "";
  calibrationPhase = "preparing";
  calibrationStatus("preparing",
    "Hover over an item until its tooltip appears, then don't move the mouse. When ready, press F2 again.");
  const cfg = getUserConfigData();
  const exe = isDev()
    ? path.join(app.getAppPath(), "lib", "ocr", "configure_screen.exe")
    : path.join(process.resourcesPath, "ocr", "configure_screen.exe");
  try {
    const child = spawn(exe, [
      String(cfg.borderColorRed ?? 82),
      String(cfg.borderColorGreen ?? 89),
      String(cfg.borderColorBlue ?? 90),
    ], { cwd: path.dirname(exe), windowsHide: true });
    calibrationChild = child;
    child.stdout.setEncoding("utf-8");
    child.stdout.on("data", (chunk: string) => {
      calibrationBuffer += chunk.toString();
      if (calibrationBuffer.length > 8192) calibrationBuffer = calibrationBuffer.slice(-4096);
      const match = /RESULT\|\|(-?\d+)\|\|(-?\d+)/.exec(calibrationBuffer);
      if (!match || calibrationSettled || calibrationPhase !== "scanning") return;
      const offsetX = Number(match[1]);
      const offsetY = Number(match[2]);
      if (!Number.isInteger(offsetX) || !Number.isInteger(offsetY) ||
          Math.abs(offsetX) > 500 || Math.abs(offsetY) > 500) {
        failCalibration("Calibration returned invalid dimensions. Press F2 to retry.");
        return;
      }
      try {
        const configFile = isDev()
          ? path.join(app.getAppPath(), "lib", "ocr", "scanningConfig.json")
          : path.join(process.resourcesPath, "ocr", "scanningConfig.json");
        const content = JSON.stringify({ offsetX, offsetY });
        fs.writeFileSync(configFile, content, "utf8");
        if (fs.readFileSync(configFile, "utf8") !== content) {
          throw new Error("Calibration file verification failed");
        }
        calibrationSettled = true;
        calibrationPhase = "restartReady";
        calibrationStatus("success",
          "Calibration complete! Press F2 again to restart Tarkov Tooltips and apply the new calibration.");
        log.info("Tarkov Tooltips calibration saved", configFile, offsetX, offsetY);
        if (!child.killed) child.kill();
        calibrationChild = null;
      } catch (e) {
        failCalibration("Unable to save calibration: " + String(e));
      }
    });
    child.stderr.on("data", data => log.warn("Calibration helper:", data.toString()));
    child.on("error", err => {
      if (calibrationPhase !== "restartReady") failCalibration("Calibration helper could not start: " + err.message);
    });
    child.on("close", code => {
      if (!calibrationSettled && (calibrationPhase === "ready" || calibrationPhase === "scanning" || calibrationPhase === "preparing")) {
        failCalibration("Calibration stopped without a valid result (exit " + String(code) + "). Press F2 to retry.");
      }
    });
    // Allow the helper to initialize before accepting the second F2.
    setTimeout(() => {
      if (calibrationPhase === "preparing" && calibrationChild === child) {
        calibrationPhase = "ready";
        calibrationStatus("ready",
          "Hover an item until its tooltip appears. Keep the mouse completely still, then press F2 again when ready.");
      }
    }, 800);
  } catch (e) {
    failCalibration("Calibration could not start: " + String(e));
  }
}

function handleF2Calibration() {
  if (calibrationPhase === "restartReady") {
    log.info("Restarting Tarkov Tooltips following saved calibration");
    app.relaunch();
    app.quit();
    return;
  }
  if (calibrationPhase === "idle" || calibrationPhase === "error") {
    beginCalibration();
    return;
  }
  if (calibrationPhase === "ready") {
    if (!calibrationChild || !calibrationChild.stdin.writable) {
      failCalibration("Calibration helper isn't ready. Press F2 to retry.");
      return;
    }
    calibrationPhase = "scanning";
    calibrationStatus("scanning", "Scanning tooltip border. Keep the mouse still until calibration completes.");
    calibrationChild.stdin.write("NEXT\n");
  }
}

function registerHotkeys(_userConfig?: UserConfig) {
  const f1 = globalShortcut.register("F1", () => {
    const win = calibrationWindow();
    if (!win) return;
    if (win.isVisible()) win.hide();
    else win.show();
  });
  const f2 = globalShortcut.register("F2", handleF2Calibration);
  if (!f1) log.warn("F1 could not be registered.");
  if (!f2) log.warn("F2 could not be registered (another application may own it).");
}

function unregisterHotkeys() {
  globalShortcut.unregister("F1");
  globalShortcut.unregister("F2");
}

declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

// Global variables for screen configuration
let screenConfigureStep: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 = 0;
let screenConfigureProcess: ChildProcessWithoutNullStreams | null = null;

try {
  // This allows TypeScript to pick up the magic constants that's auto-generated by Forge's Webpack
  // plugin that tells the Electron app where to look for the Webpack-bundled app code (depending on
  // whether you're running in development or production).
  let items: Items;
  let tauriPopup: QtPopupBridge | null = null;
  let ocr: OCRProcess | null = null;

  // An independent renderer for manual Settings tests. The real OCR-driven
  // tooltip process remains separate and cannot hide the sample popup.
  type PopupTestMode = "small" | "quest" | "ammo";
  let testPopup: QtPopupBridge | null = null;
  let testPopupMode: PopupTestMode | null = null;

  function stopPopupTest() {
    if (testPopup) {
      testPopup.dispose();
      testPopup = null;
    }
    testPopupMode = null;
  }
  app.once("before-quit", stopPopupTest);

  log.initialize();

  // Handle creating/removing shortcuts on Windows when installing/uninstalling.
  if (require("electron-squirrel-startup")) {
    app.quit();
  }

  // Better performance when a menu is not needed
  // Menu.setApplicationMenu(null);

  app.on("ready", async () => {
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          "Content-Security-Policy": [
            "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; script-src * 'unsafe-inline' 'unsafe-eval' data: blob:; connect-src *; img-src * data: blob:; style-src * 'unsafe-inline'; font-src * data:; media-src *; object-src *;",
          ],
        },
      });
    });

    log.info(
      "OPENING MAIN WINDOW",
      MAIN_WINDOW_WEBPACK_ENTRY,
      MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY
    );
    const mainWindow = openMainWindow(
      MAIN_WINDOW_WEBPACK_ENTRY,
      MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY
    );

    const userConfig = getUserConfigData();

    // The tray is available before a window can be minimized. Hide on
    // minimize; don't kill the price scanner or prevent explicit Quit.
    startSystemTray();
    installMinimizeToTray(await mainWindow);

    // (await mainWindow).setIgnoreMouseEvents(true);
    (await mainWindow).on("close", () => {
      app.quit();
    });

    (await mainWindow).on("ready-to-show", () => {
      if (userConfig.enableAlwaysOnTop) {
        new AlwaysOnTopProcess().initialize();
      }
    });

    // The existing Electron Settings/tray/OCR stack is preserved.
    // Only the old transparent Electron popup is replaced by a Tauri/WebView2 popup.
    function initializeTooltips() {
      if (tauriPopup) return;
      if (!ocr) {
        log.error("Cannot start Tauri popup before OCR has initialized");
        return;
      }
      try {
        const bridge = new QtPopupBridge();
        bridge.start();
        tauriPopup = bridge;
        ocr.tauriPopup = bridge;
        const win = BrowserWindow.getAllWindows()[0];
        if (win && !win.isDestroyed()) win.webContents.send(IpcConstants.TooltipsReady);
        log.info("Tauri popup bridge started");
      } catch (error) {
        log.error("Tauri popup initialize failure", error);
      }
    }

    function destroyTooltips() {
      if (ocr) ocr.tauriPopup = null;
      if (tauriPopup) {
        tauriPopup.dispose();
        tauriPopup = null;
      }
    }

    const ammoWiki = new AmmoWikiData();
    void ammoWiki.refresh();
    items = new Items();
    const initialUserConfig = getUserConfigData();
    items
      .fetchItems(
        initialUserConfig.tarkovMarketApiKey,
        initialUserConfig.usePveMode
      )
      .then(async () => {
        setInterval(() => {
          console.log("Refetching updated data");
          const userConfig = getUserConfigData();
          items.fetchItems(
            userConfig.tarkovMarketApiKey,
            userConfig.usePveMode
          );
        }, 1000 * 60 * 15);

        // Initialize search index with retry logic
        const maxRetries = 100;
        const retryDelay = 400;
        let retryCount = 0;
        let searchIndexInitialized = false;

        while (!searchIndexInitialized && retryCount < maxRetries) {
          try {
            // Check if items are loaded before attempting initialization
            if (items.items.length === 0) {
              retryCount++;
              if (retryCount < maxRetries) {
                await new Promise((resolve) => setTimeout(resolve, retryDelay));
                continue;
              } else {
                throw new Error(
                  "Items not loaded after maximum retries - cannot initialize search index"
                );
              }
            }

            // Attempt to initialize search index
            items.initializeSearchIndex();

            // Verify search index was actually created
            if (items.searchIndex) {
              searchIndexInitialized = true;
              console.log("Item search index initialized successfully");
            } else {
              throw new Error(
                "Search index initialization returned without creating index"
              );
            }
          } catch (error) {
            retryCount++;
            if (retryCount < maxRetries) {
              log.warn(
                `Error initializing search index (attempt ${retryCount}/${maxRetries}), retrying in ${retryDelay}ms...`,
                error
              );
              await new Promise((resolve) => setTimeout(resolve, retryDelay));
            } else {
              log.error(
                "Failed to initialize search index after maximum retries",
                error
              );
              throw error;
            }
          }
        }

        ocr = new OCRProcess(items, BrowserWindow.getAllWindows()[0], ammoWiki);
        ocr.initialize();
        console.log("OCR PROCESS INITIALIZED");

        // Initialize tooltips if enabled in config
        if (userConfig.enableTooltips) {
          initializeTooltips();
        }

        BrowserWindow.getAllWindows()[0].webContents.send(
          IpcConstants.ItemsDatabaseReady
        );
      })
      .catch((error) => {
        console.log("FAILED TO FETCH ITEMS FROM API:", error);
        BrowserWindow.getAllWindows()[0].webContents.send(
          IpcConstants.ItemsDatabaseFailed
        );
      });

    // FOR SOME REASON THESE BREAK THE APP WHEN PACKAGED |||||||||||||||||||||||||||||| WARNING
    // const tray = new Tray(path.join(app.getAppPath(), "/favicon.ico"));

    // const contextMenu = Menu.buildFromTemplate([
    //   {
    //     role: "about",
    //     label: "Tarkov Price Checker",
    //     icon: path.join(app.getAppPath(), "/favicon-16x16.png"),
    //     enabled: false,
    //   },
    //   {
    //     type: "separator",
    //   },
    //   {
    //     role: "quit",
    //     label: "Quit App",
    //   },
    // ]);

    // tray.setToolTip("Tarkov Price Checker");
    // tray.setContextMenu(contextMenu);

    // Register hotkeys based on user config
    const hotkeyUserConfig = getUserConfigData();
    registerHotkeys(hotkeyUserConfig);

    // Settings-only window: X hides it, F1 reopens it without stopping OCR.
    ipcMain.on("pricechecker-hide-settings", () => {
      const window = BrowserWindow.getAllWindows()[0];
      if (window && !window.isDestroyed()) window.hide();
    });

    // IPC handlers for user config
    ipcMain.handle(IpcConstants.GetUserConfig, () => {
      return getUserConfigData();
    });

    ipcMain.handle(IpcConstants.GetAllItems, () => {
      if (items && items.itemsAreLoaded()) {
        return items.items;
      }
      return [];
    });

    ipcMain.handle(
      IpcConstants.ValidateApiKey,
      async (_event, apiKey: string) => {
        try {
          const response = await fetch(
            "https://api.tarkov-market.app/api/v1/items/all",
            {
              method: "GET",
              headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
                "x-api-key": apiKey,
              },
            }
          );

          return response.status === 200 || response.status === 204;
        } catch (error) {
          console.error("API key validation failed:", error);
          return false;
        }
      }
    );

    ipcMain.handle(IpcConstants.RefetchItems, async () => {
      try {
        if (items) {
          const userConfig = getUserConfigData();
          await items.fetchItems(
            userConfig.tarkovMarketApiKey,
            userConfig.usePveMode
          );
          return true;
        }
        return false;
      } catch (error) {
        console.error("Failed to refetch items:", error);
        return false;
      }
    });

    ipcMain.handle(
      IpcConstants.SetUserConfig,
      (_event, userConfig: UserConfig) => {
        setUserConfigData(userConfig);

        // The Tauri renderer receives live Settings changes.
        if (tauriPopup) tauriPopup.updateConfig(userConfig);
        if (testPopup) testPopup.updateConfig({
          ...userConfig, enableAlwaysOnTop: true
        });

        return true;
      }
    );

    // Desktop-only visual test: one click shows a real Tauri/WebView2
    // popup; clicking the active sample again hides it. It never calls
    // OCR or changes saved settings, even with tooltips disabled.
    ipcMain.handle(IpcConstants.GetPopupTestMode, () => testPopupMode);
    ipcMain.handle(IpcConstants.TogglePopupTest, (_event, mode: PopupTestMode) => {
      if (mode !== "small" && mode !== "quest" && mode !== "ammo")
        throw new Error("Invalid popup sample");
      if (testPopupMode === mode) {
        stopPopupTest();
        return null;
      }
      if (!testPopup) {
        testPopup = new QtPopupBridge();
        testPopup.start();
      }
      const sample: Item = {
        id: mode === "ammo" ? "56dff061d2720bb5668b4567" : "pricechecker-settings-test-only",
        name: mode === "ammo" ? "5.45x39mm BT gs" :
          mode === "quest" ? "Screw nuts" : "Desktop test item",
        shortName: mode === "ammo" ? "BT gs" :
          mode === "quest" ? "Screw nuts" : "Desktop test item",
        availableOnFleaMarket: true,
        prices: {
          latest: 40300, avgDay: 41000, avgWeek: 41000,
          trader: { name: "Mechanic", price: 18000 }
        },
        tasks: [], slots: 1, icon: ""
      };
      if (mode === "ammo") {
        // Use the same validated Wiki cache/fallback and item-ID lookup as real hovers.
        const verified = ammoWiki.getForItem(sample);
        if (!verified) throw new Error("Ammo Wiki BT gs test record unavailable");
        sample.ammoStats = verified;
      }
      // Keep the test over the desktop irrespective of the gameplay
      // always-on-top preference; this does not persist any setting.
      const testConfig: UserConfig = {
        ...getUserConfigData(), enableAlwaysOnTop: true
      };
      // The Tauri host obtains the actual physical cursor via Win32.
      testPopup.showItem(sample, 0, 0, testConfig);
      testPopupMode = mode;
      return testPopupMode;
    });

    // IPC handler to toggle tooltips
    ipcMain.handle(IpcConstants.ToggleTooltips, (_event, enabled: boolean) => {
      if (enabled) {
        initializeTooltips();
      } else {
        destroyTooltips();
      }
      return true;
    });

    // IPC handler to toggle frameless mode
    ipcMain.handle(
      IpcConstants.ToggleFrameless,
      async (_event, enabled: boolean) => {
        const windows = BrowserWindow.getAllWindows();
        if (windows.length > 0) {
          const win = windows[0];
          // Remove the close listener temporarily so the app doesn't quit
          win.removeAllListeners("close");

          win.close();

          setTimeout(async () => {
            // Re-open the main window. openMainWindow will create a new one since windows.length is now 0.
            // It will use the updated user config.
            const newWin = await openMainWindow(
              MAIN_WINDOW_WEBPACK_ENTRY,
              MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY
            );

            if (ocr) {
              ocr.setPriceListWindow(newWin);
            }

            if (items && items.itemsAreLoaded()) {
              newWin.webContents.send(IpcConstants.ItemsDatabaseReady);
            }

            if (getUserConfigData().enableAlwaysOnTop) {
              new AlwaysOnTopProcess().initialize();
            }

            installMinimizeToTray(newWin);
            newWin.on("close", () => {
              app.quit();
            });
          }, 1000);
        }
        return true;
      }
    );

    // IPC handler to toggle always on top
    ipcMain.handle(
      IpcConstants.ToggleAlwaysOnTop,
      async (_event, enabled: boolean) => {
        if (enabled) {
          new AlwaysOnTopProcess().initialize();
        }

        const userConfig: UserConfig = getUserConfigData();
        if (!enabled) {
          BrowserWindow.getAllWindows().forEach(win => win.setAlwaysOnTop(false));
        }
        userConfig.enableAlwaysOnTop = enabled;
        setUserConfigData(userConfig);

        return true;
      }
    );

    // The only global shortcuts are F1 and F2, registered above. The
    // original loot-log shortcut handlers (F2/F3/F4/F6) were removed.

    // log.info("MEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEOW");
    // ipcMain.on(IpcConstants.EnableTooltips, async (event, ...args) => {
    //   const tooltipWindow = new TooltipWindow();
    //   tooltipWindow.on("ready-to-show", () => {
    //     setTimeout(() => {
    //       const alwaysOnTopProcess = new AlwaysOnTopProcess();
    //       alwaysOnTopProcess.initialize();
    //       ocr.tooltipWindow = tooltipWindow;
    //       BrowserWindow.getAllWindows()[0].webContents.send(
    //         IpcConstants.TooltipsReady
    //       );
    //     }, 1000);
    //   });
    // });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });

  // MAC
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      // openMainWindow(MAIN_WINDOW_WEBPACK_ENTRY, MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY);
    }
  });
} catch (e) {
  log.error("Error in main process:", e);
}
