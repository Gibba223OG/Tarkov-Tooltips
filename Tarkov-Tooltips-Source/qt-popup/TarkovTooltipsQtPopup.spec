# Portable Qt/PyInstaller spec: current v1.01 QML/Python, NOT a reference to VM paths.
from pathlib import Path
ROOT = Path(SPECPATH).resolve()
PROJECT = ROOT / 'prototype'
DATAS = [
    (str(PROJECT / 'qml'), 'prototype/qml'),
    (str(PROJECT / 'data'), 'prototype/data'),
    (str(PROJECT / 'samples'), 'prototype/samples'),
    (str(PROJECT / 'assets'), 'prototype/assets'),
]
FONTS = ROOT / 'assets' / 'fonts'
if not FONTS.is_dir() or not any(FONTS.iterdir()):
    raise RuntimeError('Local licensed fonts missing: qt-popup/assets/fonts; see BUILD_WINDOWS.md')
DATAS.append((str(FONTS), 'assets/fonts'))
a = Analysis([str(PROJECT / 'python' / 'qt_popup.py')], pathex=[str(ROOT)], binaries=[], datas=DATAS,
             hiddenimports=['PySide6.QtQuick'], hookspath=[], hooksconfig={}, runtime_hooks=[],
             excludes=[], noarchive=False, optimize=0)
pyz = PYZ(a.pure)
exe = EXE(pyz,a.scripts,[],exclude_binaries=True,name='TarkovTooltipsQtPopup',
          debug=False,bootloader_ignore_signals=False,strip=False,upx=False,console=True)
coll = COLLECT(exe,a.binaries,a.datas,strip=False,upx=False,name='TarkovTooltipsQtPopup')
