<#
.SYNOPSIS
  Protect-NodeModulesDir: pre-creates an EMPTY node_modules directory that only SYSTEM and
  Administrators can touch (review M9, ruling R42).

.DESCRIPTION
  The sync tasks run node as SYSTEM from C:\ProgramData\lsbd-sync\app. A module that is not
  found in app\node_modules is looked up by walking up the tree: C:\ProgramData\node_modules
  and C:\node_modules. Both are creatable by Users by default, which would let any user plant
  code that SYSTEM loads on a domain controller. install-task.ps1 dot-sources this file and
  calls Protect-NodeModulesDir for both paths.

  - Missing: created.
  - Existing and EMPTY: owner set to Administrators (so no user keeps WRITE_DAC as owner), ACL
    reset, inheritance removed, SYSTEM + Administrators Full only.
  - Existing and NOT empty: throws (fail closed). Someone must inspect and remove the content.
  Idempotent. Needs an elevated session.
#>
function Protect-NodeModulesDir {
  param([Parameter(Mandatory = $true)][string]$Path)
  $ErrorActionPreference = 'Stop'

  if (Test-Path -LiteralPath $Path) {
    $item = Get-Item -LiteralPath $Path -Force
    if (-not $item.PSIsContainer) { throw "$Path exists and is not a directory; inspect and remove it." }
    $content = @(Get-ChildItem -LiteralPath $Path -Force)
    if ($content.Count -gt 0) {
      throw "$Path is not empty ($($content.Count) entries). Node would load modules from it as SYSTEM; inspect and remove its contents, then re-run."
    }
  } else {
    New-Item -ItemType Directory -Path $Path | Out-Null
  }

  & icacls.exe $Path /setowner '*S-1-5-32-544' | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "icacls /setowner on $Path failed ($LASTEXITCODE)" }
  & icacls.exe $Path /reset | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "icacls /reset on $Path failed ($LASTEXITCODE)" }
  & icacls.exe $Path /inheritance:r /grant:r '*S-1-5-18:(OI)(CI)F' '*S-1-5-32-544:(OI)(CI)F' | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "icacls on $Path failed ($LASTEXITCODE)" }
}
