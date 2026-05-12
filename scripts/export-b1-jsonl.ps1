$ErrorActionPreference = 'Stop'

# Credentials come from C:\Users\Administrator\.lsbd-secrets.env (gitignored).
# Required keys: MSSQL_VM_NAME, MSSQL_USER, MSSQL_PASSWORD, MSSQL_DATABASE.
$secretsFile = 'C:\Users\Administrator\.lsbd-secrets.env'
if (-not (Test-Path $secretsFile)) {
  throw "Missing $secretsFile — required for VM credentials."
}
foreach ($line in Get-Content $secretsFile) {
  if ($line -match '^([A-Z_]+)=(.*)$') {
    [Environment]::SetEnvironmentVariable($Matches[1], $Matches[2], 'Process')
  }
}

$vmName    = $env:MSSQL_VM_NAME
$mssqlUser = $env:MSSQL_USER
$mssqlPass = $env:MSSQL_PASSWORD
$mssqlDb   = $env:MSSQL_DATABASE
if (-not $vmName -or -not $mssqlUser -or -not $mssqlPass -or -not $mssqlDb) {
  throw "MSSQL_VM_NAME / MSSQL_USER / MSSQL_PASSWORD / MSSQL_DATABASE must be set in .lsbd-secrets.env."
}

$cred = New-Object System.Management.Automation.PSCredential(
  $mssqlUser,
  (ConvertTo-SecureString $mssqlPass -AsPlainText -Force))

# Tables to export (source name on MSSQL).
$tables = @(
  # B-1a geography
  'Countries','States','Parishes','Cities','ElectionDistricts','Zipcodes',
  # B-1b lookups
  'AddressType','tblTypes','tblStatus','tblClass','tblnactiveStatus','tblSpecialties',
  'tblPrinSet','tblFormEmpl','tblReportType','ProfessionalType','PracticeType','tblSedLevels',
  'tblComplActions','tblComplClosure','tblComplDecisions','tblComplHearings','tblComplProbation','tblComplStatus',
  'tblDisposition','EducationType','PermitType','tblTransTypes','tblChargeCategory','tblChargeInt',
  # B-1c settings
  'tblFees','tblNumbers','tblDates','Control','RenewalSettings'
)

$destBase = 'D:\extracted\data'
if (-not (Test-Path $destBase)) { New-Item -ItemType Directory -Path $destBase -Force | Out-Null }

foreach ($t in $tables) {
  $outFile = Join-Path $destBase ("{0}.jsonl" -f $t)
  Write-Host "==> $t -> $outFile"

  $rows = Invoke-Command -VMName $vmName -Credential $cred -ArgumentList $t, $mssqlDb -ScriptBlock {
    param($table, $db)
    Add-Type -AssemblyName System.Data
    $cs = "Server=.;Database=$db;Integrated Security=True;TrustServerCertificate=True"
    $conn = New-Object System.Data.SqlClient.SqlConnection($cs)
    $conn.Open()
    $cmd = $conn.CreateCommand()
    $cmd.CommandText = "SELECT * FROM dbo.[$table]"
    $cmd.CommandTimeout = 300
    $rdr = $cmd.ExecuteReader()
    $out = New-Object 'System.Collections.Generic.List[hashtable]'
    while ($rdr.Read()) {
      $r = @{}
      for ($i = 0; $i -lt $rdr.FieldCount; $i++) {
        $name = $rdr.GetName($i)
        $val = $rdr.GetValue($i)
        if ($val -is [DBNull]) { $r[$name] = $null }
        elseif ($val -is [DateTime]) { $r[$name] = $val.ToString('o') }
        elseif ($val -is [byte[]]) { $r[$name] = [Convert]::ToBase64String($val) }
        else { $r[$name] = $val }
      }
      $out.Add($r) | Out-Null
    }
    $rdr.Close()
    $conn.Close()
    return ,$out
  }

  $count = $rows.Count
  $sw = New-Object System.IO.StreamWriter($outFile, $false, [System.Text.UTF8Encoding]::new($false))
  foreach ($r in $rows) {
    $sw.WriteLine(($r | ConvertTo-Json -Compress -Depth 6))
  }
  $sw.Close()
  Write-Host "    $count rows"
}

Write-Host "`nAll exports complete."
