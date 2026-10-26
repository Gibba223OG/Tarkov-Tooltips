#!/usr/bin/env python3
"""Rebuild Qt, OCR, both C++ capture/calibration tools, and Electron from
maintained source. The third-party fonts are recovered locally from the
SHA-pinned verified v1.01 public release.
Never edits the known-working reference portable or uploads anything to GitHub.
Windows + Visual Studio 2022 Build Tools + Node/npm + two Python envs required.
"""
from pathlib import Path
import argparse, hashlib, json, os, shutil, subprocess, sys, tempfile, urllib.request, zipfile
ROOT = Path(__file__).resolve().parents[1]
NUGET_URL = "https://api.nuget.org/v3-flatcontainer/nlohmann.json/3.12.0/nlohmann.json.3.12.0.nupkg"
NUGET_SHA = "88777c34865f4da2621dd9adcdf708cfddd2d529b4b9f67f5dea1a2cb4a8eb7f"
FONT_NAMES = ("bender.black.otf","bender.bold.otf","bender.light.otf","bender.regular.otf",
              "Nunito-Black.ttf","Nunito-Bold.ttf","Nunito-ExtraBold.ttf",
              "Nunito-Medium.ttf","Nunito-Regular.ttf","Nunito-SemiBold.ttf")
def run(args,cwd=ROOT):
    print("\nRUN:",subprocess.list2cmdline([str(x) for x in args]),flush=True)
    subprocess.run(list(map(str,args)), cwd=str(cwd),check=True)
def digest(p):
    h=hashlib.sha256()
    with Path(p).open("rb") as f:
        for part in iter(lambda:f.read(4*1024*1024),b""):h.update(part)
    return h.hexdigest()
def staged_assets():
    return (all((ROOT/"renderer"/"styles"/n).is_file() for n in FONT_NAMES)
            and (ROOT/"qt-popup/assets/fonts").is_dir()
            and (ROOT/"lib/ocr/scanningConfig.json").is_file())
def restore_stage(release):
    script=ROOT/"tools/stage_native_from_verified_release.py"
    run([sys.executable,script,"--release-dir",release,"--source-dir",ROOT])
    fonts=release/"resources/TarkovTooltipsQtPopup/_internal/assets/fonts"
    target=ROOT/"qt-popup/assets/fonts"
    target.mkdir(parents=True,exist_ok=True)
    for f in fonts.iterdir():
        if not f.is_file() or f.suffix.lower() not in (".otf",".ttf"):continue
        dest=target/f.name
        if dest.exists():
            if digest(dest)!=digest(f):raise RuntimeError("Existing modified font: "+str(dest))
        else:shutil.copy2(f,dest)
def json_include(build_root):
    nupkg=build_root/"nlohmann.json.3.12.0.nupkg"
    if not nupkg.is_file():
        print("Downloading verified nlohmann.json v3.12.0 dependency",flush=True)
        with urllib.request.urlopen(NUGET_URL,timeout=60) as res, nupkg.open("xb") as f:
            shutil.copyfileobj(res,f)
    if digest(nupkg)!=NUGET_SHA:raise RuntimeError("nlohmann NuGet SHA mismatch")
    where=build_root/"nlohmann"
    where.mkdir(exist_ok=True)
    with zipfile.ZipFile(nupkg) as z:
        for m in z.namelist():
            if m.startswith("build/native/include/nlohmann/") and not m.endswith("/"):
                target=where/Path(m).relative_to("build/native/include")
                target.parent.mkdir(parents=True,exist_ok=True)
                target.write_bytes(z.read(m))
    if not (where/"nlohmann/json.hpp").is_file():raise RuntimeError("nlohmann headers missing")
    return where
