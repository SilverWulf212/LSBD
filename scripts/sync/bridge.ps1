<#
.SYNOPSIS
  Read-only PowerShell Direct bridge to the LSBDSQL VM (spec 4.1, plan Task 6).

.DESCRIPTION
  -Mode serve opens ONE PowerShell Direct session to $env:MSSQL_VM_NAME and then serves
  one request per stdin line:

    {"id":n,"sql":"SELECT ..."}   ->  {"id":n,"row":{...}} per row, then {"id":n,"done":true,"count":k}
                                      or {"id":n,"error":"..."} (and keeps serving)
    {"id":n,"quit":true} or EOF   ->  removes the session and exits 0

  Every query runs inside the VM through System.Data.SqlClient as
    SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED; BEGIN TRAN; <sql>; ROLLBACK;
  so nothing can ever commit. SQL whose code (outside string literals and quoted
  identifiers) contains a write/DDL keyword is refused before it reaches the VM.

  Rows are serialised to JSON inside the VM by a small C# helper and returned to the host
  as string[] pages of 5,000 rows (reader state lives in the persistent session), so
  remoting moves strings, not hashtables. All protocol output is ASCII (non-ASCII is
  \u-escaped), so console code pages cannot corrupt data.

  Windows PowerShell 5.1 compatible. Secrets are read from the secrets file and never printed.
