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
    Assert-True (!$get.Json.data.residentLinked -and !$get.Json.data.PSObject.Properties['residentUserId'] -and !$get.Json.data.PSObject.Properties['residentOccupancyId']) 'legacy-style intake is unlinked and binding identifiers stay private'
    $residentBinding = @{ residentUserId = [Guid]::NewGuid().ToString('D'); residentOccupancyId = [Guid]::NewGuid().ToString('D') }
    Assert-True ((Invoke-Api 'POST' "/api/requests/$id/resident-link" $residentBinding).Status -eq 400) 'resident link requires explicit revision'
    Assert-True ((Invoke-Api 'POST' "/api/requests/$id/resident-link" @{ residentUserId = 'not-an-account'; residentOccupancyId = $residentBinding.residentOccupancyId } @{ 'If-Match' = ('"' + $get.Json.data.revision + '"') }).Status -eq 400) 'resident link rejects invalid identity'
    $linked = Invoke-Api 'POST' "/api/requests/$id/resident-link" $residentBinding @{ 'If-Match' = ('"' + $get.Json.data.revision + '"') }
    Assert-True ($linked.Status -eq 200 -and $linked.Json.data.residentLinked -and $linked.Json.data.revision -eq ($get.Json.data.revision + 1) -and @($linked.Json.data.events | Where-Object type -eq 'resident-link').Count -eq 1) 'resident link is revision-checked and audited'
    Assert-True ((Invoke-Api 'POST' "/api/requests/$id/resident-link" $residentBinding @{ 'If-Match' = ('"' + $get.Json.data.revision + '"') }).Status -eq 409) 'resident link rejects stale revision'
    Assert-True ((Invoke-Api 'POST' "/api/requests/$id/resident-link" $residentBinding @{ 'If-Match' = ('"' + $linked.Json.data.revision + '"') }).Status -eq 409) 'resident link cannot be overwritten or transferred'
    $get = Invoke-Api 'GET' "/api/requests/$id"
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
    Assert-True ($spec.Status -eq 200 -and $spec.Json.paths.'/api/requests' -and $spec.Json.paths.'/api/properties/{id}/units' -and $spec.Json.paths.'/api/requests/{id}/resident-link') 'OpenAPI controllers, units and resident linking'
    $community='/api/community/oak-street'
    Assert-True ((Invoke-Api 'GET' '/api/community/context').Json.data.role -eq 'demo') 'community context'
    $unit=(Invoke-Api 'GET' '/api/properties/oak-street/units').Json.data[0]
    $party=(Invoke-Api 'POST' "$community/parties" @{name='Synthetic owner';kind='person';userId='demo-owner'}).Json.data
    $op=(Invoke-Api 'POST' "$community/parties" @{name='Synthetic operator';kind='company';userId=[Guid]::NewGuid().ToString()}).Json.data
    $from=[DateTime]::UtcNow.ToString('yyyy-MM')+'-01'; $until=[DateTime]::UtcNow.AddYears(1).ToString('yyyy-MM-dd')
    Assert-True ((Invoke-Api 'POST' "$community/ownerships" @{unitId=$unit.id;partyId=$party.id;share=100;incomeShare=100;expenseShare=100;startsOn=$from;endsOn=$null}).Status -eq 200) 'ownership shares'
    $agreement=(Invoke-Api 'POST' "$community/agreements" @{kind='master';creditorPartyId=$party.id;debtorPartyId=$op.id;unitIds=@($unit.id);startsOn=$from;endsOn=$until;rent=100.50;deposit=0;currency='INR';dueDay=5;parentId=$null;occupancyId=$null}).Json.data
    Assert-True ($agreement.kind -eq 'master') 'master agreement binding'
    Assert-True ((Invoke-Api 'POST' "$community/rent/generate" @{month=[DateTime]::UtcNow.ToString('yyyy-MM')}).Json.data.Count -eq 1) 'rent generation'
    Assert-True ((Invoke-Api 'POST' "$community/rent/generate" @{month=[DateTime]::UtcNow.ToString('yyyy-MM')}).Json.data.Count -eq 0) 'rent generation idempotence'
    $seller=(Invoke-Api 'POST' "$community/sellers" @{name='Lobby shop';kind='shop';pickup='Lobby';userId=$null}).Json.data
    Assert-True ($seller.status -eq 'approved') 'internal seller registration'
    $product=(Invoke-Api 'POST' "$community/products" @{sellerId=$seller.id;name='Rice';description='';kind='grocery';ingredients='';allergens='';price=10;currency='INR';stock=3;status='active'}).Json.data
    Assert-True ($product.stock -eq 3) 'catalog listing'
    $orderBody=@{productId=$product.id;quantity=1;submissionId=[Guid]::NewGuid().ToString()}
    $order=(Invoke-Api 'POST' "$community/orders" $orderBody).Json.data
    Assert-True ($order.status -eq 'placed' -and $order.paymentStatus -eq 'unpaid') 'stock reservation order'
    Assert-True ((Invoke-Api 'POST' "$community/orders" $orderBody).Json.data.id -eq $order.id) 'order retry idempotence'
    Assert-True ((Invoke-Api 'POST' "$community/orders" @{productId=$product.id;quantity=3;submissionId=[Guid]::NewGuid().ToString()}).Status -eq 409) 'overselling blocked'
    Assert-True ((Invoke-Api 'POST' "$community/orders/$($order.id)/actions" @{action='accept';revision=0}).Json.data.status -eq 'accepted') 'seller order acceptance'
    Assert-True ((Invoke-Api 'POST' "$community/orders/$($order.id)/actions" @{action='ready';revision=0}).Status -eq 409) 'order revision conflict'
    $group=(Invoke-Api 'POST' "$community/groups" @{productId=$product.id;unitPrice=8;minimum=2;maximum=5;closesAt=[DateTimeOffset]::UtcNow.AddMinutes(5).ToString('O');pickup='Lobby tomorrow'}).Json.data
    Assert-True ($group.status -eq 'open') 'group creation'
    Assert-True ((Invoke-Api 'POST' "$community/groups/$($group.id)/pledge" @{quantity=2;revision=0}).Json.data.committed -eq 2) 'group commitment'
    Assert-True ((Invoke-Api 'POST' "$community/groups/$($group.id)/actions" @{action='finalize';revision=1}).Status -eq 409) 'group deadline enforced'
    $facility=(Invoke-Api 'POST' "$community/facilities" @{name='Hall';capacity=1;slotMinutes=60;price=0;currency='INR';rules='Leave clean'}).Json.data
    $booking=(Invoke-Api 'POST' "$community/bookings" @{facilityId=$facility.id;startsAt=[DateTimeOffset]::UtcNow.AddHours(1).ToString('O');submissionId=[Guid]::NewGuid().ToString()}).Json.data
    Assert-True ($booking.status -eq 'confirmed') 'facility reservation'
    Assert-True ((Invoke-Api 'POST' "$community/bookings/$($booking.id)/actions" @{action='cancel';revision=0}).Json.data.status -eq 'cancelled') 'facility cancellation'
    $shape=@{id=[Guid]::NewGuid().ToString();kind='flat';label=$unit.label;unitId=$unit.id;points=@(@{x=10;y=10},@{x=100;y=10},@{x=100;y=100},@{x=10;y=100})}
    $floor=(Invoke-Api 'POST' "$community/layouts" @{floor=0;name='Ground';shapes=@($shape);revision=0}).Json.data
    Assert-True ($floor.shapes.Count -eq 1) 'floor sketch draft'
    Assert-True ((Invoke-Api 'POST' "$community/layouts/$($floor.id)/actions" @{action='publish';revision=0}).Json.data.publishedAt) 'floor publication'
    Assert-True ((Invoke-Api 'POST' "$community/notes" @{kind='shift';title='Desk handover';body='All arrivals recorded';assignedUserId=$null}).Json.data.status -eq 'posted') 'watchman handover note'
    $view=(Invoke-Api 'GET' '/api/user/context').Json.data
    Assert-True ($view.userContext -eq 2 -and $view.canSwitchContext) 'admin context default'
    $mobileView=(Invoke-Api 'GET' '/api/mobile/context').Json.data
    Assert-True ($mobileView.userContext -eq 2 -and $mobileView.canSwitchContext) 'mobile admin context available'
    $view=(Invoke-Api 'PATCH' '/api/user/context' @{userContext=1;revision=$view.revision}).Json.data
    Assert-True ($view.userContext -eq 1) 'switch to user context'
    $mobileView=(Invoke-Api 'GET' '/api/mobile/context').Json.data
    Assert-True ($mobileView.userContext -eq 1 -and $mobileView.canSwitchContext) 'mobile shares persisted user context'
    Assert-True (!(Invoke-Api 'GET' $community).Json.data.canManage) 'user view removes manager capability'
    Assert-True ((Invoke-Api 'POST' "$community/facilities" @{name='Forbidden';capacity=1;slotMinutes=60;price=0;currency='INR';rules=''}).Status -eq 403) 'user context blocks admin mutation'
    Assert-True ((Invoke-Api 'GET' '/api/user/context').Json.data.userContext -eq 1) 'user context persists across requests'
    Assert-True ((Invoke-Api 'PATCH' '/api/user/context' @{userContext=2;revision=0}).Status -eq 409) 'stale view switch blocked'
    Assert-True ((Invoke-Api 'PATCH' '/api/user/context' @{userContext=2;revision=$view.revision}).Json.data.userContext -eq 2) 'switch back to admin context'
    Assert-True ((Invoke-Api 'GET' $community).Json.data.canManage) 'admin capability restored'
    $directory=(Invoke-Api 'GET' '/api/admin/users').Json.data
    Assert-True ($directory.users.Count -ge 1) 'admin member directory'
    $person=Invoke-Api 'POST' '/api/admin/users' @{displayName='Synthetic member';email='synthetic-member@example.test';role='member';allowUser=$true;allowAdmin=$false;allowSeller=$true;defaultContext=1;memberships=@(@{propertyId='oak-street'});password='Synthetic-Password-123'}
    Assert-True ($person.Status -eq 200 -and !$person.Json.data.allowAdmin -and $person.Json.data.allowSeller) 'synthetic managed account and view permissions'
    $person=$person.Json.data
    Assert-True ((Invoke-Api 'PATCH' "/api/admin/users/$($person.userId)" @{displayName='Synthetic member updated';email=$person.email;role='member';allowUser=$true;allowAdmin=$false;allowSeller=$false;defaultContext=1;memberships=@(@{propertyId='oak-street'});revision=$person.revision}).Status -eq 200) 'managed account editing'
    Assert-True ((Invoke-Api 'POST' "/api/admin/users/$($person.userId)/status" @{action='suspend';revision=0}).Status -eq 409) 'stale account suspension blocked'
    Assert-True ((Invoke-Api 'POST' "/api/admin/users/$($person.userId)/status" @{action='suspend';revision=1}).Status -eq 200) 'account suspension'
    $service=(Invoke-Api 'POST' "$community/services" @{sellerId=$seller.id;name='Home help';category='Home';description='Household assistance';price=200;currency='INR';priceUnit='visit';status='active'}).Json.data
    Assert-True ($service.name -eq 'Home help') 'provider service catalogue'
    $requestBody=@{serviceId=$service.id;description='Synthetic service request';preferredAt=[DateTimeOffset]::UtcNow.AddDays(1).ToString('O');submissionId=[Guid]::NewGuid().ToString()}
    $serviceRequest=(Invoke-Api 'POST' "$community/service-requests" $requestBody).Json.data
    Assert-True ($serviceRequest.status -eq 'requested') 'service request submission'
    Assert-True ((Invoke-Api 'POST' "$community/service-requests" $requestBody).Json.data.id -eq $serviceRequest.id) 'service request retry idempotence'
    Assert-True ((Invoke-Api 'POST' "$community/service-requests/$($serviceRequest.id)/actions" @{action='accept';revision=0}).Json.data.status -eq 'accepted') 'provider accepts request'
    Assert-True ((Invoke-Api 'POST' "$community/service-requests/$($serviceRequest.id)/actions" @{action='complete';revision=1}).Json.data.status -eq 'completed') 'provider completes request'
    $view=(Invoke-Api 'GET' '/api/user/context').Json.data
    $view=(Invoke-Api 'PATCH' '/api/user/context' @{userContext=3;revision=$view.revision}).Json.data
    Assert-True ($view.userContext -eq 3 -and $view.availableContexts.Count -eq 3) 'third view enabled for admin'
    Assert-True ((Invoke-Api 'GET' '/api/mobile/context').Json.data.userContext -eq 3) 'mobile provider view shares selection'
    Assert-True ((Invoke-Api 'GET' '/api/admin/users').Status -eq 403) 'provider view cannot enter admin directory'
    Assert-True ((Invoke-Api 'POST' "$community/orders" @{productId=$product.id;quantity=1;submissionId=[Guid]::NewGuid().ToString()}).Status -eq 403) 'provider view cannot buy'
    Assert-True ((Invoke-Api 'PATCH' '/api/user/context' @{userContext=2;revision=$view.revision}).Json.data.userContext -eq 2) 'return to admin home context'
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

