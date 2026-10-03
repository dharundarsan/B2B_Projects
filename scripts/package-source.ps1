#Requires -Version 7.2
param([Parameter(Mandatory = $true)][string]$OutputPath)
$ErrorActionPreference = 'Stop'
$sourceRoot = (Resolve-Path -LiteralPath (Split-Path $PSScriptRoot -Parent)).Path
$archivePath = [IO.Path]::GetFullPath($OutputPath)
if ([IO.Path]::GetExtension($archivePath) -ne '.zip') { throw 'OutputPath must be a ZIP file.' }
if (Test-Path -LiteralPath $archivePath) { throw 'Archive already exists; choose a new output name.' }
$excludedDirectories = @('node_modules', 'dist', 'bin', 'obj', '.expo', '.git', '.tools', '.vercel', '.vs', 'coverage', 'TestResults', 'migration-export')

function Get-PublicSourceFiles([string]$directory) {
    foreach ($item in Get-ChildItem -LiteralPath $directory -Force) {
        if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { continue }
        $relative = [IO.Path]::GetRelativePath($sourceRoot, $item.FullName).Replace('\', '/')
        if ($item.PSIsContainer) {
            if ($item.Name -in $excludedDirectories -or $item.Name -like 'migration-export*' -or $relative -in @('apps/mobile/android', 'apps/mobile/ios')) { continue }
            Get-PublicSourceFiles $item.FullName
        } else {
            if ($item.Name -like '.env*' -and $item.Name -ne '.env.example') { continue }
            if ($item.Name -match '^appsettings.*\.json$' -and $item.Name -notin @('appsettings.json', 'appsettings.Development.json', 'appsettings.Local.example.json', 'appsettings.MySqlDevelopment.example.json')) { continue }
            if ($item.Name -match '(?i)(\.db(?:-.+)?|\.sqlite(?:3)?(?:-.+)?|\.log|\.tsbuildinfo|\.pem|\.pfx|\.p12|\.key|\.zip)$' -or $item.Name -in @('secrets.json', '.npmrc', '.netrc', '.DS_Store')) { continue }
            if ($item.Name -like 'migration-export*' -or $relative -in @('apps/web/vite.config.js', 'apps/web/vite.config.d.ts')) { continue }
            $item.FullName
        }
    }
}

$rootFiles = @('README.md', 'FINAL-HANDOFF.md', 'NPM-SETUP.md', 'package.json', 'package-lock.json', 'global.json', 'NuGet.Config', 'vercel.json', '.gitignore', '.gitattributes', '.dockerignore', '.env.example', '.nvmrc')
$files = @($rootFiles | ForEach-Object { (Get-Item -LiteralPath (Join-Path $sourceRoot $_)).FullName })
foreach ($folder in @('apps/web', 'apps/mobile', 'apps/api', 'scripts', 'tests', 'docs')) { $files += @(Get-PublicSourceFiles (Join-Path $sourceRoot $folder)) }
$files = @($files | Sort-Object -Unique)
$required = @('apps/web/src/App.tsx', 'apps/mobile/src/app/_layout.tsx', 'apps/mobile/package-lock.json', 'apps/mobile/vendor/decode-uri-component/index.cjs', 'apps/api/Program.cs', 'apps/api/DatabaseScripts/MySql/004_mobile_operations.sql', 'apps/api/DatabaseScripts/MySql/005_resident_privacy.sql', 'docs/RESIDENT-PRIVACY.md')
foreach ($relative in $required) { if ((Join-Path $sourceRoot $relative) -notin $files) { throw "Missing required source: $relative" } }

[IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($archivePath)) | Out-Null
$zip = [IO.Compression.ZipFile]::Open($archivePath, [IO.Compression.ZipArchiveMode]::Create)
try {
    foreach ($file in $files) {
        $entryName = 'RepairLedger-app-source/' + [IO.Path]::GetRelativePath($sourceRoot, $file).Replace('\', '/')
        [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $file, $entryName, [IO.Compression.CompressionLevel]::Optimal) | Out-Null
    }
} finally { $zip.Dispose() }

$zip = [IO.Compression.ZipFile]::OpenRead($archivePath)
try {
    if ($zip.Entries.Count -ne $files.Count) { throw 'Archive file count mismatch.' }
    foreach ($file in $files) {
        $entryName = 'RepairLedger-app-source/' + [IO.Path]::GetRelativePath($sourceRoot, $file).Replace('\', '/')
        $entry = $zip.GetEntry($entryName)
        if (!$entry -or $entry.Length -ne (Get-Item -LiteralPath $file).Length) { throw "Incomplete archive entry: $entryName" }
        $stream = $entry.Open()
        try { $archivedHash = [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($stream)) } finally { $stream.Dispose() }
        if ($archivedHash -ne (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash) { throw "Archive content mismatch: $entryName" }
    }
} finally { $zip.Dispose() }

[pscustomobject]@{ Path = $archivePath; SourceFiles = $files.Count; Bytes = (Get-Item -LiteralPath $archivePath).Length; SHA256 = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash } | ConvertTo-Json
