<#
.SYNOPSIS
  Pause or resume the scheduled LSBD sync tasks (LSBD Sync Quick / Weekend / Full).

.DESCRIPTION
  IMPORTANT: the integration-test suite (`npm run test:it`) writes synthetic
  rows into lsbd_raw. Scheduled syncs must not overlap with it. Implementers:
  run `pause-tasks.ps1 -Pause` BEFORE `npm run test:it`, and
  `pause-tasks.ps1 -Resume` AFTER (use try/finally so a failed test run never
  leaves the tasks disabled).

  -Pause  disables every 'LSBD Sync*' task, then waits (default up to 1200 s)
          for any run already in progress to finish. Exits 1 if one is still
          running at the deadline.
  -Resume enables every 'LSBD Sync*' task again.

  Run elevated.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\sync\pause-tasks.ps1 -Pause
  npm run test:it
  powershell -ExecutionPolicy Bypass -File scripts\sync\pause-tasks.ps1 -Resume
#>
param(
  [switch]$Pause,
  [switch]$Resume,
  [int]$WaitSeconds = 1200
)

$ErrorActionPreference = 'Stop'

if (($Pause -and $Resume) -or (-not $Pause -and -not $Resume)) {
  Write-Host 'Specify exactly one of -Pause or -Resume.'
  exit 64
}

$tasks = @(Get-ScheduledTask -TaskName 'LSBD Sync*')
if ($tasks.Count -eq 0) { Write-Host 'No LSBD Sync* tasks registered.'; exit 0 }

if ($Pause) {
  foreach ($t in $tasks) { Disable-ScheduledTask -TaskName $t.TaskName | Out-Null }
  $deadline = (Get-Date).AddSeconds($WaitSeconds)
  do {
    $running = @(Get-ScheduledTask -TaskName 'LSBD Sync*' | Where-Object { $_.State -eq 'Running' })
    if ($running.Count -eq 0) { break }
    Write-Host ("Waiting for running task(s): " + (($running | ForEach-Object { $_.TaskName }) -join ', '))
    Start-Sleep -Seconds 10
  } while ((Get-Date) -lt $deadline)
  Get-ScheduledTask -TaskName 'LSBD Sync*' | Select-Object TaskName, State | Format-Table -AutoSize
  if ($running.Count -gt 0) { Write-Host 'A sync run is still in progress after the wait.'; exit 1 }
  Write-Host 'Paused. Remember -Resume after test:it.'
} else {
  foreach ($t in $tasks) { Enable-ScheduledTask -TaskName $t.TaskName | Out-Null }
  Get-ScheduledTask -TaskName 'LSBD Sync*' | Select-Object TaskName, State | Format-Table -AutoSize
  Write-Host 'Resumed.'
}