def native_scanner(build_root,vcvars,headers):
    out=build_root/"cpp";out.mkdir()
    src=ROOT/"lib/ocr_cpp/pricechecker_capture.cpp"
    cmd=out/"compile.cmd"
    # A distinct temp CMD file preserves spaces and the x64 MSVC environment.
    cmd.write_text('@echo off\ncall "'+str(vcvars)+'" >nul\nif errorlevel 1 exit /b 22\n'
                   'cl.exe /nologo /EHsc /O2 /std:c++17 /MT /DNDEBUG /DUNICODE /D_UNICODE '
                   '/I"'+str(headers)+'" /Fo"'+str(out)+'/\" /Fe"'+str(out/"ocr_cpp.exe")+'" "'
                   +str(src)+'" /link user32.lib gdi32.lib shcore.lib shell32.lib\n'
                   'exit /b %errorlevel%\n',encoding="utf-8")
    # Use the same portable compiler flags verified by the 2026-10-26 rebuild.
    run(["cmd.exe","/c",cmd],cwd=out)
    binary=out/"ocr_cpp.exe"
    if not binary.is_file():raise RuntimeError("Scanner was not emitted")
    return binary
def native_calibration(build_root,vcvars,headers):
    out=build_root/"calibration";out.mkdir()
    src=ROOT/"lib/configure_screen/configure_screen.cpp"
    cmd=out/"compile.cmd"
    # Same x64 compiler flags as the capture scanner, without obsolete OCR dependencies.
    cmd.write_text('@echo off\ncall "'+str(vcvars)+'" >nul\nif errorlevel 1 exit /b 22\n'
                   'cl.exe /nologo /EHsc /O2 /std:c++17 /MT /DNDEBUG /DUNICODE /D_UNICODE '
                   '/I"'+str(headers)+'" /Fo"'+str(out)+'/" /Fe"'+str(out/"configure_screen.exe")+'" "'
                   +str(src)+'" /link user32.lib gdi32.lib shcore.lib shell32.lib\n'
                   'exit /b %errorlevel%\n',encoding="utf-8")
    run(["cmd.exe","/c",cmd],cwd=out)
    binary=out/"configure_screen.exe"
    if not binary.is_file():raise RuntimeError("Calibration executable missing")
    probe=subprocess.run([str(binary)],input="EXIT\n",capture_output=True,text=True,timeout=10)
    if probe.returncode!=0 or "HOVER OVER ITEM WITH ONE ROW" not in probe.stdout:
        raise RuntimeError("Calibration handshake/EXIT smoke test failed")
    print("Calibration source smoke: PASS",flush=True)
    return binary
def do_pyinstaller(interpreter,spec,dist,work):
    run([interpreter,"-m","PyInstaller","--noconfirm","--clean",
         "--distpath",dist,"--workpath",work,spec],cwd=ROOT)
def copy_native(src,dst):
    if not src.is_dir():raise RuntimeError("Missing built native directory: "+str(src))
    # Robocopy handles deep QtQuick/PySide6 paths that Copy-Item cannot.
    p=subprocess.run(["robocopy",str(src),str(dst),"/E","/R:0","/W:0","/NFL","/NDL","/NJH","/NJS","/NP"])
    if p.returncode>7:raise RuntimeError("Robocopy failed: "+str(p.returncode))
