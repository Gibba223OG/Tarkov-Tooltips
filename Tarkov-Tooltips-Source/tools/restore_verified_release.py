#!/usr/bin/env python3
"""Restore the published v1.01 Windows binaries from GitHub, with pinned hash.
Python stdlib only. Never runs the app or edits an existing directory.
"""
import argparse,hashlib,json,shutil,stat,sys,urllib.request,zipfile
from pathlib import Path,PurePosixPath

URL=("https://github.com/Gibba223OG/Tarkov-Tooltips/releases/download/1.01/"
     "Tarkov-Tooltips-v1.01-Win64-Portable.zip")
SHA="7fb863ec8906d0f07db602e8339d10e82a723f29f0f34094bdf53f2c33df1977"
SIZE=305097699
FILES=1897
EXPANDED=770545993
PREFIX="Tarkov-Tooltips-v1.01-Win64-Portable"
REQUIRED=[
"Tarkov Tooltips.exe","resources/app.asar",
"resources/ocr/ocr_cpp.exe",
"resources/ocr/configure_screen.exe",
"resources/ocr/rapidocr_worker/PriceCheckerRapidOCR.exe",
"resources/TarkovTooltipsQtPopup/TarkovTooltipsQtPopup.exe",
"resources/TarkovTooltipsQtPopup/_internal/prototype/qml/PriceCard.qml"]
def progress(stage,done,total):
    n=round(30*done/total)
    print(f"\r{stage} [{'#'*n}{'-'*(30-n)}] {done}/{total}   ",end="\n" if done==total else "",flush=True)
def digest(path):
    h=hashlib.sha256()
    with path.open("rb") as f:
        for block in iter(lambda:f.read(4*1024*1024),b""):h.update(block)
    return h.hexdigest()
def inventory(z):
    files=[];seen=set();size=0
    for info in z.infolist():
        if info.is_dir():continue
        p=PurePosixPath(info.filename)
        mode=info.external_attr>>16
        if (p.is_absolute() or len(p.parts)<2 or p.parts[0]!=PREFIX
            or any(v in (".","..") for v in p.parts)
            or any(c in info.filename for c in ("\\",":","\0"))
            or (mode&0o170000) not in (0,stat.S_IFREG)):
            raise ValueError(f"Unsafe archive path: {info.filename}")
        rel=Path(*p.parts[1:])
        key=str(rel).casefold()
        if key in seen:raise ValueError(f"Case-colliding path: {rel}")
        seen.add(key);files.append((info,rel));size+=info.file_size
        if size>EXPANDED:raise ValueError("Expanded size exceeds expected total")
    missing=[p for p in REQUIRED if str(Path(p)).casefold() not in seen]
    if len(files)!=FILES or size!=EXPANDED or missing:
        raise ValueError(f"Archive layout mismatch: files={len(files)} bytes={size} missing={missing}")
    return files
def main():
    p=argparse.ArgumentParser(description="Restore v1.01 native+Electron portable from the signed-off published release digest")
    p.add_argument("--destination",type=Path,help="New non-existing output folder")
    p.add_argument("--archive",type=Path,help="Use a previously obtained ZIP, checked against official SHA-256")
    p.add_argument("--verify-only",action="store_true",help="Verify existing ZIP without extraction")
    a=p.parse_args()
    if (not a.verify_only and a.destination is None) or (a.verify_only and a.archive is None):
        p.error("Restoration requires --destination; --verify-only requires --archive")
    dest=a.destination.resolve() if a.destination else None
    if dest is not None and (dest.exists() or not dest.parent.is_dir()):
        raise ValueError("Destination must not exist; its parent directory must exist")
    downloaded=a.archive is None
    src=(a.archive.resolve() if a.archive else dest.parent/(dest.name+".download-in-progress.zip"))
    if downloaded:
        if src.exists():raise ValueError(f"Refusing overwrite of partial ZIP: {src}")
        req=urllib.request.Request(URL,headers={"User-Agent":"TarkovTooltipsRecovery/1"})
        with urllib.request.urlopen(req,timeout=60) as response,src.open("xb") as f:
            total=0
            while b:=response.read(1024*1024):
                total+=len(b)
                if total>SIZE:raise ValueError("Unexpected download size")
                f.write(b);progress("Download bytes",total,SIZE)
            if total!=SIZE:raise ValueError("Incomplete download")
    if not src.is_file() or src.stat().st_size!=SIZE:raise ValueError("ZIP absent or size mismatch")
    got=digest(src)
    if got!=SHA:raise ValueError(f"SHA256 mismatch: {got} != {SHA}")
    print("Official release digest verified:",got,flush=True)
    with zipfile.ZipFile(src) as z:
        entries=inventory(z)
        print(f"Archive layout verified: {len(entries)} files",flush=True)
        if a.verify_only:
            print("PASS: No extraction or file modifications performed.");return
        dest.mkdir()
        for i,(entry,rel) in enumerate(entries,1):
            target=dest/rel;target.parent.mkdir(parents=True,exist_ok=True)
            with z.open(entry) as inp,target.open("xb") as out:
                shutil.copyfileobj(inp,out,1024*1024)
            if target.stat().st_size!=entry.file_size:raise ValueError(f"Bad extracted size: {rel}")
            progress("Extract files",i,len(entries))
        for name in REQUIRED:
            if not (dest/name).is_file():raise ValueError(f"Missing required runtime: {name}")
    receipt={"result":"PASS","release_url":URL,"release_sha256":got,"files":len(entries),
             "unpacked_bytes":EXPANDED,"note":"Restored published native binaries; this is NOT a clean source rebuild"}
    (dest/"RESTORE_RECEIPT.json").write_text(json.dumps(receipt,indent=2)+"\n",encoding="utf8")
    if downloaded:src.unlink()
    print(f"PASS: Verified portable restored at {dest}",flush=True)
if __name__=="__main__":
    try:main()
    except Exception as exc:
        print("RESTORE FAILED:",exc,file=sys.stderr,flush=True)
        sys.exit(1)
