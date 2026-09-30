<#
.SYNOPSIS
  Deploys a tagged release of the sync engine to the release worktree
  C:\ProgramData\lsbd-sync\app. Scheduled tasks run ONLY from there, never from
  the dev working copy.

.DESCRIPTION
  0. Refuses to release from a dirty dev tree (tracked changes or untracked files,
     except untracked files under .superpowers/). Commit first.
  1. Pauses the 'LSBD Sync*' tasks (pause-tasks.ps1 -Pause, waits for a run in
     progress) and resumes them in a finally block.
  2. Tags HEAD as -Tag (e.g. sync-v3) if the tag does not exist.
  3. First run: git worktree add --detach <app> <tag>.
     Later runs: records the previous app HEAD, then git -C <app> checkout --detach <tag>.
  4. npm ci in the worktree (tsx is a devDependency and is needed at runtime).
  5. On ANY failure after the checkout: checks the previous commit out again, re-runs
     npm ci, then throws, so the tasks never resume on a half-deployed tree.
  6. Prints the deployed tag and commit.

  Idempotent. Run elevated. Local only: never pushes.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\sync\release.ps1 -Tag sync-v3
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
$pause = Join-Path $PSScriptRoot 'pause-tasks.ps1'
Write-Host "Repo (dev copy): $repo"

function Invoke-Git {
  param([string[]]$GitArgs)
  & git @GitArgs
  if ($LASTEXITCODE -ne 0) { throw "git $($GitArgs -join ' ') failed with exit code $LASTEXITCODE" }
}

function Install-Deps {
  Push-Location $AppDir
  try {
    & npm.cmd ci --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { throw "npm ci failed ($LASTEXITCODE)" }
  } finally {
    Pop-Location
  }
  $tsx = Join-Path $AppDir 'node_modules\tsx\dist\cli.mjs'
  if (-not (Test-Path $tsx)) { throw "tsx CLI missing at $tsx after install." }
}

# 0. Clean dev tree (untracked files under .superpowers/ are ignored).
$dirty = @(& git -C $repo status --porcelain --untracked-files=all |
           Where-Object { $_ -and ($_ -notmatch '^\?\? "?\.superpowers/') })
if ($dirty.Count -gt 0) {
  Write-Host 'Dev tree is dirty:'
  $dirty | ForEach-Object { Write-Host "  $_" }
  throw 'Refusing to release from a dirty tree. Commit or stash first.'
}

$keepPaused = $false

# 1. Pause the tasks for the whole deploy.
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $pause -Pause
if ($LASTEXITCODE -ne 0) { throw "pause-tasks.ps1 -Pause failed ($LASTEXITCODE); a sync run is still active." }

try {
  # 2. Tag HEAD if absent.
  & git -C $repo rev-parse -q --verify "refs/tags/$Tag" *> $null
  if ($LASTEXITCODE -ne 0) {
    Invoke-Git @('-C', $repo, 'tag', $Tag)
    Write-Host "Created tag $Tag at HEAD."
  } else {
    Write-Host "Tag $Tag already exists; not moving it."
  }

  # 3. Worktree.
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
    $prev = (& git -C $AppDir rev-parse HEAD).Trim()
    if ($LASTEXITCODE -ne 0 -or -not $prev) { throw 'Could not read the previous app HEAD.' }
    Write-Host "Previous app commit: $prev"
    try {
      Invoke-Git @('-C', $AppDir, 'checkout', '--detach', $Tag)
      Install-Deps
    } catch {
      $failure = $_.Exception.Message
      Write-Host "Deploy failed ($failure); rolling back to $prev"
      try {
        Invoke-Git @('-C', $AppDir, 'checkout', '--detach', $prev)
        Install-Deps
        Write-Host 'Rollback complete.'
      } catch {
        $keepPaused = $true
        throw "Deploy failed ($failure) AND rollback failed ($($_.Exception.Message)). $AppDir needs manual repair; tasks stay paused."
      }
      throw "Deploy of $Tag failed and was rolled back to ${prev}: $failure"
    }
  } else {
    if (Test-Path $AppDir) { throw "$AppDir exists but is not a worktree of $repo; refusing to touch it." }
    Invoke-Git @('-C', $repo, 'worktree', 'add', '--detach', $AppDir, $Tag)
    Install-Deps
  }

  # 6. Report.
  $commit = (& git -C $AppDir rev-parse HEAD).Trim()
  $desc = (& git -C $AppDir describe --tags).Trim()
  Write-Host "Deployed tag: $Tag  (describe: $desc)"
  Write-Host "Deployed commit: $commit"
} finally {
  if ($keepPaused) {
    Write-Host 'Leaving LSBD Sync* tasks DISABLED (app tree is in an unknown state).'
  } else {
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $pause -Resume
  }
}
