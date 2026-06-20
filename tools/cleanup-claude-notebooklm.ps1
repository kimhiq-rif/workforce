$ErrorActionPreference = "Continue"

$workspace = Split-Path -Parent $PSScriptRoot
$logPath = Join-Path $workspace "claude-notebooklm-cleanup.log"

function Log($message) {
  $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  "$timestamp $message" | Tee-Object -FilePath $logPath -Append
}

function Backup-File($path) {
  if (Test-Path -LiteralPath $path) {
    $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $backup = "$path.backup.$stamp"
    Copy-Item -LiteralPath $path -Destination $backup -Force
    Log "Backed up $path to $backup"
    return $backup
  }
  Log "No file found at $path"
  return $null
}

Log "Starting Claude NotebookLM cleanup"

$settingsPath = "C:\Users\User\.claude\workforce\.claude\settings.local.json"
$settingsBackup = Backup-File $settingsPath

if (Test-Path -LiteralPath $settingsPath) {
  $json = Get-Content -LiteralPath $settingsPath -Raw | ConvertFrom-Json
  $allow = @($json.permissions.allow)

  $patterns = @(
    "notebooklm",
    "notebooklm-py",
    "claude_desktop_config.json",
    "astral.sh/uv/install.ps1",
    "uvx --from",
    "mcp-registry",
    "Claude_in_Chrome"
  )

  $kept = New-Object System.Collections.Generic.List[string]
  $removed = New-Object System.Collections.Generic.List[string]

  foreach ($entry in $allow) {
    $text = [string]$entry
    $isMatch = $false
    foreach ($pattern in $patterns) {
      if ($text -like "*$pattern*") {
        $isMatch = $true
        break
      }
    }
    if ($isMatch) {
      $removed.Add($text)
    } else {
      $kept.Add($text)
    }
  }

  $json.permissions.allow = @($kept)
  $json | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $settingsPath -Encoding UTF8

  Log "Removed $($removed.Count) suspicious permission entries from settings.local.json"
  foreach ($entry in $removed) {
    Log "Removed permission: $entry"
  }
}

$skillPath = "C:\Users\User\.claude\skills\notebooklm"
if (Test-Path -LiteralPath $skillPath) {
  $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
  $disabledPath = "C:\Users\User\.claude\skills\notebooklm.disabled.$stamp"
  Move-Item -LiteralPath $skillPath -Destination $disabledPath -Force
  Log "Moved NotebookLM skill to $disabledPath"
} else {
  Log "NotebookLM skill folder not found"
}

$roamingNotebook = "C:\Users\User\AppData\Roaming\Claude\notebooklm-py"
if (Test-Path -LiteralPath $roamingNotebook) {
  $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
  $disabledPath = "C:\Users\User\AppData\Roaming\Claude\notebooklm-py.disabled.$stamp"
  Move-Item -LiteralPath $roamingNotebook -Destination $disabledPath -Force
  Log "Moved Roaming NotebookLM package folder to $disabledPath"
} else {
  Log "Roaming NotebookLM package folder not found"
}

Log "Completed Claude NotebookLM cleanup"
