export type UserConfig = {
  mainWindow: {
    width: number;
    height: number;
    x: number | null;
    y: number | null;
  };
  soundEnabled?: boolean;
  soundVolume?: number; // 0.0 to 1.0
  enableTooltips?: boolean;
  isFrameless?: boolean;
  enableAlwaysOnTop?: boolean;
  tarkovMarketApiKey?: string;
  lowestAcceptableScore?: number;
  borderColorRed?: number; // 0-255
  borderColorGreen?: number; // 0-255
  borderColorBlue?: number; // 0-255
  enableMainWindowToggle?: boolean;
  enableDeleteLowestItem?: boolean;
  enableDeleteLastItem?: boolean;
  enableIncrementLastItem?: boolean;
  enableScreenCalibration?: boolean;
  usePveMode?: boolean;
  showTotalPrice?: boolean;
  showOcrDiagnostics?: boolean;
  enableFuzzyMatching?: boolean; // On: existing MiniSearch fuzzy fallback; off: exact normalized full item names only.
  showItemName?: boolean;
  popupBackground?: string;
  popupBorder?: string;
  // Slider percentages; 50 means the original main popup size, 100 the original ammo size.
  popupMainScale?: number;
  popupAmmoScale?: number;
  popupPriceBold?: boolean;
  popupPriceBoldDefaultVersion?: number; // v1.00 replacement: migrate old off-default once.
  popupScaleDefaultsVersion?: number;
};
