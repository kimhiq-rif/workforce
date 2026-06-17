param(
  [string]$Message = "Update workforce project",
  [switch]$Push
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $projectRoot

$gitCommand = Get-Command git -ErrorAction SilentlyContinue
if ($gitCommand) {
  $git = $gitCommand.Source
} elseif (Test-Path "C:\Program Files\Git\bin\git.exe") {
  $git = "C:\Program Files\Git\bin\git.exe"
} elseif (Test-Path "C:\Program Files\Git\cmd\git.exe") {
  $git = "C:\Program Files\Git\cmd\git.exe"
} else {
  Write-Host "Git was not found in PATH."
  Write-Host "Install Git or add it to PATH, then run this script again from:"
  Write-Host $projectRoot
  exit 1
}

Write-Host "Project: $projectRoot"
& $git status --short

$changes = & $git status --porcelain
if (-not $changes) {
  Write-Host "No changes to commit."
  exit 0
}

& $git add .gitignore PROJECT_CONTEXT.md docs scripts supabase app components lib types middleware.ts package.json package-lock.json next.config.js tailwind.config.ts tsconfig.json postcss.config.js public .env.local.example next-env.d.ts
& $git commit -m $Message

if ($Push) {
  & $git push workforce HEAD
}

Write-Host "Sync complete."
