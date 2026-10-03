param([string]$DotnetPath, [string]$MySqlConnectionString = $env:REPAIRLEDGER_SMOKE_MYSQL)
$ErrorActionPreference = 'Stop'
if ($MySqlConnectionString) {
    $smokeConnectionOptions = [System.Data.Common.DbConnectionStringBuilder]::new()
    # IDictionary adaptation treats property assignment as a dictionary key; call the CLR setter explicitly.
    $smokeConnectionOptions.set_ConnectionString($MySqlConnectionString)
    $smokeDatabaseName = $null
    $hasDatabase = $smokeConnectionOptions.TryGetValue('Database', [ref]$smokeDatabaseName)
    $hasDatabaseAlias = @($smokeConnectionOptions.get_Keys() | Where-Object { ($_ -replace ' ', '') -ieq 'InitialCatalog' }).Count -gt 0
    if (!$hasDatabase -or $hasDatabaseAlias -or $smokeDatabaseName -notmatch '^rl_smoke_[a-f0-9]{32}$') {
        throw 'MySQL HTTP smoke requires your own empty disposable rl_smoke_<32-hex> database, never a real database.'
    }
}
$projectRoot = Split-Path $PSScriptRoot -Parent
if (!$DotnetPath) {
    $localSdk = Join-Path $projectRoot '.tools\dotnet\dotnet.exe'
    $DotnetPath = if (Test-Path -LiteralPath $localSdk) { $localSdk } else { (Get-Command dotnet -ErrorAction Stop).Source }
}
$assembly = Join-Path $projectRoot 'apps\api\bin\Release\net10.0\RepairLedger.Api.dll'
if (!(Test-Path -LiteralPath $assembly)) { throw 'Build the Release API before running this script.' }
$tempDir = Join-Path ([IO.Path]::GetTempPath()) ('repairledger-http-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $tempDir | Out-Null
$dbPath = Join-Path $tempDir 'test.db'
$outLog = Join-Path $tempDir 'out.log'
$errorLog = Join-Path $tempDir 'error.log'
$listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, 0)
$listener.Start()
$port = $listener.LocalEndpoint.Port
$listener.Stop()
$base = "http://127.0.0.1:$port"
$previousEnvironment = $env:ASPNETCORE_ENVIRONMENT
$previousConnection = $env:Database__ConnectionString
$provider = if ($MySqlConnectionString) { 'MySql' } else { 'Sqlite' }
$process = $null
$passed = $false
$script:checks = 0
function Assert-True($condition, [string]$description) {
    if (!$condition) { throw "Failed: $description" }
    $script:checks++
}
function Invoke-Api([string]$method, [string]$path, $body = $null, $headers = @{}) {
    $options = @{ Uri = $base + $path; Method = $method; Headers = $headers; TimeoutSec = 15; SkipHttpErrorCheck = $true }
    if ($null -ne $body) { $options.Body = $body | ConvertTo-Json -Depth 20; $options.ContentType = 'application/json' }
    $response = Invoke-WebRequest @options
    $json = if ($response.Content) { $response.Content | ConvertFrom-Json } else { $null }
    return @{ Status = [int]$response.StatusCode; Json = $json; Headers = $response.Headers }
}
try {
    $env:ASPNETCORE_ENVIRONMENT = 'Development'
    # Pass credentials in the child environment, not visible command-line arguments.
    $env:Database__ConnectionString = if ($MySqlConnectionString) { $MySqlConnectionString } else { "Data Source=$dbPath;Foreign Keys=True" }
    $process = Start-Process -FilePath $DotnetPath -ArgumentList @(
        ('"' + $assembly + '"'), '--urls', $base,
        '--Database:Provider', $provider,
        '--Database:AutoMigrate', 'true', '--Demo:Enabled', 'true',
        '--Supabase:Url=', '--Supabase:PublicKey=', '--Supabase:ServiceRoleKey='
    ) -WorkingDirectory (Join-Path $projectRoot 'apps\api') -WindowStyle Hidden -PassThru -RedirectStandardOutput $outLog -RedirectStandardError $errorLog
    $ready = $false
    $startupDeadline = [DateTime]::UtcNow.AddSeconds($(if ($MySqlConnectionString) { 180 } else { 30 }))
    while ([DateTime]::UtcNow -lt $startupDeadline) {
        if ($process.HasExited) { throw "API exited. Diagnostic logs: $tempDir" }
        try { $ready = (Invoke-Api 'GET' '/api/health/ready').Status -eq 200 } catch { }
        if ($ready) { break }
        Start-Sleep -Milliseconds 200
    }
    Assert-True $ready 'readiness'
    $response = Invoke-Api 'GET' '/api/properties'
    Assert-True ($response.Status -eq 200 -and $response.Json.data.Count -eq 3) 'properties envelope and demo seed'
    $initialDashboard = (Invoke-Api 'GET' '/api/dashboard').Json.data
    $invalid = Invoke-Api 'POST' '/api/requests' @{ title = ''; propertyId = 'oak-street'; unit = '1'; resident = 'Resident'; category = 'Plumbing'; description = 'Broken tap' }
    Assert-True ($invalid.Status -eq 400 -and $invalid.Json.message -and $invalid.Json.errors) 'MVC validation envelope'
    $repair = (Invoke-Api 'POST' '/api/requests' @{ title = 'HTTP smoke repair'; propertyId = 'oak-street'; unit = 'Smoke'; resident = 'Test resident'; category = 'Plumbing'; description = 'Synthetic smoke test'; priority = 'routine' }).Json.data
    Assert-True ([bool]$repair.id -and [bool]$repair.unitId) 'create and normalized unit'
    $createdDashboard = (Invoke-Api 'GET' '/api/dashboard').Json.data
    Assert-True ($createdDashboard.awaitingYou -eq ($initialDashboard.awaitingYou + 1) -and $createdDashboard.openRequests -eq ($initialDashboard.openRequests + 1)) 'new report enters decision and open queues'
    $id = $repair.id
    $get = Invoke-Api 'GET' "/api/requests/$id"
    Assert-True ($get.Headers.ETag -and $get.Json.data.id -eq $id) 'detail and ETag'
    $revision = $get.Json.data.revision
    $updated = Invoke-Api 'POST' "/api/requests/$id/transition" @{ state = 'acknowledged'; note = 'Review' } @{ 'If-Match' = ('"' + $revision + '"') }
    Assert-True ($updated.Status -eq 200) 'transition'
    $stale = Invoke-Api 'POST' "/api/requests/$id/transition" @{ state = 'waiting'; note = 'Stale' } @{ 'If-Match' = ('"' + $revision + '"') }
    Assert-True ($stale.Status -eq 409) 'stale update'
    Assert-True ((Invoke-Api 'POST' "/api/requests/$id/offer" @{ vendorId = 'elite-plumbing'; note = 'Smoke offer' }).Status -eq 200) 'offer'
    Assert-True ((Invoke-Api 'GET' '/api/dashboard').Json.data.awaitingYou -eq $initialDashboard.awaitingYou) 'pending vendor offer leaves manager decision queue'
    Assert-True ((Invoke-Api 'POST' "/api/requests/$id/vendor-response" @{ vendorId = 'elite-plumbing'; decision = 'accepted' }).Status -eq 200) 'accept'
    $quote = (Invoke-Api 'POST' "/api/requests/$id/estimates" @{ scope = 'Replace and test tap'; labor = 100; parts = 20; tax = 12; currency = 'INR' }).Json.data
    Assert-True ($quote.total -eq 132 -and $quote.currency -eq 'INR' -and $quote.vendorId -eq 'elite-plumbing') 'quote currency attribution'
    $quoteDashboard = (Invoke-Api 'GET' '/api/dashboard').Json.data
    Assert-True ($quoteDashboard.pendingQuotes -eq ($initialDashboard.pendingQuotes + 1) -and $quoteDashboard.awaitingYou -eq ($initialDashboard.awaitingYou + 1)) 'submitted quote enters review queue'
    Assert-True ((Invoke-Api 'POST' "/api/requests/$id/estimates/$($quote.id)/approve").Status -eq 200) 'approval'
    $localStart = [TimeZoneInfo]::ConvertTime([DateTimeOffset]::UtcNow.AddDays(2), [TimeZoneInfo]::FindSystemTimeZoneById('America/New_York')).ToString("yyyy-MM-dd'T'HH:mm")
    $visitResponse = Invoke-Api 'POST' "/api/requests/$id/appointments" @{ localStart = $localStart; durationMinutes = 60; timezone = 'America/New_York' }
    Assert-True ($visitResponse.Status -eq 200) 'visit proposal'
    Assert-True ((Invoke-Api 'GET' '/api/dashboard').Json.data.awaitingYou -eq $initialDashboard.awaitingYou) 'proposed visit awaits resident and vendor, not another manager decision'
    $visit = $visitResponse.Json.data.appointment.id
    Assert-True ((Invoke-Api 'POST' "/api/requests/$id/appointments/$visit/confirm" @{ confirmed = $true; party = 'resident' }).Status -eq 200) 'resident confirmation'
    Assert-True ((Invoke-Api 'POST' "/api/requests/$id/appointments/$visit/confirm" @{ confirmed = $true; party = 'vendor' }).Status -eq 200) 'vendor confirmation'
    Assert-True ((Invoke-Api 'POST' "/api/requests/$id/start-work").Status -eq 200) 'start'
    Assert-True ((Invoke-Api 'POST' "/api/requests/$id/complete-work").Status -eq 200) 'completion'
    Assert-True ((Invoke-Api 'GET' '/api/dashboard').Json.data.awaitingVerification -eq ($initialDashboard.awaitingVerification + 1)) 'vendor completion requires resident verification'
    $closed = Invoke-Api 'POST' "/api/requests/$id/verify" @{ fixed = $true; note = 'Verified' }
    Assert-True ($closed.Status -eq 200 -and $closed.Json.data.state -eq 'closed' -and $closed.Json.data.verificationHistory.Count -eq 2) 'closure and verification history'
    $closedDashboard = (Invoke-Api 'GET' '/api/dashboard').Json.data
    Assert-True ($closedDashboard.openRequests -eq $initialDashboard.openRequests -and $closedDashboard.awaitingVerification -eq $initialDashboard.awaitingVerification) 'resident verification closes the loop without stale open counts'
    Assert-True ((Invoke-Api 'POST' "/api/requests/$id/messages" @{ body = 'Thanks' }).Status -eq 200) 'message send'
    Assert-True ((Invoke-Api 'GET' "/api/requests/$id/messages").Json.data.Count -eq 1) 'message read'
    $n = (Invoke-Api 'GET' '/api/notifications').Json.data[0]
    Assert-True ((Invoke-Api 'POST' "/api/notifications/$($n.id)/read").Json.data.read -eq $true) 'notification read'
    Assert-True ((Invoke-Api 'GET' '/api/dashboard').Status -eq 200) 'dashboard'
    Assert-True ((Invoke-Api 'GET' '/api/properties/oak-street/units').Json.data.Count -eq 2) 'unit list'
    Assert-True ((Invoke-Api 'POST' '/api/properties/oak-street/units' @{ label = '4C' }).Status -eq 200) 'unit creation'
    Assert-True ((Invoke-Api 'POST' '/api/vendors/invite' @{ name = 'Smoke vendor'; email = 'vendor@example.com'; trade = 'Plumbing' }).Status -eq 200) 'vendor contact'
    $storage = Invoke-Api 'POST' '/api/evidence/upload-url' @{ requestId = $id; name = 'test.png'; contentType = 'image/png'; size = 100 }
    Assert-True ($storage.Status -eq 503 -and $storage.Json.message) 'unconfigured evidence fails honestly'
    $spec = Invoke-Api 'GET' '/openapi/v1.json'
    Assert-True ($spec.Status -eq 200 -and $spec.Json.paths.'/api/requests' -and $spec.Json.paths.'/api/properties/{id}/units') 'OpenAPI controllers and units'
    $passed = $true
    Write-Output "HTTP smoke passed: $script:checks checks. No real user database was used."
}
finally {
    $env:ASPNETCORE_ENVIRONMENT = $previousEnvironment
    $env:Database__ConnectionString = $previousConnection
    if ($process -and !$process.HasExited) {
        Stop-Process -Id $process.Id -Force
        $process.WaitForExit(5000) | Out-Null
    }
    if ($passed) {
        $resolvedDir = [IO.Path]::GetFullPath($tempDir)
        if (!$resolvedDir.StartsWith([IO.Path]::GetFullPath([IO.Path]::GetTempPath()), [StringComparison]::OrdinalIgnoreCase) -or !(Split-Path $resolvedDir -Leaf).StartsWith('repairledger-http-')) { throw 'Unsafe cleanup target.' }
        foreach ($file in Get-ChildItem -LiteralPath $resolvedDir -File) { Remove-Item -LiteralPath $file.FullName -Force }
        Remove-Item -LiteralPath $resolvedDir
    }
    else { Write-Output "Smoke diagnostics retained at $tempDir" }
}

