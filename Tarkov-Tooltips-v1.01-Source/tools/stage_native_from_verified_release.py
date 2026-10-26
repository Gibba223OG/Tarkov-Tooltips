#!/usr/bin/env python3
"""Stage v1.01 release-bundled native runtimes + fonts for compiling editable source.

The complete portable is restored separately with restore_verified_release.py.
All binary assets stay local and ignored by Git. No unverified uploads, overwrites,
or source changes. A repeat run only accepts identical existing staged files.
"""
from pathlib import Path
import argparse,json,shutil,sys,os,hashlib
PINNED="7fb863ec8906d0f07db602e8339d10e82a723f29f0f34094bdf53f2c33df1977"
PAIRS=[("resources/ocr","lib/ocr"),
       ("resources/TarkovTooltipsQtPopup","qt-popup-dist/TarkovTooltipsQtPopup")]
# Established by SHA-256 matching v1.01 published Qt runtime font files
# to the ORIGINAL source CSS font names on the development VM.
# These are third-party font binaries already distributed in the v1.01 release.
# They must NOT be committed to GitHub without redistribution clearance.
FONTS={
 "bender.black.otf":"5512154835bee5c441c6.otf",
 "bender.bold.otf":"fdb4a7ffbc4af0768dbd.otf",
 "bender.light.otf":"7a1109af9d40b683d843.otf",
 "bender.regular.otf":"554dbf85e7b088fa9434.otf",
 "Nunito-Black.ttf":"39982299ea6219343d60.ttf",
 "Nunito-Bold.ttf":"275dd55e10ba966bcb9b.ttf",
 "Nunito-ExtraBold.ttf":"7415babff1752bd4ea44.ttf",
 "Nunito-Medium.ttf":"06740446a9f13288701b.ttf",
 "Nunito-Regular.ttf":"9d7a6e03c6e3ed49c7ac.ttf",
 "Nunito-SemiBold.ttf":"ae592fe018d712c287a2.ttf",
}
def sha(path):
    h=hashlib.sha256()
    with path.open("rb") as f:
        while block:=f.read(1024*1024):h.update(block)
    return h.hexdigest()
def progress(i,total):
    n=round(i/total*30)
    print(f"\rStage release assets [{'#'*n}{'-'*(30-n)}] {i}/{total}",end="\n" if i==total else "",flush=True)
def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--release-dir",required=True,type=Path)
    ap.add_argument("--source-dir",type=Path,default=Path(__file__).resolve().parents[1])
    a=ap.parse_args()
    prefix=(chr(92)*2)+"?"+chr(92) if os.name=="nt" else ""
    release=Path(prefix+str(a.release_dir.resolve()));src=Path(prefix+str(a.source_dir.resolve()))
    receipt=release/"RESTORE_RECEIPT.json"
    if not receipt.is_file():raise RuntimeError("Use the verified release restore script first")
    r=json.loads(receipt.read_text(encoding="utf8"))
    if r.get("result")!="PASS" or r.get("release_sha256")!=PINNED:
        raise RuntimeError("Restored release receipt is missing or has unexpected digest")
    if not (src/"package.json").is_file() or not (src/"forge.config.ts").is_file():
        raise RuntimeError("Not an Electron/Forge source checkout")
    files=[]
    for fr,to in PAIRS:
        origin=release/fr;dest=src/to
        if not origin.is_dir():raise FileNotFoundError(origin)
        for base,dirs,names in os.walk(origin,followlinks=False):
            if any((Path(base)/v).is_symlink() for v in dirs):
                raise RuntimeError("Junction/symlink found in native runtime")
            for n in names:
                p=Path(base)/n
                if p.is_symlink():raise RuntimeError("Symlink found in source runtime")
                files.append((p,dest/p.relative_to(origin)))
    fontroot=release/"resources/TarkovTooltipsQtPopup/_internal/assets/fonts"
    for name,hashname in FONTS.items():
        f=fontroot/hashname
        if not f.is_file() or f.suffix!=(Path(name).suffix):
            raise RuntimeError(f"Cannot recover release font: {hashname}")
        files.append((f,src/"renderer"/"styles"/name))
    # Validate collisions before performing any write.
    for fr,to in files:
        if to.is_symlink():raise RuntimeError(f"Refusing existing symbolic link: {to}")
        if to.exists() and sha(fr)!=sha(to):
            raise RuntimeError(f"Refusing to overwrite a modified local file: {to}")
    print(f"Stage {len(files)} release assets (native runtimes and 10 fonts); no source edits.",flush=True)
    copied=skipped=0
    for i,(fr,to) in enumerate(files,1):
        if to.exists():skipped+=1
        else:
            to.parent.mkdir(exist_ok=True,parents=True)
            shutil.copy2(fr,to);copied+=1
            if sha(fr)!=sha(to):raise RuntimeError("Staged copy SHA-256 mismatch")
        progress(i,len(files))
    print(f"PASS staged {copied} files, {skipped} preexisting exact copies. No files overwritten.")
    print("Native runtimes/fonts come from published v1.01 binaries; NOT independently source-built.")
if __name__=="__main__":
    try:main()
    except Exception as e:
        print("STAGE FAILED:",e,file=sys.stderr,flush=True);sys.exit(1)
