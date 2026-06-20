$ErrorActionPreference = "Continue"

$root = Split-Path -Parent $PSScriptRoot
$logPath = Join-Path $root "claude-vm-service-mitigation.log"

function Log($message) {
  $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  "$timestamp $message" | Tee-Object -FilePath $logPath -Append
}

Log "Starting Claude VM service mitigation"

Log "Querying CoworkVMService before changes"
sc.exe queryex CoworkVMService | Tee-Object -FilePath $logPath -Append
sc.exe qc CoworkVMService | Tee-Object -FilePath $logPath -Append

Log "Stopping CoworkVMService if running"
sc.exe stop CoworkVMService | Tee-Object -FilePath $logPath -Append
Log "Stop exit code: $LASTEXITCODE"

Log "Setting CoworkVMService start type to demand/manual"
sc.exe config CoworkVMService start= demand | Tee-Object -FilePath $logPath -Append
Log "Config exit code: $LASTEXITCODE"

Log "Querying CoworkVMService after changes"
sc.exe queryex CoworkVMService | Tee-Object -FilePath $logPath -Append
sc.exe qc CoworkVMService | Tee-Object -FilePath $logPath -Append

Log "Completed Claude VM service mitigation"
