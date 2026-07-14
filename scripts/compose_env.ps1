# Docker compose helper: charlie (dev) | bravo (QA) | alpha (prod)
param(
  [Parameter(Mandatory = $true, Position = 0)]
  [ValidateSet("charlie", "bravo", "alpha")]
  [string]$EnvName,

  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$ComposeArgs = @("up", "--build", "-d")
)

$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $root

$files = @(
  "-f", "docker-compose.yml",
  "-f", "docker-compose.$EnvName.yml"
)

Write-Host ">>> $EnvName :: docker compose $($ComposeArgs -join ' ')" -ForegroundColor Cyan
docker compose -p $EnvName @files @ComposeArgs
