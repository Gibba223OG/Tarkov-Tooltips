import { app } from "electron";
import { ChildProcessWithoutNullStreams, spawn } from "child_process";
import path from "path";
import log from "electron-log/main";
import Item from "./Item";
import { UserConfig } from "./UserConfig";

export default class TauriPopupBridge {
  private child: ChildProcessWithoutNullStreams | null = null;
  private ready = false;
  private lastMessage: any = null;
  private sequence = 0;
  private destroyed = false;
  private bufferedStdout = "";
  public visible = false;

  start(): void {
    if (this.child) return;
    const exe = path.join(process.resourcesPath, "TarkovTooltipsPopup.exe");
    this.child = spawn(exe, [], { cwd: path.dirname(exe), windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
    this.child.on("error", error => {
      log.error("Tauri popup start failure", exe, error);
      this.ready = false;
      this.child = null;
    });
    this.child.on("exit", code => {
      if (!this.destroyed) log.error("Tauri popup unexpectedly exited", code);
      this.ready = false;
      this.child = null;
      this.visible = false;
    });
    this.child.stdout.on("data", data => {
      this.bufferedStdout += data.toString();
      if (this.bufferedStdout.length > 8192) this.bufferedStdout = this.bufferedStdout.slice(-4096);
      let index: number;
      while ((index = this.bufferedStdout.indexOf("\n")) >= 0) {
        const line = this.bufferedStdout.slice(0,index).trim();
        this.bufferedStdout = this.bufferedStdout.slice(index+1);
        if (line === "READY") {
          this.ready = true;
          log.info("Tauri popup WebView2 renderer ready");
          if (this.lastMessage) this.write(this.lastMessage);
        } else if (line) log.info("TauriPopup:", line);
      }
    });
    this.child.stderr.on("data", data => log.warn("TauriPopup:", data.toString().trim()));
    app.once("before-quit", () => this.dispose());
  }

  private write(message: any): void {
    if (!this.ready || !this.child || this.child.killed || !this.child.stdin.writable) return;
    this.child.stdin.write(JSON.stringify(message) + "\n");
  }

  public updateConfig(config: UserConfig): void {
    // Refresh an already-visible popup so WebView2 measures the new dimensions.
    // The item, cursor and scan state are unchanged; only the config/sequence refresh.
    if (this.visible && this.lastMessage?.type === "item") {
      this.lastMessage = {
        ...this.lastMessage, type: "item", seq: ++this.sequence, config
      };
      this.write(this.lastMessage);
    } else {
      this.write({ type: "config", config });
    }
  }

  // CursorX/Y are native physical desktop pixels, never logical Electron DIP.
  public showItem(item: Item, cursorX: number, cursorY: number, config: UserConfig): void {
    if (this.destroyed) return;
    this.visible = true;
    this.lastMessage = {
      type: "item",
      seq: ++this.sequence,
      item,
      cursorX,
      cursorY,
      config,
    };
    this.write(this.lastMessage);
  }

  public hide(): void {
    this.visible = false;
    const message = { type: "hide", seq: ++this.sequence };
    this.lastMessage = message;
    this.write(message);
  }

  public dispose(): void {
    this.destroyed = true;
    this.hide();
    if (this.child && !this.child.killed) this.child.kill();
    this.child = null;
    this.ready = false;
    this.lastMessage = null;
  }
}
