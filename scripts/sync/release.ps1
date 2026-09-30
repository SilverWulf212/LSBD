<#
.SYNOPSIS
  Deploys a tagged release of the sync engine to the release worktree
  C:\ProgramData\lsbd-sync\app. Scheduled tasks run ONLY from there, never from
  the dev working copy.

.DESCRIPTION
  1. Tags HEAD of the repo as -Tag (e.g. sync-v2) if the tag does not exist.
  2. First run: git worktree add <app> <tag> (detached).
     Later runs: git -C <app> checkout --detach <tag>.
  3. npm ci --omit=dev in the worktree. tsx is needed at runtime, so if the
     --omit=dev install drops it, falls back to plain `npm ci`.
  4. Prints the deployed tag and commit.

  Idempotent. Run elevated. Local only: never pushes.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\sync\release.ps1 -Tag sync-v1
#>
param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^sync-v\d+$')]
  [string]$Tag,
  [string]$AppDir = 'C:\ProgramData\lsbd-sync\app'
)

$ErrorActionPreference = 'Stop'

$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  throw 'release.ps1 must be run elevated (Administrator).'
}

$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
Write-Host "Repo (dev copy): $repo"

function Invoke-Git {
  param([string[]]$GitArgs)
  & git @GitArgs
  if ($LASTEXITCODE -ne 0) { throw "git $($GitArgs -join ' ') failed with exit code $LASTEXITCODE" }
}

# 1. Tag HEAD if absent.
& git -C $repo rev-parse -q --verify "refs/tags/$Tag" *> $null
if ($LASTEXITCODE -ne 0) {
  Invoke-Git @('-C', $repo, 'tag', $Tag)
  Write-Host "Created tag $Tag at HEAD."
} else {
  Write-Host "Tag $Tag already exists; not moving it."
}

# 2. Worktree.
New-Item -ItemType Directory -Force -Path (Split-Path $AppDir -Parent) | Out-Null
$appNorm = ($AppDir -replace '\\', '/').TrimEnd('/')
$registered = $false
foreach ($line in (& git -C $repo worktree list --porcelain)) {
  if ($line -like 'worktree *') {
    $wt = ($line.Substring(9) -replace '\\', '/').TrimEnd('/')
    if ($wt -ieq $appNorm) { $registered = $true }
  }
}

if ($registered) {
  Invoke-Git @('-C', $AppDir, 'checkout', '--detach', $Tag)
} else {
  if (Test-Path $AppDir) { throw "$AppDir exists but is not a worktree of $repo; refusing to touch it." }
  Invoke-Git @('-C', $repo, 'worktree', 'add', '--detach', $AppDir, $Tag)
}

# 3. Dependencies.
$tsx = Join-Path $AppDir 'node_modules\tsx\dist\cli.mjs'
Push-Location $AppDir
try {
  & npm.cmd ci --omit=dev --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) { throw "npm ci --omit=dev failed ($LASTEXITCODE)" }
  if (-not (Test-Path $tsx)) {
    Write-Host 'tsx is a devDependency and was omitted; falling back to plain npm ci.'
    & npm.cmd ci --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { throw "npm ci failed ($LASTEXITCODE)" }
  }
} finally {
  Pop-Location
}
if (-not (Test-Path $tsx)) { throw "tsx CLI missing at $tsx after install." }

# 4. Report.
$commit = (& git -C $AppDir rev-parse HEAD).Trim()
$desc = (& git -C $AppDir describe --tags).Trim()
Write-Host "Deployed tag: $Tag  (describe: $desc)"
Write-Host "Deployed commit: $commit"
