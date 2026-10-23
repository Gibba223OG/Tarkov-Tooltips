# Qt popup sidecar (source)

Active tooltip backend for Tarkov Tooltips v1.00.
- prototype/python/qt_popup.py: PySide6 host, JSON-line IPC.
- prototype/qml/: verified native price/quest/ammo layouts.
- prototype/data/quest_items.json: quest names for Qt fallback.
- prototype/samples/: input samples for stand-alone testing.

Local development from this directory after installing PySide6-Essentials 6.10.3:
    python prototype/python/qt_popup.py --demo ammo --exit-after 3

Do not distribute Bender or Nunito fonts without confirming their licenses; fonts are omitted from GitHub source.
The packaged helper requires the entire PyInstaller runtime in qt-popup-dist/TarkovTooltipsQtPopup.
