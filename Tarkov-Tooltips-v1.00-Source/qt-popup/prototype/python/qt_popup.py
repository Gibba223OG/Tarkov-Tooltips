"""Isolated Qt Quick tooltip sidecar prototype for Tarkov Tooltips.

Host contract: one JSON object per stdin line with type=item|hide|config,
mirroring the existing TauriPopupBridge messages. stdout prints READY only.
No OCR, injection, browser engine, or changes to the existing Electron app.
"""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import sys
import threading

from PySide6.QtCore import QObject, QPoint, QTimer, QUrl, Signal, Slot, Qt
from PySide6.QtGui import QCursor, QFontDatabase, QGuiApplication
from PySide6.QtQml import QQmlApplicationEngine

PROJECT = Path(getattr(sys, '_MEIPASS', Path(__file__).resolve().parents[2]))
HERE = Path(__file__).resolve().parent
QUEST_RECORDS = json.loads((PROJECT / "prototype" / "data" / "quest_items.json").read_text(encoding="utf-8"))
QUEST_TASKS_BY_NAME: dict[str, list[dict]] = {}
for quest in QUEST_RECORDS:
    QUEST_TASKS_BY_NAME.setdefault(quest["name"], []).append({
        "task": quest["task"], "count": quest["quantity"], "inRaid": quest["inRaid"]
    })

DEFAULT_SETTINGS = {
    "popupBackground": "#080909",
    "popupBorder": "#59605a",
    "popupMainScale": 55,
    "popupAmmoScale": 45,
    "popupPriceBold": True,
    "showItemName": False,
    "showOcrDiagnostics": False,
    "enableAlwaysOnTop": True,
}


class PipeReceiver(QObject):
    received = Signal(dict)

    def start(self) -> None:
        threading.Thread(target=self._read, name="ipc-stdin", daemon=True).start()

    def _read(self) -> None:
        for line in sys.stdin:
            try:
                msg = json.loads(line)
            except (TypeError, ValueError) as exc:
                print(f"Malformed host message: {exc}", file=sys.stderr)
                continue
            if isinstance(msg, dict):
                self.received.emit(msg)
        self.received.emit({"type": "shutdown"})


class PopupController(QObject):
    def __init__(self, app: QGuiApplication, root: QObject, args: argparse.Namespace):
        super().__init__()
        self.app, self.root, self.args = app, root, args
        self.config = dict(DEFAULT_SETTINGS)
        self.current_seq = -1
        self.pending = False
        self.last_message: dict = {}

    @Slot(dict)
    def on_message(self, message: dict) -> None:
        action = message.get("type")
        seq = message.get("seq")
        if isinstance(seq, int):
            if seq < self.current_seq:
                return
            self.current_seq = seq
        if action == "shutdown":
            self.app.quit()
        elif action == "hide":
            self.pending = False
            self.root.setProperty("payload", {})
            self.root.setProperty("visible", False)
        elif action == "config":
            self.config.update(message.get("config") or {})
            self.root.setProperty("settings", self.config)
        elif action == "item":
            item = message.get("item")
            if not isinstance(item, dict):
                return
            self.config.update(message.get("config") or {})
            self.root.setProperty("visible", False)
            self.root.setProperty("opacity", 0.0)
            self.root.setProperty("settings", dict(self.config))
            if item.get("ammoStats") is None:
                # Preserve the original React tooltip's exact-name quest list,
                # rather than substituting unrelated API task records.
                item = {**item, "tasks": QUEST_TASKS_BY_NAME.get(item.get("name", ""), [])}
            self.root.setProperty("payload", item)
            self.last_message = message
            self.pending = True
            # Let Qt Quick polish the new text and layouts while hidden.
            QTimer.singleShot(55, self._show_ready_item)

    def _show_ready_item(self) -> None:
        if not self.pending:
            return
        self.pending = False
        self.app.processEvents()
        # Qt exposes desktop positions in device-independent coordinates.
        # Use Qt's QCursor rather than unconverted Win32 physical pixel values.
        cursor = QCursor.pos()
        screen = QGuiApplication.screenAt(cursor) or QGuiApplication.primaryScreen()
        if screen is None:
            return
        rect = screen.availableGeometry()
        w = max(1, int(self.root.property("width")))
        h = max(1, int(self.root.property("height")))
        pad = 13
        x, y = cursor.x() + pad, cursor.y() + pad
        if x + w > rect.right():
            x = cursor.x() - w - pad
        if y + h > rect.bottom():
            y = cursor.y() - h - pad
        x = min(max(x, rect.left()), max(rect.left(), rect.right() - w + 1))
        y = min(max(y, rect.top()), max(rect.top(), rect.bottom() - h + 1))
        self.root.setProperty("x", x)
        self.root.setProperty("y", y)
        self.root.setProperty("visible", True)
        # The initial Qt Quick scene-graph pass may finish layout after show.
        # Keep opacity zero until that pass finishes, avoiding a visible jump.
        QTimer.singleShot(40, lambda seq=self.current_seq: self._reveal(seq))

    def _reveal(self, seq: int) -> None:
        if seq != self.current_seq or not self.root.property("visible"):
            return
        self.app.processEvents()
        self.root.setProperty("opacity", 1.0)
        w, h = int(self.root.property("width")), int(self.root.property("height"))
        print(f"QT_SHOW {w}x{h}", file=sys.stderr, flush=True)