#>
param(
  [Parameter(Mandatory = $true)][ValidateSet('serve')][string]$Mode,
  [string]$Database
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$PageSize = 5000
$CommandTimeout = 900

$utf8 = New-Object System.Text.UTF8Encoding($false)
try { [Console]::OutputEncoding = $utf8 } catch { }
try { [Console]::InputEncoding = $utf8 } catch { }
$OutputEncoding = $utf8

# --------------------------------------------------------------------------------------
# C# helper, compiled on the host (JSON escaping + SELECT-only guard) and in the VM
# (paged reader). One source so the encoding rules live in one place.
# --------------------------------------------------------------------------------------
$HelperSource = @'
using System;
using System.Collections.Generic;
using System.Data;
using System.Data.SqlClient;
using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;

namespace LsbdBridge
{
    public static class Json
    {
        // JSON string literal; everything outside printable ASCII is \u-escaped, so the
        // output is pure ASCII and lone surrogates survive unchanged.
        public static void Str(StringBuilder sb, string s)
        {
            sb.Append('"');
            foreach (char c in s)
            {
                if (c == '"') sb.Append("\\\"");
                else if (c == '\\') sb.Append("\\\\");
                else if (c < 0x20 || c > 0x7e)
                {
                    sb.Append("\\u");
                    sb.Append(((int)c).ToString("x4", CultureInfo.InvariantCulture));
                }
                else sb.Append(c);
            }
            sb.Append('"');
        }

        public static string Quote(string s)
        {
            var sb = new StringBuilder(s.Length + 2);
            Str(sb, s ?? "");
            return sb.ToString();
        }

        // Value encoding (plan Task 6 table).
        public static void Value(StringBuilder sb, object v)
        {
            if (v == null || v is DBNull) { sb.Append("null"); return; }
            if (v is string) { Str(sb, (string)v); return; }
            if (v is DateTime) { Str(sb, ((DateTime)v).ToString("yyyy-MM-dd'T'HH:mm:ss.fff", CultureInfo.InvariantCulture)); return; }
            if (v is Guid) { Str(sb, ((Guid)v).ToString()); return; }
            if (v is decimal) { Str(sb, ((decimal)v).ToString(CultureInfo.InvariantCulture)); return; }
            if (v is byte[]) { Str(sb, Convert.ToBase64String((byte[])v)); return; }
            if (v is bool) { sb.Append((bool)v ? "true" : "false"); return; }
            if (v is int || v is short || v is byte || v is long || v is sbyte || v is ushort || v is uint || v is ulong)
            {
                sb.Append(Convert.ToString(v, CultureInfo.InvariantCulture)); return;
            }
            if (v is double) { sb.Append(((double)v).ToString("R", CultureInfo.InvariantCulture)); return; }
            if (v is float) { sb.Append(((float)v).ToString("R", CultureInfo.InvariantCulture)); return; }
            if (v is DateTimeOffset) { Str(sb, ((DateTimeOffset)v).ToString("yyyy-MM-dd'T'HH:mm:ss.fffzzz", CultureInfo.InvariantCulture)); return; }
            if (v is TimeSpan) { Str(sb, ((TimeSpan)v).ToString("c", CultureInfo.InvariantCulture)); return; }
            Str(sb, Convert.ToString(v, CultureInfo.InvariantCulture));
        }
    }

    public static class Guard
    {
        // Brief regex, plus keywords that could end/escape the ROLLBACK wrapper
        // (commit, into, execute) or are non-transactional (backup, restore, dbcc, kill, ...).
        static readonly Regex Refuse = new Regex(
            @"\b(insert|update|delete|merge|drop|alter|create|truncate|exec|grant" +
            @"|execute|commit|into|revoke|deny|dbcc|backup|restore|reconfigure|shutdown|kill" +
            @"|updatetext|writetext|enable|disable)\b",
            RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);

        // Blanks out string literals and quoted identifiers ('..', [..], "..") and keeps the
        // text of comments (-- and nested /* */) so a quote inside a comment cannot hide code.
        public static string CodeOnly(string sql)
        {
            var sb = new StringBuilder(sql.Length);
            int i = 0, n = sql.Length;
            while (i < n)
            {
                char c = sql[i];
                if (c == '\'' || c == '[' || c == '"')
                {
                    char close = c == '[' ? ']' : c;
                    i++;
                    while (i < n)
                    {
                        if (sql[i] == close)
                        {
                            if (i + 1 < n && sql[i + 1] == close) { i += 2; continue; }
                            i++;
                            break;
                        }
                        i++;
                    }
                    sb.Append(' ');
                    continue;
                }
                if (c == '-' && i + 1 < n && sql[i + 1] == '-')
                {
                    int s = i;
                    while (i < n && sql[i] != '\n') i++;
                    sb.Append(' ').Append(sql, s + 2, i - s - 2).Append(' ');
                    continue;
                }
                if (c == '/' && i + 1 < n && sql[i + 1] == '*')
                {
                    int s = i, depth = 1;
                    i += 2;
                    while (i < n && depth > 0)
                    {
                        if (sql[i] == '/' && i + 1 < n && sql[i + 1] == '*') { depth++; i += 2; }
                        else if (sql[i] == '*' && i + 1 < n && sql[i + 1] == '/') { depth--; i += 2; }
                        else i++;
                    }
                    sb.Append(' ').Append(sql, s + 2, i - s - 2).Append(' ');
                    continue;
                }
                sb.Append(c);
                i++;
            }
            return sb.ToString();
        }

        public static bool IsRefused(string sql)
        {
            if (sql == null) return true;
            return Refuse.IsMatch(CodeOnly(sql));
        }
    }

    public sealed class Pager : IDisposable
    {
        SqlConnection conn;
        SqlCommand cmd;
        SqlDataReader rdr;
        string[] prefixes;
        public bool Done;
        public int Count;

        public Pager(string database, string sql, int timeout)
        {
            var csb = new SqlConnectionStringBuilder();
            csb.DataSource = ".";
            csb.InitialCatalog = database;
            csb.IntegratedSecurity = true;
            csb.ApplicationIntent = ApplicationIntent.ReadOnly;
            csb.Pooling = false; // closing really disconnects: nothing lingers in a pool
            csb.ApplicationName = "lsbd-sync-bridge";
            try
            {
                conn = new SqlConnection(csb.ConnectionString);
                conn.Open();
                cmd = conn.CreateCommand();
                cmd.CommandTimeout = timeout;
                // Newlines so a trailing -- comment in <sql> cannot swallow the ROLLBACK.
                cmd.CommandText =
                    "SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;\nBEGIN TRAN;\n" +
                    sql + "\n;\nROLLBACK;";
                rdr = cmd.ExecuteReader();
                while (rdr.FieldCount == 0 && rdr.NextResult()) { }
                prefixes = new string[rdr.FieldCount];
                for (int i = 0; i < prefixes.Length; i++)
                {
                    prefixes[i] = (i == 0 ? "{" : ",") + Json.Quote(rdr.GetName(i)) + ":";
                }
                if (rdr.FieldCount == 0) Finish();
            }
            catch
            {
                Abort();
                throw;
            }
        }

        public string[] Next(int max)
        {
            var list = new List<string>(Math.Min(max, 5000));
            if (Done) return list.ToArray();
            try
            {
                var sb = new StringBuilder(512);
                int fc = prefixes.Length;
                while (list.Count < max)
                {
                    if (!rdr.Read()) { Finish(); break; }
                    sb.Length = 0;
                    for (int i = 0; i < fc; i++)
                    {
                        sb.Append(prefixes[i]);
                        Json.Value(sb, rdr.IsDBNull(i) ? null : rdr.GetValue(i));
                    }
                    sb.Append('}');
                    list.Add(sb.ToString());
                }
            }
            catch
            {
                Abort();
                throw;
            }
            Count += list.Count;
            return list.ToArray();
        }

        // Normal end: closing the reader runs the rest of the batch (the ROLLBACK).
        void Finish()
        {
            Done = true;
            Dispose();
        }

        // Error / abandon: cancel instead of draining the remaining rows.
        public void Abort()
        {
            Done = true;
            if (cmd != null) { try { cmd.Cancel(); } catch { } }
            Dispose();
        }

        public void Dispose()
        {
            if (rdr != null) { try { rdr.Close(); } catch { } rdr = null; }
            if (conn != null)
            {
                try
                {
                    if (conn.State == ConnectionState.Open)
                    {
                        using (var c = conn.CreateCommand())
                        {
                            c.CommandText = "IF @@TRANCOUNT > 0 ROLLBACK;";
                            c.ExecuteNonQuery();
                        }
                    }
                }
                catch { }
                try { conn.Dispose(); } catch { }
                conn = null;
            }
            if (cmd != null) { try { cmd.Dispose(); } catch { } cmd = null; }
        }
    }
}
'@

# --------------------------------------------------------------------------------------
# VM-side script blocks. State lives in $global: variables of the persistent session.
# --------------------------------------------------------------------------------------
$VmStart = {
  param($src, $db, $sql, $pageSize, $timeout)
  $ErrorActionPreference = 'Stop'
  if (-not ('LsbdBridge.Pager' -as [type])) {
    Add-Type -TypeDefinition $src -ReferencedAssemblies System.Data, System.Xml | Out-Null
  }
  if ($global:LsbdPager) {
    try { $global:LsbdPager.Abort() } catch { }
    $global:LsbdPager = $null
  }
  $global:LsbdPager = New-Object LsbdBridge.Pager($db, $sql, $timeout)
  $rows = $global:LsbdPager.Next($pageSize)
  $done = $global:LsbdPager.Done
  if ($done) { $global:LsbdPager = $null }
  [pscustomobject]@{ Done = $done; Rows = $rows }
}

$VmNext = {
  param($pageSize)
  $ErrorActionPreference = 'Stop'
  if (-not $global:LsbdPager) { throw 'bridge: no open reader in session' }
  try {
    $rows = $global:LsbdPager.Next($pageSize)
  } catch {
    $global:LsbdPager = $null
    throw
  }
  $done = $global:LsbdPager.Done
  if ($done) { $global:LsbdPager = $null }
  [pscustomobject]@{ Done = $done; Rows = $rows }
}

$VmAbort = {
  if ($global:LsbdPager) {
    try { $global:LsbdPager.Abort() } catch { }
    $global:LsbdPager = $null
  }
}

# --------------------------------------------------------------------------------------
# Host side.
# --------------------------------------------------------------------------------------
function Read-Secrets {
  $paths = @('C:\ProgramData\lsbd-sync\secrets.env', 'C:\Users\Administrator\.lsbd-secrets.env')
  $path = $null
  foreach ($p in $paths) { if (Test-Path -LiteralPath $p) { $path = $p; break } }
  if (-not $path) { throw 'bridge: no secrets file found' }
  $out = @{}
  foreach ($raw in [System.IO.File]::ReadAllLines($path)) {
    $line = $raw.Trim()
    if ($line.Length -eq 0 -or $line.StartsWith('#')) { continue }
    $eq = $line.IndexOf('=')
    if ($eq -le 0) { continue }
    $key = $line.Substring(0, $eq).Trim()
    $val = $line.Substring($eq + 1).Trim()
    if ($val.Length -ge 2 -and (($val.StartsWith('"') -and $val.EndsWith('"')) -or ($val.StartsWith("'") -and $val.EndsWith("'")))) {
      $val = $val.Substring(1, $val.Length - 2)
    }
    $out[$key] = $val
  }
  return $out
}

$stdout = New-Object System.IO.StreamWriter([Console]::OpenStandardOutput(), $utf8)
$stdout.AutoFlush = $false
$stdout.NewLine = "`n"
$stdin = New-Object System.IO.StreamReader([Console]::OpenStandardInput(), $utf8)

function Send-Line([string]$line) {
  $stdout.Write($line)
  $stdout.Write("`n")
  $stdout.Flush()
}

function Send-Error($id, [string]$message) {
  Send-Line ('{"id":' + $id + ',"error":' + [LsbdBridge.Json]::Quote($message) + '}')
}

function Open-VmSession {
  $cred = New-Object System.Management.Automation.PSCredential(
    $script:Secrets['MSSQL_USER'],
    (ConvertTo-SecureString $script:Secrets['MSSQL_PASSWORD'] -AsPlainText -Force))
  return New-PSSession -VMName $script:Secrets['MSSQL_VM_NAME'] -Credential $cred
}

function Invoke-Request($id, [string]$sql) {
  if ([LsbdBridge.Guard]::IsRefused($sql)) {
    Send-Error $id 'bridge: non-SELECT refused'
    return
  }
  if ($script:Session.State -ne 'Opened') {
    try { Remove-PSSession $script:Session -ErrorAction SilentlyContinue } catch { }
    $script:Session = Open-VmSession
  }
  $prefix = '{"id":' + $id + ',"row":'
  $sep = "}`n" + $prefix
  $count = 0
  try {
    $page = Invoke-Command -Session $script:Session -ScriptBlock $VmStart `
      -ArgumentList $HelperSource, $script:Db, $sql, $PageSize, $CommandTimeout
    while ($true) {
      $rows = [string[]]@()
      if ($null -ne $page.Rows) { $rows = [string[]]@($page.Rows) }
      if ($rows.Length -gt 0) {
        $stdout.Write($prefix)
        $stdout.Write([string]::Join($sep, $rows))
        $stdout.Write("}`n")
        $stdout.Flush()
        $count += $rows.Length
      }
      if ($page.Done) { break }
      $page = Invoke-Command -Session $script:Session -ScriptBlock $VmNext -ArgumentList $PageSize
    }
  } catch {
    try { Invoke-Command -Session $script:Session -ScriptBlock $VmAbort -ErrorAction SilentlyContinue | Out-Null } catch { }
    $msg = $_.Exception.Message
    if (-not $msg) { $msg = [string]$_ }
    Send-Error $id $msg
    return
  }
  Send-Line ('{"id":' + $id + ',"done":true,"count":' + $count + '}')
}

