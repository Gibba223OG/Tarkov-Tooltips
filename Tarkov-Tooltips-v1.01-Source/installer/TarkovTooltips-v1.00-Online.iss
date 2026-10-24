; Tarkov Tooltips v1.00 -- SMALL ONLINE INSTALLER
; The portable ZIP is downloaded from the PUBLIC GitHub Release tagged 1.00.
; Release asset: Tarkov-Tooltips-v1.00-Win64-Portable.zip
; Keep AppId stable for future versions.
; User must publish that exact ZIP before the online installer can complete.
#define MyAppName "Tarkov Tooltips"
#define MyAppVer "1.00"
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
OutputDir=C:\ChatGPT Workspace\PriceChecker\QtPopupMigration\RepoReplacement\release-assets
OutputBaseFilename=Tarkov-Tooltips-v1.00.Win64
SetupIconFile=C:\ChatGPT Workspace\PriceChecker\QtPopupMigration\RepoReplacement\Tarkov-Tooltips-v1.00-Source\favicon.ico
; Downloaded payload is hashed and extracted; the ZIP is NOT left in {app}.

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Create a desktop shortcut"; GroupDescription: "Additional shortcuts:"; Flags: unchecked

[Files]
Source: "https://github.com/Gibba223OG/Tarkov-Tooltips/releases/download/1.00/Tarkov-Tooltips-v1.00-Win64-Portable.zip"; DestName: "Tarkov-Tooltips-v1.00-Win64-Portable.zip"; DestDir: "{app}"; ExternalSize: 770491834; Hash: "cdaf61c9d5de823bc4643c0467a3e64ef220fa47a35f636298c5961841cc217a"; Flags: external download extractarchive ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\Tarkov Tooltips"; Filename: "{app}\{#MyExe}"
Name: "{autodesktop}\Tarkov Tooltips"; Filename: "{app}\{#MyExe}"; Tasks: desktopicon

[Run]
Filename: "{app}\Tarkov Tooltips.exe"; Description: "Launch Tarkov Tooltips"; Flags: nowait postinstall skipifsilent