def register_local_fonts() -> None:
    """Register user's existing in-workspace font resources (not redistributed)."""
    fontdir = PROJECT / "assets" / "fonts"
    for path in sorted(fontdir.glob("*")):
        if path.suffix.lower() in {".ttf", ".otf"}:
            if QFontDatabase.addApplicationFont(str(path)) < 0:
                print(f"Font not loaded: {path.name}", file=sys.stderr)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--demo", choices=["price", "quest", "ammo"],
                        help="show a built-in sample without OCR/Electron")
    parser.add_argument("--screenshot", type=Path,
                        help="capture an image of the Qt window")
    parser.add_argument("--exit-after", type=float, default=0,
                        help="exit after N seconds (automated smoke tests)")
    args = parser.parse_args()
    app = QGuiApplication(sys.argv[:1])
    app.setApplicationName("Tarkov Tooltips Qt Prototype")
    register_local_fonts()
    engine = QQmlApplicationEngine()
    engine.load(QUrl.fromLocalFile(str(PROJECT / "prototype" / "qml" / "Popup.qml")))
    if not engine.rootObjects():
        print("QML load failed", file=sys.stderr)
        return 2
    window = engine.rootObjects()[0]
    controller = PopupController(app, window, args)
    pipe = PipeReceiver()
    pipe.received.connect(controller.on_message)
    if args.demo:
        sample = PROJECT / "prototype" / "samples" / (args.demo + ".json")
        sample = json.loads(sample.read_text(encoding="utf-8"))
        QTimer.singleShot(0, lambda: controller.on_message({
            "type": "item", "seq": 1, "item": sample, "config": DEFAULT_SETTINGS
        }))
    else:
        pipe.start()
        print("READY", flush=True)

    if args.screenshot:
        def screenshot() -> None:
            img = QGuiApplication.primaryScreen().grabWindow(window.winId())
            args.screenshot.parent.mkdir(parents=True, exist_ok=True)
            if not img.isNull() and img.save(str(args.screenshot)):
                print(f"SCREENSHOT {args.screenshot} {img.width()}x{img.height()}",
                      file=sys.stderr, flush=True)
            else:
                print("SCREENSHOT_FAILED", file=sys.stderr, flush=True)
        QTimer.singleShot(1500, screenshot)
    if args.exit_after > 0:
        QTimer.singleShot(round(args.exit_after * 1000), app.quit)
    return app.exec()


if __name__ == "__main__":
    sys.exit(main())
