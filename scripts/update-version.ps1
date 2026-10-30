$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$timeZone = $null
foreach ($timeZoneId in @("Asia/Shanghai", "China Standard Time")) {
  try {
    $timeZone = [TimeZoneInfo]::FindSystemTimeZoneById($timeZoneId)
    break
  }
  catch {
    continue
  }
}
if ($null -eq $timeZone) {
  throw "Could not resolve the Asia/Shanghai time zone."
}

$timestamp = [TimeZoneInfo]::ConvertTime([DateTimeOffset]::UtcNow, $timeZone).ToString(
  "yyyyMMdd.HHmmssfff",
  [Globalization.CultureInfo]::InvariantCulture
)
$version = "$timestamp.0"
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

function Update-TextFile {
  param(
    [string]$Path,
    [string]$Pattern,
    [string]$Replacement,
    [string]$Label
  )

  $content = [IO.File]::ReadAllText($Path)
  $regex = [regex]::new($Pattern)
  if (-not $regex.IsMatch($content)) {
    throw "$Label was not found in $Path"
  }
  $updated = $regex.Replace($content, $Replacement, 1)
  if ($updated -ne $content) {
    [IO.File]::WriteAllText($Path, $updated, $utf8NoBom)
  }
}

$packagePath = Join-Path $repoRoot "package.json"
Update-TextFile `
  -Path $packagePath `
  -Pattern '("version"\s*:\s*")[^"]*(")' `
  -Replacement ('${1}' + $version + '${2}') `
  -Label "package version"

foreach ($scriptName in @("Runestone.js", "Runestone.ClashVerge.js")) {
  $scriptPath = Join-Path $repoRoot "JS/$scriptName"
  Update-TextFile `
    -Path $scriptPath `
    -Pattern '\A// Version: [^\r\n]+' `
    -Replacement "// Version: $version" `
    -Label "version header"
}

$readmePath = Join-Path $repoRoot "README.md"
Update-TextFile `
  -Path $readmePath `
  -Pattern '(https://raw\.githubusercontent\.com/lxy-l/runestone-hako/v)[^/\s]+(/JS/Runestone\.js)' `
  -Replacement ('${1}' + $version + '${2}') `
  -Label "pinned Runestone.js URL"

Write-Output "Updated version to $version"
