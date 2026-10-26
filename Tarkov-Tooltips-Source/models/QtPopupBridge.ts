// Active Qt Quick popup bridge for Tarkov Tooltips v1.00.
// JSON lines match the existing TauriPopupBridge message shape.
import { app } from "electron";
import { spawn, ChildProcessWithoutNullStreams } from "child_process";
import path from "path";
import log from "electron-log/main";
// This bridge is integrated with Electron main/OCR.
import Item from "./Item";
import * as LiveData from "./TarkovLiveData";
import { UserConfig } from "./UserConfig";

export default class QtPopupBridge {
  private child: ChildProcessWithoutNullStreams | null = null;
  private ready = false;
  private stdoutBuffer = "";
  private lastMessage: any = null;
  private sequence = 0;
  private destroyed = false;
  public visible = false;

  start(): void {
    if (this.child) return;
    // Packaging step must place the independently-built Qt executable here.
    const exe = path.join(process.resourcesPath, "TarkovTooltipsQtPopup", "TarkovTooltipsQtPopup.exe");
    this.child = spawn(exe, [], {
      cwd: path.dirname(exe), windowsHide: true, stdio: ["pipe", "pipe", "pipe"]
    });
    this.child.on("error", error => {
      log.error("Qt popup start failed", exe, error);
      this.child = null;
      this.ready = false;
      this.visible = false;
    });
    this.child.on("exit", code => {
      if (!this.destroyed) log.error("Qt popup exited", code);
      this.child = null;
      this.ready = false;
      this.visible = false;
    });
    this.child.stdout.on("data", data => {
      this.stdoutBuffer += data.toString();
      if (this.stdoutBuffer.length > 8192)
        this.stdoutBuffer = this.stdoutBuffer.slice(-4096);
      let i: number;
      while ((i = this.stdoutBuffer.indexOf("\n")) >= 0) {
        const line = this.stdoutBuffer.slice(0, i).trim();
        this.stdoutBuffer = this.stdoutBuffer.slice(i + 1);
        if (line === "READY") {
          this.ready = true;
          if (this.lastMessage) this.send(this.lastMessage);
        } else if (line) {
          log.info("QtPopup:", line);
        }
      }
    });
    this.child.stderr.on("data", data => log.warn("QtPopup:", data.toString().trim()));
    app.once("before-quit", () => this.dispose());
  }

  private send(message: any): void {
    if (!this.ready || !this.child || this.child.killed || !this.child.stdin.writable)
      return;
    this.child.stdin.write(JSON.stringify(message) + "\n");
  }

  showItem(item: Item, cursorX: number, cursorY: number, config: UserConfig): void {
    if (this.destroyed) return;
    this.visible = true;
    this.lastMessage = {
      type: "item", seq: ++this.sequence,
      item: LiveData.enrich(item, Boolean(config.usePveMode)), cursorX, cursorY, config
    };
    this.send(this.lastMessage);
  }

  updateConfig(config: UserConfig): void {
    if (this.visible && this.lastMessage?.type === "item") {
      this.lastMessage = { ...this.lastMessage, config, seq: ++this.sequence };
      this.send(this.lastMessage);
    } else this.send({ type: "config", config, seq: ++this.sequence });
  }

  hide(): void {
    this.visible = false;
    const message = { type: "hide", seq: ++this.sequence };
    this.lastMessage = message;
    this.send(message);
  }

  dispose(): void {
    if (this.destroyed) return;
    this.hide();
    this.destroyed = true;
    if (this.child && !this.child.killed) this.child.kill();
    this.child = null;
    this.ready = false;
    this.lastMessage = null;
  }
}
