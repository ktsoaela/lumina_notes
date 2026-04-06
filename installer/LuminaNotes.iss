; Optional: wraps electron-builder win-unpacked (primary installer is electron-builder NSIS).
; Build win-unpacked first: npm run build:electron:app
; Install Inno: https://jrsoftware.org/isdl.php
; Compile: ISCC.exe installer\LuminaNotes.iss

#define MyAppName "Lumina Notes"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "Lumina"
#define MyAppExeName "Lumina Notes.exe"
; Paths relative to this .iss file (installer/)
#define BuildOutput "..\release\electron\win-unpacked"

[Setup]
AppId={{A7E4F9C2-8B1D-4E6F-9C0A-3D5E7F9B2A4C}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={localappdata}\Programs\{#MyAppName}
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
OutputDir=..\release\installer
OutputBaseFilename=LuminaNotes-Setup-{#MyAppVersion}
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64
UninstallDisplayIcon={app}\{#MyAppExeName}
CloseApplications=no
InfoBeforeFile=
LicenseFile=

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
; Desktop shortcut is optional; Start menu entry is always created (see [Icons]).
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: checked

[Files]
Source: "{#BuildOutput}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{autoprograms}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "Launch Lumina Notes"; Flags: nowait postinstall skipifsilent
