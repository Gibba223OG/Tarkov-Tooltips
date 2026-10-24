import { BrowserWindow } from "electron";

// PriceChecker uses Electron's native window layer rather than the original
// helper, which targets windows named FleaTooltip.
export default class AlwaysOnTopProcess {
  initialize(): void {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.setAlwaysOnTop(true, "screen-saver");
      }
    }
  }
}
