param([Parameter(Mandatory)][string]$BaseUrl, [string]$PropertyId = 'oak-street')
$ErrorActionPreference = 'Stop'
$script:previewData = $null
if ($BaseUrl -notmatch '^http://127\.0\.0\.1:\d+$' -or $PropertyId -notmatch '^[a-z0-9-]+$') { throw 'Use a loopback development API and a valid demo building ID.' }
function Api([string]$method, [string]$path, $body = $null) {
    $options = @{ Uri = $BaseUrl + $path; Method = $method }
    if ($null -ne $body) { $options.ContentType = 'application/json'; $options.Body = $body | ConvertTo-Json -Depth 20 }
    for ($attempt = 0; $attempt -lt 4; $attempt++) {
        try {
            $result = (Invoke-RestMethod @options).data
            if ($method -ne 'GET') { $script:previewData = $null }
            return $result
        }
        catch {
            if ([int]$_.Exception.Response.StatusCode -ne 429 -or $attempt -eq 3) { throw "Sample seed failed during $method $path. $($_.ErrorDetails.Message)" }
            Write-Host 'Demo API rate limit reached; waiting for the next window.'
            Start-Sleep -Seconds 30
        }
    }
}
$account = Api GET '/api/user/context'
if ($account.role -ne 'demo' -or $account.email -ne 'demo@communityhub.local') { throw 'This sample set requires the isolated CommunityHub demo account.' }
$path = '/api/community/' + $PropertyId
function Read {
    if ($null -eq $script:previewData) { $script:previewData = Api GET $path }
    return $script:previewData
}
function Post([string]$resource, $body) { return Api POST ($path + '/' + $resource) $body }
function SampleId([string]$key) {
    $hash = [Security.Cryptography.SHA256]::HashData([Text.Encoding]::UTF8.GetBytes('communityhub-expanded-v1/' + $PropertyId + '/' + $key))
    return [Guid]::new([byte[]]$hash[0..15]).ToString()
}
function Ensure([string]$collection, [string]$resource, [string]$name, $body) {
    $existing = (Read).$collection | Where-Object name -eq $name | Select-Object -First 1
    if ($existing) { return $existing }
    return Post $resource $body
}
function Action([string]$resource, $row, [string]$action) { return Post ($resource + '/' + $row.id + '/actions') @{ action = $action; revision = $row.revision } }
$today = [DateTimeOffset]::UtcNow
$start = $today.AddMonths(-1).ToString('yyyy-MM') + '-01'
$end = $today.AddYears(1).ToString('yyyy-MM') + '-01'
try {
    if ($account.userContext -ne 2) { $null = Api PATCH '/api/user/context' @{ userContext = 2; revision = $account.revision } }
    $data = Read
    if ($data.role -ne 'demo' -or $data.userId -ne 'demo-owner') { throw 'Unexpected preview identity.' }
    foreach ($label in @('201', '202')) {
        if ((Read).units.label -notcontains $label) { $null = Api POST ('/api/properties/' + $PropertyId + '/units') @{ label = $label } }
    }
    $unit = (Read).units | Where-Object label -eq '201' | Select-Object -First 1
    $people = @{}
    foreach ($spec in @(
        @('riley', 'Riley Shah (Demo)', 'tenant', $false),
        @('jordan', 'Jordan Patel (Demo)', 'member', $true),
        @('sam', 'Sam Kumar (Demo)', 'watchman', $false),
        @('avery', 'Avery Rao (Demo)', 'unit_owner', $false),
        @('alex', 'Alex Nair (Demo)', 'unit_owner', $false),
        @('taylor', 'Taylor Das (Demo)', 'operator', $false),
        @('casey', 'Casey Lee (Demo)', 'member', $false)
    )) {
        $email = $spec[0] + '@communityhub.example.invalid'
        $person = (Api GET '/api/admin/users').users | Where-Object email -eq $email | Select-Object -First 1
        if (!$person) {
            $membership = @{ propertyId = $PropertyId }
            if ($spec[2] -eq 'tenant') { $membership.unitId = $unit.id; $membership.occupancyId = SampleId 'riley-occupancy'; $membership.startsAt = $today.AddMonths(-1).ToString('O') }
            $person = Api POST '/api/admin/users' @{ displayName = $spec[1]; email = $email; role = $spec[2]; allowUser = $true; allowAdmin = $false; allowSeller = $spec[3]; defaultContext = 1; memberships = @($membership); password = ([Guid]::NewGuid().ToString('N') + [Guid]::NewGuid().ToString('N')) }
            if ($spec[0] -eq 'casey') { $person = Api POST ('/api/admin/users/' + $person.userId + '/status') @{ action = 'suspend'; revision = $person.revision } }
        }
        $people[$spec[0]] = $person
    }
    $owner = Ensure 'parties' 'parties' 'Avery Rao (Demo owner)' @{ name = 'Avery Rao (Demo owner)'; kind = 'person'; userId = $people.avery.userId }
    $coowner = Ensure 'parties' 'parties' 'Alex Nair (Demo co-owner)' @{ name = 'Alex Nair (Demo co-owner)'; kind = 'person'; userId = $people.alex.userId }
    $tenant = Ensure 'parties' 'parties' 'Riley Shah (Demo resident)' @{ name = 'Riley Shah (Demo resident)'; kind = 'person'; userId = $people.riley.userId }
    $null = Ensure 'parties' 'parties' 'Taylor Das (Demo operator)' @{ name = 'Taylor Das (Demo operator)'; kind = 'person'; userId = $people.taylor.userId }
    foreach ($share in @(@($owner, 65), @($coowner, 35))) {
        if (!((Read).ownerships | Where-Object { $_.unitId -eq $unit.id -and $_.partyId -eq $share[0].id })) {
            $null = Post 'ownerships' @{ unitId = $unit.id; partyId = $share[0].id; share = $share[1]; incomeShare = $share[1]; expenseShare = $share[1]; startsOn = $start; endsOn = $null }
        }
    }
    if (!((Read).agreements | Where-Object { $_.debtorPartyId -eq $tenant.id })) {
        $null = Post 'agreements' @{ kind = 'direct'; creditorPartyId = $owner.id; debtorPartyId = $tenant.id; unitIds = @($unit.id); occupancyId = $people.riley.memberships[0].occupancyId; startsOn = $start; endsOn = $end; rent = 17500; deposit = 35000; currency = 'INR'; dueDay = 5 }
    }
    $null = Post 'rent/generate' @{ month = $today.ToString('yyyy-MM') }
    $agreement = (Read).agreements | Where-Object debtorPartyId -eq $tenant.id | Select-Object -First 1
    $charge = (Read).charges | Where-Object { $_.agreementId -eq $agreement.id -and $_.kind -eq 'rent' -and $_.period -eq $today.ToString('yyyy-MM') } | Select-Object -First 1
    foreach ($spec in @(@('Demo rent - verified partial payment', 5000, $true), @('Demo rent - pending payment', 3500, $false))) {
        if (!((Read).payments | Where-Object reference -eq $spec[0])) {
            $payment = Post 'payments' @{ chargeId = $charge.id; amount = $spec[1]; reference = $spec[0]; submissionId = (SampleId $spec[0]) }
            if ($spec[2]) { $null = Action 'payments' $payment 'verify' }
        }
    }
    foreach ($spec in @(
        @('Lift servicing (Demo)', 'community', 'Lift maintenance', 4500, 'paid'),
        @('Water tank cleaning (Demo)', 'community', 'Cleaning', 2200, 'unpaid'),
        @('Lobby electricity (Demo)', 'community', 'Utilities', 1650, 'paid'),
        @('Flat 201 plumbing repair (Demo)', 'unit', 'Plumbing', 1200, 'unpaid')
    )) {
        if (!((Read).expenses | Where-Object description -eq $spec[0])) { $null = Post 'expenses' @{ description = $spec[0]; scope = $spec[1]; unitId = $(if ($spec[1] -eq 'unit') { $unit.id } else { $null }); category = $spec[2]; amount = $spec[3]; paidStatus = $spec[4]; currency = 'INR'; incurredOn = $today.ToString('yyyy-MM-dd'); allocations = @() } }
    }
    $store = (Read).sellers | Where-Object userId -eq 'demo-owner' | Select-Object -First 1
    if (!$store) { $store = Post 'sellers' @{ name = 'Lobby groceries (Demo)'; kind = 'shop'; pickup = 'Ground-floor lobby'; userId = 'demo-owner' } }
    $kitchen = (Read).sellers | Where-Object name -eq 'Neighbour kitchen' | Select-Object -First 1
    if (!$kitchen) { $kitchen = Post 'sellers' @{ name = 'Neighbour kitchen'; kind = 'resident'; pickup = 'Apartment 101'; userId = (SampleId 'kitchen') } }
    $neighbour = Ensure 'sellers' 'sellers' 'Jordan Crafts & Skills (Demo)' @{ name = 'Jordan Crafts & Skills (Demo)'; kind = 'resident'; pickup = 'First-floor community desk'; userId = $people.jordan.userId }
    $catalogue = @()
    foreach ($spec in @(
        @('Milk 1 litre', 'grocery', 60, 40, $store, '', ''),
        @('Brown bread loaf', 'grocery', 55, 25, $store, '', ''),
        @('Eggs pack of 6', 'grocery', 70, 30, $store, '', ''),
        @('Rice 5 kg bag', 'grocery', 340, 45, $store, '', ''),
        @('Bananas dozen', 'grocery', 65, 35, $store, '', ''),
        @('Tomatoes 1 kg', 'grocery', 40, 60, $store, '', ''),
        @('Laundry detergent 1 kg', 'product', 160, 20, $store, '', ''),
        @('Homemade chapati pack', 'food', 80, 20, $kitchen, 'Whole wheat, water, oil, salt', 'Wheat'),
        @('Vegetable lunch box', 'food', 120, 15, $kitchen, 'Rice, lentils, seasonal vegetables, spices', 'Prepared in a kitchen handling nuts and dairy'),
        @('Chocolate brownies', 'food', 150, 16, $kitchen, 'Wheat, cocoa, butter, eggs, sugar', 'Wheat, dairy, eggs'),
        @('Handmade planter', 'product', 220, 10, $neighbour, '', ''),
        @('Reusable cloth bag', 'product', 90, 30, $neighbour, '', ''),
        @('Used bookshelf', 'product', 900, 1, $neighbour, '', '')
    )) {
        $name = $spec[0] + ' (Demo)'
        $catalogue += Ensure 'products' 'products' $name @{ name = $name; sellerId = $spec[4].id; kind = $spec[1]; price = $spec[2]; stock = $spec[3]; currency = 'INR'; status = 'active'; description = 'Sample listing for exploring apartment pickup and order workflows.'; ingredients = $spec[5]; allergens = $spec[6] }
    }
    $services = @()
    foreach ($spec in @(@('Maths tuition', 'Education', 400, 'hour', $neighbour), @('Plant care visit', 'Home services', 150, 'visit', $neighbour), @('Grocery doorstep delivery', 'Delivery', 30, 'visit', $store), @('Weekly meal preparation', 'Cooking', 500, 'fixed', $kitchen), @('Clothes alterations', 'Tailoring', 180, 'fixed', $neighbour))) {
        $name = $spec[0] + ' (Demo)'
        $services += Ensure 'services' 'services' $name @{ name = $name; sellerId = $spec[4].id; category = $spec[1]; description = 'Sample community service. Confirm timing directly with the provider.'; price = $spec[2]; currency = 'INR'; priceUnit = $spec[3]; status = 'active' }
    }
    for ($i = 0; $i -lt 6; $i++) {
        $id = SampleId ('order-' + $i)
        if ((Read).orders.submissionId -contains $id) { continue }
        $order = Post 'orders' @{ productId = $catalogue[$i].id; quantity = 2; submissionId = $id }
        if ($i -ge 1) { $order = Action 'orders' $order 'accept' }
        if ($i -ge 2 -and $i -le 3) { $order = Action 'orders' $order 'ready' }
        if ($i -eq 3) { $order = Action 'orders' $order 'paid'; $null = Action 'orders' $order 'handover' }
        if ($i -eq 4) { $null = Action 'orders' $order 'cancel' }
        if ($i -eq 5) { $order = Action 'orders' $order 'paid'; $order = Action 'orders' $order 'cancel'; $null = Action 'orders' $order 'refunded' }
    }
    for ($i = 0; $i -lt $services.Count; $i++) {
        $id = SampleId ('service-request-' + $i)
        if ((Read).serviceRequests.submissionId -contains $id) { continue }
        $request = Post 'service-requests' @{ serviceId = $services[$i].id; description = 'Demo request: please confirm availability with the resident.'; preferredAt = $today.AddDays(1 + $i).ToString('O'); submissionId = $id }
        if ($i -eq 1 -or $i -eq 2) { $request = Action 'service-requests' $request 'accept' }
        if ($i -eq 2) { $null = Action 'service-requests' $request 'complete' }
        if ($i -eq 3) { $null = Action 'service-requests' $request 'decline' }
        if ($i -eq 4) { $null = Action 'service-requests' $request 'cancel' }
    }
    foreach ($index in @(3, 4, 11)) {
        if (!((Read).groups | Where-Object productId -eq $catalogue[$index].id)) {
            $group = Post 'groups' @{ productId = $catalogue[$index].id; unitPrice = [Math]::Round($catalogue[$index].price * 0.85, 2); minimum = 5; maximum = 20; closesAt = $today.AddDays(3).ToString('O'); pickup = 'Demo group pickup: lobby desk, 6-8 pm' }
            $null = Post ('groups/' + $group.id + '/pledge') @{ quantity = 2; revision = $group.revision }
        }
    }
    foreach ($spec in @(@('Rooftop garden', 4, 60, 0), @('Study room', 6, 60, 0), @('Guest suite', 1, 1440, 800))) {
        $name = $spec[0] + ' (Demo)'
        $facility = Ensure 'facilities' 'facilities' $name @{ name = $name; capacity = $spec[1]; slotMinutes = $spec[2]; price = $spec[3]; currency = 'INR'; rules = 'Sample amenity. Return keys to the watchman and leave the space clean.' }
        $id = SampleId ('booking-' + $name)
        if ((Read).bookings.submissionId -notcontains $id) { $null = Post 'bookings' @{ facilityId = $facility.id; startsAt = $today.AddDays(2).ToString('O'); submissionId = $id } }
    }
    foreach ($spec in @(@('Weekend community meetup', 'notice', 'Meet your neighbours in the community hall on Saturday evening.'), @('Water maintenance notice', 'notice', 'Sample notice: tank cleaning is planned for tomorrow morning.'), @('Morning watchman shift', 'shift', 'Demo shift: 6 am-2 pm. Check visitor approvals and parcel handovers.'), @('Fire exit inspection', 'round', 'Check that corridors and emergency exits are clear.'), @('Terrace lights check', 'round', 'Inspect terrace lighting and report any faulty lamps.'))) {
        $title = $spec[0] + ' (Demo)'
        if (!((Read).notes | Where-Object title -eq $title)) { $null = Post 'notes' @{ kind = $spec[1]; title = $title; body = $spec[2]; assignedUserId = $(if ($spec[1] -eq 'round') { $people.sam.userId } else { $null }) } }
    }
    foreach ($spec in @(@('Demo guest - Riley family', 'visitor'), @('Demo parcel - book delivery', 'parcel'), @('Demo contractor - plumbing', 'contractor'))) {
        if (!((Read).gateEntries | Where-Object name -eq $spec[0])) { $null = Post 'gate' @{ kind = $spec[1]; name = $spec[0]; unitId = $unit.id; expectedAt = $today.AddHours(1).ToString('O') } }
    }
    $data = Read
    if ($catalogue.Count -ne 13 -or $services.Count -ne 5 -or $data.orders.Count -lt 6 -or $data.serviceRequests.Count -lt 5 -or $people.Count -ne 7) { throw 'Sample set verification failed.' }
    [pscustomobject]@{ Building = $data.property.name; Products = $data.products.Count; Services = $data.services.Count; Orders = $data.orders.Count; ServiceRequests = $data.serviceRequests.Count; GroupBuys = $data.groups.Count; Facilities = $data.facilities.Count; Bookings = $data.bookings.Count; Expenses = $data.expenses.Count; Payments = $data.payments.Count; GateEntries = $data.gateEntries.Count; Accounts = (Api GET '/api/admin/users').users.Count }
}
finally {
    $current = Api GET '/api/user/context'
    if ($current.userContext -ne $account.userContext) { $null = Api PATCH '/api/user/context' @{ userContext = $account.userContext; revision = $current.revision } }
}
