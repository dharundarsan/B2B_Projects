param([Parameter(Mandatory)][string]$BaseUrl)
$ErrorActionPreference='Stop'
if ($BaseUrl -notmatch '^http://127\.0\.0\.1:\d+$') { throw 'This seed requires an isolated loopback development API.' }
$context=(Invoke-RestMethod ($BaseUrl+'/api/community/context')).data
if($context.role -ne 'demo') { throw 'Synthetic community seeding requires Development demo mode.' }
function Post([string]$path,$body) { return (Invoke-RestMethod ($BaseUrl+'/api/community/oak-street/'+$path) -Method Post -ContentType 'application/json' -Body ($body|ConvertTo-Json -Depth 20)).data }
$data=(Invoke-RestMethod ($BaseUrl+'/api/community/oak-street')).data
if($data.parties.Count -gt 0) { throw 'Use a fresh synthetic database; this building already has community records.' }
$units=@($data.units | Select-Object -First 2)
if($units.Count -lt 2) {
    foreach($label in @('101','102')) {
        if($data.units.label -notcontains $label) { $null=Invoke-RestMethod ($BaseUrl+'/api/properties/oak-street/units') -Method Post -ContentType 'application/json' -Body (@{label=$label}|ConvertTo-Json) }
    }
    $units=@((Invoke-RestMethod ($BaseUrl+'/api/community/oak-street')).data.units | Select-Object -First 2)
}
if($units.Count -lt 2) { throw 'Demo requires two registered units.' }
$owner=Post 'parties' @{name='Oak Street Owner';kind='person';userId='demo-owner'}
$operator=Post 'parties' @{name='Floor rental operator';kind='company';userId=[Guid]::NewGuid().ToString()}
$resident=Post 'parties' @{name='Apartment resident';kind='person';userId=[Guid]::NewGuid().ToString()}
$start=([DateTime]::UtcNow.AddMonths(-1).ToString('yyyy-MM')+'-01')
$end=([DateTime]::UtcNow.AddYears(1).ToString('yyyy-MM')+'-01')
foreach($unit in $units) { $null=Post 'ownerships' @{unitId=$unit.id;partyId=$owner.id;share=100;incomeShare=100;expenseShare=100;startsOn=$start;endsOn=$null} }
$master=Post 'agreements' @{kind='master';creditorPartyId=$owner.id;debtorPartyId=$operator.id;parentId=$null;occupancyId=$null;unitIds=@($units.id);startsOn=$start;endsOn=$end;rent=20000;deposit=40000;currency='INR';dueDay=5}
$null=Post 'agreements' @{kind='sublease';creditorPartyId=$operator.id;debtorPartyId=$resident.id;parentId=$master.id;occupancyId=[Guid]::NewGuid().ToString();unitIds=@($units[0].id);startsOn=$start;endsOn=$end;rent=14000;deposit=25000;currency='INR';dueDay=3}
$null=Post 'rent/generate' @{month=[DateTime]::UtcNow.ToString('yyyy-MM')}
$null=Post 'expenses' @{scope='unit';unitId=$units[0].id;partyId=$null;category='Maintenance';description='Corridor-facing door repair';amount=1800;currency='INR';incurredOn=[DateTime]::UtcNow.ToString('yyyy-MM-dd');paidStatus='unpaid';allocations=@()}
$store=Post 'sellers' @{name='Lobby groceries';kind='shop';pickup='Ground floor, beside the lift';userId='demo-owner'}
$kitchen=Post 'sellers' @{name='Neighbour kitchen';kind='resident';pickup='Apartment '+$units[0].label;userId=[Guid]::NewGuid().ToString()}
$product=Post 'products' @{sellerId=$store.id;name='Fresh vegetables basket';description='Seasonal vegetables packed for apartment pickup.';kind='grocery';ingredients='';allergens='';price=180;currency='INR';stock=30;status='active'}
$null=Post 'products' @{sellerId=$kitchen.id;name='Homemade idli';description='A box of six steamed idlis prepared this morning.';kind='food';ingredients='Rice, lentils, salt';allergens='None declared';price=60;currency='INR';stock=15;status='active'}
$null=Post 'services' @{sellerId=$store.id;name='Home essentials delivery';category='Home services';description='Get your apartment shop order delivered to your door.';price=30;currency='INR';priceUnit='visit';status='active'}
$null=Post 'groups' @{productId=$product.id;unitPrice=150;minimum=10;maximum=30;closesAt=[DateTimeOffset]::UtcNow.AddDays(1).ToString('O');pickup='Tomorrow 6–8 pm at the lobby shop'}
$null=Post 'facilities' @{name='Community hall';capacity=1;slotMinutes=60;price=300;currency='INR';rules='Keep the hall clean and return the key to the watchman.'}
$null=Post 'facilities' @{name='Badminton court';capacity=2;slotMinutes=45;price=0;currency='INR';rules='Indoor shoes only. Respect the end of your slot.'}
$null=Post 'notes' @{kind='notice';title='Welcome to the apartment community';body='Shop inside the building, organize group buys, track rent and reserve shared spaces.';assignedUserId=$null}
$null=Post 'notes' @{kind='round';title='Evening common-area round';body='Check lobby lights, lift doors and terrace access.';assignedUserId=$null}
function Shape([string]$kind,[string]$label,$unit,[int]$x,[int]$y,[int]$w,[int]$h) { return @{id=[Guid]::NewGuid().ToString();kind=$kind;label=$label;unitId=$unit;points=@(@{x=$x;y=$y},@{x=($x+$w);y=$y},@{x=($x+$w);y=($y+$h)},@{x=$x;y=($y+$h)})} }
$shapes=@((Shape 'outline' 'Building outline' $null 70 70 860 460),(Shape 'flat' $units[0].label $units[0].id 100 100 300 180),(Shape 'flat' $units[1].label $units[1].id 600 100 300 180),(Shape 'common' 'Shared corridor' $null 100 310 800 80),(Shape 'lift' 'Lift' $null 440 100 100 180),(Shape 'shop' 'Lobby groceries' $null 100 420 300 80),(Shape 'stairs' 'Stairs' $null 600 420 300 80))
$layout=Post 'layouts' @{floor=0;name='Ground floor';revision=0;shapes=$shapes}
$null=Post ('layouts/'+$layout.id+'/actions') @{action='publish';revision=$layout.revision}
Write-Output 'Synthetic community preview is ready.'
