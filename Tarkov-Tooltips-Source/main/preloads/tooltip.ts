import { contextBridge, ipcRenderer } from "electron";
import IpcConstants from "../../models/IpcConstants";
import { UserConfig } from "../../models/UserConfig";

declare global {
  interface Window {
    electron: {
      receive: () => void;
      getUserConfig: () => Promise<UserConfig>;
      onConfigChanged: (callback: (config: UserConfig) => void) => void;
    };
  }
}

contextBridge.exposeInMainWorld("electron", {
  receive: (channel: string, listener: any) => {
    ipcRenderer.on(channel, (event, ...args) => listener(event, ...args));
  },
  getUserConfig: () => {
    return ipcRenderer.invoke(IpcConstants.GetUserConfig);
  },
  onConfigChanged: (callback: (config: UserConfig) => void) => {
    ipcRenderer.on(
      IpcConstants.TooltipConfigChanged,
      (_event, config: UserConfig) => {
        callback(config);
      }
    );
  },
});
