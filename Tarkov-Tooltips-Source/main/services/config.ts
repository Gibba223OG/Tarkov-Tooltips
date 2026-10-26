import { app } from "electron";
import fs from "fs";
import { UserConfig } from "../../models/UserConfig";

export function getUserConfigData(): UserConfig {
  const userDataPath = app.getPath("userData");

  if (userConfigFileDoesNotExist(userDataPath)) {
    createUserConfigFile(userDataPath);
  }

  const fileData = fs.readFileSync(`${userDataPath}/user-config.json`, {
    encoding: "utf-8",
  });
  const userConfig: UserConfig = JSON.parse(fileData);
  // One-time migration: replace old default scale values, preserve custom scales.
  let changed = false;
  if ((userConfig.popupBackground || "").toLowerCase() === "#272b2d") {
    userConfig.popupBackground = "#080909";
    changed = true;
  }
  if (userConfig.popupScaleDefaultsVersion !== 11) {
    if (userConfig.popupMainScale === undefined || userConfig.popupMainScale === 50) {
      userConfig.popupMainScale = 55;
      changed = true;
    }
    if (userConfig.popupAmmoScale === undefined || userConfig.popupAmmoScale === 35) {
      userConfig.popupAmmoScale = 45;
      changed = true;
    }
    userConfig.popupScaleDefaultsVersion = 11;
    changed = true;
  }
  // v1.00 replacement: the previous release defaulted price bold to OFF.
  // Enable once on upgrade (including an existing false default); later OFF
  // selections persist because the migration marker is saved.
  if (userConfig.popupPriceBoldDefaultVersion !== 1) {
    userConfig.popupPriceBold = true;
    userConfig.popupPriceBoldDefaultVersion = 1;
    changed = true;
  }
  if (changed) fs.writeFileSync(userDataPath + "/user-config.json", JSON.stringify(userConfig));
  return userConfig;
}

export function setUserConfigData(userConfig: UserConfig): void {
  const userDataPath = app.getPath("userData");
  if (userConfigFileDoesNotExist(userDataPath)) {
    createUserConfigFile(userDataPath);
  }

  const userData = JSON.stringify(userConfig);
  fs.writeFileSync(`${userDataPath}/user-config.json`, userData);
}

function userConfigFileDoesNotExist(userDataPath: string): boolean {
  return !fs.existsSync(`${userDataPath}/user-config.json`);
}

function createUserConfigFile(userDataPath: string): void {
  const newUserConfig: UserConfig = {
    mainWindow: {
      width: 600,
      height: 400,
      x: null,
      y: null,
    },
    soundEnabled: false,
    soundVolume: 1.0,
    enableTooltips: true,
    isFrameless: false,
    enableAlwaysOnTop: true,
    tarkovMarketApiKey: "",
    borderColorRed: 82,
    borderColorGreen: 89,
    borderColorBlue: 90,
    enableMainWindowToggle: true,
    enableDeleteLowestItem: true,
    enableDeleteLastItem: true,
    enableIncrementLastItem: true,
    enableScreenCalibration: true,
    usePveMode: false,
    showTotalPrice: false,
    showOcrDiagnostics: false,
    enableFuzzyMatching: true,
    showItemName: false,
    popupBackground: "#080909",
    popupBorder: "#59605a",
    popupMainScale: 55, // Original price/quest size remains at slider 50%.
    popupAmmoScale: 45, // Full-size v6 ammo remains at slider 100%.
    popupPriceBold: true,
    popupPriceBoldDefaultVersion: 1,
    popupScaleDefaultsVersion: 11,
  };

  fs.writeFileSync(
    `${userDataPath}/user-config.json`,
    JSON.stringify(newUserConfig)
  );
}
