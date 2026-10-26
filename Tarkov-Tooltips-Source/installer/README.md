# Tarkov Tooltips 1.01 Online Installer

Build source: `TarkovTooltips-v1.01-Online.iss`.
Requires Inno Setup 6.7.3 or a compatible newer version.

This is the **small online installer**, not an offline installer.
It downloads the flat ZIP asset from GitHub's 1.01 release
and verifies its pinned SHA-256 before extracting to the selected folder.

Do not replace the download URL with the user-facing portable ZIP:
that ZIP has a top-level folder; the installer-specific flat payload
does not. Both carry the exact same 1,897 application files.

The AppId is deliberately stable from v1.00 for installed upgrades.
Change only local `SetupIconFile` and `OutputDir` paths as needed;
never casually change AppId, hash, or URL without publishing and testing
the matching payload.

Verified isolated installer test: GitHub live download, checksum,
installation, SHA-256 verification of all 1,897 installed app files,
silent uninstall. Previous-version upgrade and user-PC/gameplay are
not verified.
