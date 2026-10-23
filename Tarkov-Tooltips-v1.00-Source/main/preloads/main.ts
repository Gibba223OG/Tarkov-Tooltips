import { contextBridge, ipcRenderer } from "electron";
import IpcConstants from "../../models/IpcConstants";
import { UserConfig } from "../../models/UserConfig";

declare global {
  interface Window {
    electron: {
      receive: (channel: string, listener: any) => void;
      hideSettingsWindow: () => void;
      onCalibrationStatus: (callback: (data: {
        stage: "preparing" | "ready" | "scanning" | "success" | "error";
        message: string
      }) => void) => () => void;
      enableTooltips: () => void;
      getUserConfig: () => Promise<UserConfig>;
      setUserConfig: (config: UserConfig) => Promise<boolean>;
      toggleTooltips: (enabled: boolean) => Promise<boolean>;
      getPopupTestMode: () => Promise<"small" | "quest" | "ammo" | null>;
      togglePopupTest: (mode: "small" | "quest" | "ammo") => Promise<"small" | "quest" | "ammo" | null>;
      toggleFrameless: (enabled: boolean) => Promise<boolean>;
      toggleAlwaysOnTop: (enabled: boolean) => Promise<boolean>;
      getAllItems: () => Promise<any[]>;
      validateApiKey: (apiKey: string) => Promise<boolean>;
      refetchItems: () => Promise<boolean>;
      toggleMainWindow: (enabled: boolean) => Promise<boolean>;
      toggleDeleteLowestItem: (enabled: boolean) => Promise<boolean>;
      toggleDeleteLastItem: (enabled: boolean) => Promise<boolean>;
      toggleIncrementLastItem: (enabled: boolean) => Promise<boolean>;
      toggleScreenCalibration: (enabled: boolean) => Promise<boolean>;
    };
  }
}

contextBridge.exposeInMainWorld("electron", {
  receive: (channel: string, listener: any) => {
    ipcRenderer.on(channel, (event, ...args) => listener(event, ...args));
  },
  hideSettingsWindow: () => ipcRenderer.send("pricechecker-hide-settings"),
  onCalibrationStatus: (callback: (data: any) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, data: any) => callback(data);
    ipcRenderer.on("pricechecker-calibration-status", listener);
    return () => ipcRenderer.removeListener("pricechecker-calibration-status", listener);
  },
  enableTooltips: () => {
    ipcRenderer.send(IpcConstants.EnableTooltips);
  },
  getUserConfig: () => {
    return ipcRenderer.invoke(IpcConstants.GetUserConfig);
  },
  setUserConfig: (config: UserConfig) => {
    return ipcRenderer.invoke(IpcConstants.SetUserConfig, config);
  },
  toggleTooltips: (enabled: boolean) => {
    return ipcRenderer.invoke(IpcConstants.ToggleTooltips, enabled);
  },
  getPopupTestMode: () => ipcRenderer.invoke(IpcConstants.GetPopupTestMode),
  togglePopupTest: (mode: "small" | "quest" | "ammo") =>
    ipcRenderer.invoke(IpcConstants.TogglePopupTest, mode),
  toggleFrameless: (enabled: boolean) => {
    return ipcRenderer.invoke(IpcConstants.ToggleFrameless, enabled);
  },
  toggleAlwaysOnTop: (enabled: boolean) => {
    return ipcRenderer.invoke(IpcConstants.ToggleAlwaysOnTop, enabled);
  },
  getAllItems: () => {
    return ipcRenderer.invoke(IpcConstants.GetAllItems);
  },
  validateApiKey: (apiKey: string) => {
    return ipcRenderer.invoke(IpcConstants.ValidateApiKey, apiKey);
  },
  refetchItems: () => {
    return ipcRenderer.invoke(IpcConstants.RefetchItems);
  },
  toggleMainWindow: (enabled: boolean) => {
    return ipcRenderer.invoke(IpcConstants.ToggleMainWindow, enabled);
  },
  toggleDeleteLowestItem: (enabled: boolean) => {
    return ipcRenderer.invoke(IpcConstants.ToggleDeleteLowestItem, enabled);
  },
  toggleDeleteLastItem: (enabled: boolean) => {
    return ipcRenderer.invoke(IpcConstants.ToggleDeleteLastItem, enabled);
  },
  toggleIncrementLastItem: (enabled: boolean) => {
    return ipcRenderer.invoke(IpcConstants.ToggleIncrementLastItem, enabled);
  },
  toggleScreenCalibration: (enabled: boolean) => {
    return ipcRenderer.invoke(IpcConstants.ToggleScreenCalibration, enabled);
  },
});
