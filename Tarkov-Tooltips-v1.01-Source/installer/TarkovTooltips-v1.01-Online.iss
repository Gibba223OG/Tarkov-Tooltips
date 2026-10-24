; Tarkov Tooltips v1.01 -- SMALL ONLINE INSTALLER
; The verified flat installer payload is downloaded from the PUBLIC 1.01 release.
; The regular user-facing portable ZIP has its own wrapper directory and is NOT
; used by the installer. Both archives contain the same application files.
; Release asset: Tarkov-Tooltips-v1.01-Win64-InstallerPayload.zip
; Keep AppId stable for future versions.
; User must publish that exact ZIP before the online installer can complete.
#define MyAppName "Tarkov Tooltips"
#define MyAppVer "1.01"
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
OutputDir=C:\ChatGPT Workspace\PriceChecker\Diagnostics\WorkFolders\Installer_v1.01_20261024\build-validated
OutputBaseFilename=Tarkov-Tooltips-v1.01.Win64
SetupIconFile=C:\ChatGPT Workspace\PriceChecker\QtPopupMigration\RepoReplacement\Tarkov-Tooltips-v1.01-Source\favicon.ico
; Downloaded payload is hashed and extracted; the ZIP is NOT left in {app}.

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Create a desktop shortcut"; GroupDescription: "Additional shortcuts:"; Flags: unchecked

[Files]
Source: "https://github.com/Gibba223OG/Tarkov-Tooltips/releases/download/1.01/Tarkov-Tooltips-v1.01-Win64-InstallerPayload.zip"; DestName: "Tarkov-Tooltips-v1.01-Win64-InstallerPayload.zip"; DestDir: "{app}"; ExternalSize: 770545993; Hash: "e968312dc5ab178f6e9c13bda00c66aba3a5381b0a19e65a5f9d555bed39b23c"; Flags: external download extractarchive ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\Tarkov Tooltips"; Filename: "{app}\{#MyExe}"
Name: "{autodesktop}\Tarkov Tooltips"; Filename: "{app}\{#MyExe}"; Tasks: desktopicon

[Run]
Filename: "{app}\Tarkov Tooltips.exe"; Description: "Launch Tarkov Tooltips"; Flags: nowait postinstall skipifsilent