# --- main -------------------------------------------------------------------------------
Add-Type -TypeDefinition $HelperSource -ReferencedAssemblies System.Data, System.Xml | Out-Null

$script:Secrets = Read-Secrets
foreach ($k in @('MSSQL_VM_NAME', 'MSSQL_USER', 'MSSQL_PASSWORD')) {
  if (-not $script:Secrets[$k]) { [Console]::Error.WriteLine("bridge: $k missing from secrets file"); exit 2 }
}
$script:Db = $Database
if (-not $script:Db) { $script:Db = $script:Secrets['MSSQL_DATABASE'] }
if (-not $script:Db) { $script:Db = 'LSBDDB' }

try {
  $script:Session = Open-VmSession
} catch {
  [Console]::Error.WriteLine('bridge: cannot open PowerShell Direct session: ' + $_.Exception.Message)
  exit 3
}

$exitCode = 0
try {
  while ($true) {
    $line = $stdin.ReadLine()
    if ($null -eq $line) { break }
    if ($line.Trim().Length -eq 0) { continue }
    $id = 'null'
    try {
      $req = ConvertFrom-Json -InputObject $line
    } catch {
      Send-Error 'null' 'bridge: bad request JSON'
      continue
    }
    if ($null -ne $req.id) { $id = [string][long]$req.id }
    if ($req.quit) { break }
    if (-not ($req.sql -is [string]) -or $req.sql.Trim().Length -eq 0) {
      Send-Error $id 'bridge: request has no sql'
      continue
    }
    Invoke-Request $id $req.sql
  }
} catch {
  [Console]::Error.WriteLine('bridge: fatal: ' + $_.Exception.Message)
  $exitCode = 1
} finally {
  if ($script:Session) {
    try { Remove-PSSession $script:Session -ErrorAction SilentlyContinue } catch { }
  }
  try { $stdout.Flush() } catch { }
}
exit $exitCode
