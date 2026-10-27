; Tarkov Tooltips v1.02 -- SMALL ONLINE INSTALLER
; The verified flat installer payload is downloaded from the PUBLIC 1.02 release.
; The regular user-facing portable ZIP has its own wrapper directory and is NOT
; used by the installer. Both archives contain the same application files.
; Release asset: Tarkov-Tooltips-v1.02-Win64-InstallerPayload.zip
; Keep AppId stable for future versions.
; User must publish that exact ZIP before the online installer can complete.
#define MyAppName "Tarkov Tooltips"
#define MyAppVer "1.02"
#define MyExe "Tarkov Tooltips.exe"

[Setup]
AppId={{5560F421-52B3-4FCB-A729-FEDC8DE5BD10}
AppName={#MyAppName}
AppVersion={#MyAppVer}
AppVerName={#MyAppName} v{#MyAppVer}
AppPublisher=Gibba223OG
AppPublisherURL=https://github.com/Gibba223OG/Tarkov-Tooltips
AppSupportURL=https://github.com/Gibba223OG/Tarkov-Tooltips/issues
AppUpdatesURL=https://github.com/Gibba223OG/Tarkov-Tooltips/releases
DefaultDirName={localappdata}\Programs\Tarkov Tooltips
DisableDirPage=no
UsePreviousAppDir=yes
DefaultGroupName=Tarkov Tooltips
AllowNoIcons=yes
UninstallDisplayIcon={app}\{#MyExe}
UninstallDisplayName={#MyAppName} v{#MyAppVer}
PrivilegesRequired=lowest
WizardStyle=modern
ArchitecturesAllowed=x64compatible
CloseApplications=no
RestartApplications=no
ChangesEnvironment=no
ArchiveExtraction=full
Compression=lzma2/max
SolidCompression=yes
OutputDir=C:\ChatGPT Workspace\PriceChecker\Diagnostics\WorkFolders\Release_v1.02_20261027
OutputBaseFilename=Tarkov-Tooltips-v1.02.Win64
SetupIconFile=C:\ChatGPT Workspace\PriceChecker\Diagnostics\WorkFolders\PublishSource-v1.02\Tarkov-Tooltips-Source\favicon.ico
; Downloaded payload is hashed and extracted; the ZIP is NOT left in {app}.

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Create a desktop shortcut"; GroupDescription: "Additional shortcuts:"; Flags: unchecked

[Files]
Source: "https://github.com/Gibba223OG/Tarkov-Tooltips/releases/download/1.02/Tarkov-Tooltips-v1.02-Win64-InstallerPayload.zip"; DestName: "Tarkov-Tooltips-v1.02-Win64-InstallerPayload.zip"; DestDir: "{app}"; ExternalSize: 771074272; Hash: "bf6776f8cc4ba2087c18bdb1852c0e4940788f7455e6c7aaa503c4a3a910c269"; Flags: external download extractarchive ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\Tarkov Tooltips"; Filename: "{app}\{#MyExe}"
Name: "{autodesktop}\Tarkov Tooltips"; Filename: "{app}\{#MyExe}"; Tasks: desktopicon

[Run]
Filename: "{app}\Tarkov Tooltips.exe"; Description: "Launch Tarkov Tooltips"; Flags: nowait postinstall skipifsilent
