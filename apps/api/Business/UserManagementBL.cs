using System.Net.Mail;
using RepairLedger.Api.DataAccess;
using RepairLedger.Api.ExternalAPI;
namespace RepairLedger.Api.Business;

public sealed class UserManagementBL(UserDAL users,SupabaseAdmin accounts)
{
    public static ManagedUserInput Validate(ManagedUserInput input,bool create)
    {
        var name=input.DisplayName?.Trim()??"";var email=input.Email?.Trim().ToLowerInvariant()??"";
        if(name.Length is <1 or >200||email.Length>254||!MailAddress.TryCreate(email,out var address)||address.Address!=email)throw new ApiException(400,"Enter a name and a valid email address.");
        if(input.Role is not ("member" or "tenant" or "watchman" or "unit_owner" or "operator" or "owner" or "manager"))throw new ApiException(400,"Choose a supported account role.");
        var admin=input.Role is "owner" or "manager";
        if(input.AllowAdmin!=admin||admin&&(!input.AllowUser||!input.AllowSeller))throw new ApiException(400,"Administrators require all three views. Other roles cannot have Admin view.");
        if(!input.AllowUser&&!input.AllowSeller||input.Role=="watchman"&&(!input.AllowUser||input.AllowSeller))throw new ApiException(400,"Enable an appropriate account view; watchmen use User view only.");
        var allowed=new[]{input.AllowUser?1:0,input.AllowAdmin?2:0,input.AllowSeller?3:0};
        if(!allowed.Contains(input.DefaultContext)||input.DefaultContext==0||input.Revision<0)throw new ApiException(400,"Choose an enabled starting view and a valid revision.");
        if(create&&(input.Password?.Length is not (>=12 and <=128)))throw new ApiException(400,"Use an initial password with 12–128 characters.");
        var memberships=input.Memberships??[];
        if(memberships.Count>100||memberships.Select(m=>m.PropertyId).Distinct().Count()!=memberships.Count)throw new ApiException(400,"Choose at most 100 distinct buildings.");
        foreach(var m in memberships){
            if(string.IsNullOrWhiteSpace(m.PropertyId)||m.PropertyId.Length>200||m.UnitId?.Length>300)throw new ApiException(400,"Choose valid building and unit IDs.");
            if(m.OccupancyId!=null){if(input.Role!="tenant"||m.UnitId==null||!Guid.TryParse(m.OccupancyId,out _)||!DateTimeOffset.TryParse(m.StartsAt,out var from)||!HasZone(m.StartsAt)||m.EndsAt!=null&&(!DateTimeOffset.TryParse(m.EndsAt,out var until)||!HasZone(m.EndsAt)||until<=from))throw new ApiException(400,"Resident occupancy requires a unit, a new UUID and valid start/end instants with timezones.");
                m.StartsAt=DateTimeOffset.Parse(m.StartsAt!).ToUniversalTime().ToString("O");if(m.EndsAt!=null)m.EndsAt=DateTimeOffset.Parse(m.EndsAt).ToUniversalTime().ToString("O");}
            else if(m.StartsAt!=null||m.EndsAt!=null||input.Role=="tenant"&&m.UnitId!=null)throw new ApiException(400,"A tenant's assigned unit needs a dated occupancy UUID.");
        }
        return input with{DisplayName=name,Email=email,Memberships=memberships};
    }
    private static bool HasZone(string? value)=>value!=null&&value.Contains('T')&&(value.EndsWith('Z')||System.Text.RegularExpressions.Regex.IsMatch(value,@"[+-]\d{2}:\d{2}$"));
    public async Task<ManagedUser> Create(Actor actor,ManagedUserInput input,CancellationToken ct)
    {
        actor.RequireManager();input=Validate(input,true);var id=await accounts.Create(actor,input,ct);
        try{return await users.Save(actor,id,input,true,ct);}catch{await accounts.RemoveNewAccount(actor,id);throw;}
    }
    public Task<ManagedUser> Update(Actor actor,string id,ManagedUserInput input,CancellationToken ct)
    {actor.RequireManager();return users.Save(actor,id,Validate(input,false) with{Password=null},false,ct);}
}
