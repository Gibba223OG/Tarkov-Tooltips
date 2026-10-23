import { BrowserWindow } from "electron";
import { getUserConfigData } from "../main/services/config";

declare const TOOLTIP_WINDOW_WEBPACK_ENTRY: string;
declare const TOOLTIP_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

export default class TooltipWindow extends BrowserWindow {
  constructor() {
    super({
      frame: false,
      // Windows DWM shadows can appear as a rectangular gray panel behind
      // short tooltip cards even when Chromium content is transparent.
      hasShadow: false,
      thickFrame: false,
      roundedCorners: false,
      show: false,
      transparent: true,
      width: 1,
      height: 1,
      x: 0,
      y: 0,
      backgroundColor: "#00000000",
      skipTaskbar: true,
      resizable: false,
      webPreferences: {
        // Hidden popup must render its item before we measure and show it.
        backgroundThrottling: false,
        preload: TOOLTIP_WINDOW_PRELOAD_WEBPACK_ENTRY,
      },
    });

    if (getUserConfigData().enableAlwaysOnTop) {
      this.setAlwaysOnTop(true, "screen-saver");
    }
    this.loadURL(TOOLTIP_WINDOW_WEBPACK_ENTRY);
  }
}