def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--qt-python",required=True,type=Path,help="Python environment with requirements-qt.txt")
    ap.add_argument("--ocr-python",required=True,type=Path,help="Python environment with requirements-ocr.txt")
    ap.add_argument("--release-dir",type=Path,help="Restored verified v1.01 release with RESTORE_RECEIPT.json")
    ap.add_argument("--vcvars",type=Path,default=Path(r"C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat"))
    ap.add_argument("--build-root",type=Path,help="Nonexistent SHORT directory for generated native builds")
    a=ap.parse_args()
    if a.release_dir:restore_stage(a.release_dir)
    if not staged_assets():
        raise RuntimeError("Third-party fonts or scanner config missing. See BUILD_WINDOWS.md")
    if not a.vcvars.is_file():raise RuntimeError("VS2022 vcvars64.bat missing")
    for p in (a.qt_python,a.ocr_python):
        if not p.is_file():raise RuntimeError("Python interpreter missing: "+str(p))
    build_root=(a.build_root.resolve() if a.build_root else Path(tempfile.mkdtemp(prefix="TTNative-")).resolve())
    if a.build_root:
        if build_root.exists():raise RuntimeError("Build root must not exist: "+str(build_root))
        build_root.mkdir(parents=True)
    headers=json_include(build_root)
    scanner=native_scanner(build_root,a.vcvars,headers)
    calibration=native_calibration(build_root,a.vcvars,headers)
    do_pyinstaller(a.qt_python,ROOT/"qt-popup/TarkovTooltipsQtPopup.spec",build_root/"qt-dist",build_root/"qt-work")
    do_pyinstaller(a.ocr_python,ROOT/"PriceCheckerRapidOCR.spec",build_root/"ocr-dist",build_root/"ocr-work")
    qt=build_root/"qt-dist/TarkovTooltipsQtPopup"
    ocr=build_root/"ocr-dist/PriceCheckerRapidOCR"
    if not (qt/"TarkovTooltipsQtPopup.exe").is_file() or not (ocr/"PriceCheckerRapidOCR.exe").is_file():
        raise RuntimeError("Python native binaries missing")
    copy_native(qt,ROOT/"qt-popup-dist/TarkovTooltipsQtPopup")
    copy_native(ocr,ROOT/"lib/ocr/rapidocr_worker")
    shutil.copy2(scanner,ROOT/"lib/ocr/ocr_cpp.exe")
    shutil.copy2(calibration,ROOT/"lib/ocr/configure_screen.exe")
    for name,src,target in (
        ("Qt",qt/"TarkovTooltipsQtPopup.exe",ROOT/"qt-popup-dist/TarkovTooltipsQtPopup/TarkovTooltipsQtPopup.exe"),
        ("OCR",ocr/"PriceCheckerRapidOCR.exe",ROOT/"lib/ocr/rapidocr_worker/PriceCheckerRapidOCR.exe"),
        ("Scanner",scanner,ROOT/"lib/ocr/ocr_cpp.exe"),
        ("Calibration",calibration,ROOT/"lib/ocr/configure_screen.exe")):
        if digest(src)!=digest(target):raise RuntimeError(name+" staged binary SHA mismatch")
        print(name,"compiled SHA256",digest(target),flush=True)
    run(["npm.cmd","ci","--no-audit","--no-fund"])
    run(["npx.cmd","tsc","--noEmit"])
    run(["npm.cmd","run","package"])
    final=ROOT/"out/Tarkov Tooltips-win32-x64"
    if not (final/"Tarkov Tooltips.exe").is_file():raise RuntimeError("Electron package missing")
    for n,r in (("Qt","TarkovTooltipsQtPopup/TarkovTooltipsQtPopup.exe"),
                ("OCR","ocr/rapidocr_worker/PriceCheckerRapidOCR.exe"),("Scanner","ocr/ocr_cpp.exe"),
                ("Calibration","ocr/configure_screen.exe")):
        first=(ROOT/"qt-popup-dist/TarkovTooltipsQtPopup/TarkovTooltipsQtPopup.exe" if n=="Qt"
                else ROOT/"lib/ocr/rapidocr_worker/PriceCheckerRapidOCR.exe" if n=="OCR"
                else ROOT/"lib/ocr/ocr_cpp.exe" if n=="Scanner"
                else ROOT/"lib/ocr/configure_screen.exe")
        second=final/"resources"/r
        if digest(first)!=digest(second):raise RuntimeError(n+" packaged SHA mismatch")
    print("\nPASS: source compiled Qt, OCR, C++ capture, C++ calibration and Electron.")
    print("LIMIT: third-party fonts and packaged OCR models come from verified local dependencies.")
    print("LIMIT: requires real Tarkov gameplay test; does not establish byte-for-byte stable parity.")
    print("BUILD OUTPUT:",final)
if __name__=="__main__":
    try:main()
    except Exception as e:
        print("BUILD FAILED:",str(e),file=sys.stderr,flush=True);sys.exit(1)
