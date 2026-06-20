$ErrorActionPreference = "Continue"

$logPath = Join-Path (Split-Path -Parent $PSScriptRoot) "windows-crash-mitigation.log"
function Log($message) {
  $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  "$timestamp $message" | Tee-Object -FilePath $logPath -Append
}

Log "Starting crash mitigation changes"

Log "Setting Start menu power button to Hibernate on AC/DC"
powercfg /setacvalueindex SCHEME_CURRENT SUB_BUTTONS UIBUTTON_ACTION 1
Log "UIBUTTON_ACTION AC exit code: $LASTEXITCODE"
powercfg /setdcvalueindex SCHEME_CURRENT SUB_BUTTONS UIBUTTON_ACTION 1
Log "UIBUTTON_ACTION DC exit code: $LASTEXITCODE"

Log "Setting lid close action to Hibernate on AC/DC"
powercfg /setacvalueindex SCHEME_CURRENT SUB_BUTTONS LIDACTION 2
Log "LIDACTION AC exit code: $LASTEXITCODE"
powercfg /setdcvalueindex SCHEME_CURRENT SUB_BUTTONS LIDACTION 2
Log "LIDACTION DC exit code: $LASTEXITCODE"

Log "Setting physical power button action to Hibernate on AC/DC"
powercfg /setacvalueindex SCHEME_CURRENT SUB_BUTTONS PBUTTONACTION 2
Log "PBUTTONACTION AC exit code: $LASTEXITCODE"
powercfg /setdcvalueindex SCHEME_CURRENT SUB_BUTTONS PBUTTONACTION 2
Log "PBUTTONACTION DC exit code: $LASTEXITCODE"

powercfg /setactive SCHEME_CURRENT
Log "Re-applied current power scheme, exit code: $LASTEXITCODE"

Log "Disabling Fast Startup"
reg add "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Power" /v HiberbootEnabled /t REG_DWORD /d 0 /f
Log "Fast Startup registry exit code: $LASTEXITCODE"

$lewittRun = "HKLM\Software\Microsoft\Windows\CurrentVersion\Run"
$lewittDisabled = "HKLM\Software\Microsoft\Windows\CurrentVersion\Run-Disabled"
$lewittCommand = "C:\Program Files\LEWITT\LEWITT CONTROL CENTER\LEWITT CONTROL CENTER.exe"

Log "Saving LEWITT startup entry under Run-Disabled"
reg add $lewittDisabled /v Lewitt_Control_Center /t REG_SZ /d $lewittCommand /f
Log "LEWITT Run-Disabled registry exit code: $LASTEXITCODE"

Log "Removing LEWITT startup entry from Run"
reg delete $lewittRun /v Lewitt_Control_Center /f
Log "LEWITT Run delete registry exit code: $LASTEXITCODE"

Log "Completed crash mitigation changes"
