# Compiled release / editable source mapping (v1.01)

| Released artifact | Source / audit reference |
|---|---|
| resources/app.asar .webpack/main/index.js | main/index.ts (maintained integration points); runtime-reference/main/index.js (exact released JavaScript) |
| .webpack/main/live_data.js | models/TarkovLiveData.js (exact released code, module imported by source) |
| .webpack/renderer/main_window/status_panel.js | renderer/status_panel.js (exact released code) |
| .webpack/renderer/main_window/index.js | renderer/components/Settings.tsx and other React files, plus runtime-reference/renderer/main_window/index.js |
| .webpack/renderer/main_window/preload.js | main/preloads/main.ts and runtime-reference counterpart |
| resources/TarkovTooltipsQtPopup/_internal/prototype/qml/PriceCard.qml | qt-popup/prototype/qml/PriceCard.qml (identical bytes) |
| Qt Python companion executable | qt-popup/prototype/python/qt_popup.py (latest active source, rebuild requires PyInstaller and PySide6) |
| Native scanner and RapidOCR EXEs | lib/ocr_cpp, rapidocr_worker.py + third-party packages/model weights (not redistributed here) |

The bundled JS audit reference is the authoritative record of **what
v1.01 actually ran**. Build parity from edited TypeScript has not been
independently demonstrated.
