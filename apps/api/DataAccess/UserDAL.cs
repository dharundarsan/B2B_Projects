using Dapper;
namespace RepairLedger.Api.DataAccess;

public sealed class UserDAL(IConnectionHelper database, ISqlFileQueryHelper sql, IDapperHelper dapper)
{
    private static object IdentityArgs(Actor a)=>new{workspace=a.WorkspaceId,user=a.Id,context=a.CanAdmin?2:1,role=a.Role,email=a.Email,name=a.DisplayName??a.Email.Split('@')[0],admin=a.CanAdmin?1:0,at=DateTimeOffset.UtcNow.ToString("O")};
    private async Task<ManagedUser> Registered(Actor a,CancellationToken ct)
    {
        await using var db=await database.Open(ct);
        await dapper.ExecuteAsync(db,new CommandDefinition(sql.GetSqlQuery("EnsureUser"),IdentityArgs(a),cancellationToken:ct));
        var row=await dapper.QuerySingleAsync<ManagedUser>(db,new CommandDefinition(sql.GetSqlQuery("UserView"),IdentityArgs(a),cancellationToken:ct));
        if(row.Status!="active")throw new ApiException(403,"Your CommunityHub account is suspended. Contact your administrator.");
        return row;
    }
    private static UserView View(Actor a,ManagedUser row)
    {
        var role=row.ManagedRole??a.Role;
        var admin=(role is "owner" or "manager" or "demo")&&(row.ManagedRole==null||row.AllowAdmin);
        var user=admin||row.ManagedRole==null||row.AllowUser;
        var seller=admin||(row.ManagedRole==null?role is not ("watchman" or "vendor")&&row.HasStore:row.AllowSeller);
        var allowed=new[]{user?1:0,admin?2:0,seller?3:0}.Where(x=>x>0).ToArray();
        if(allowed.Length==0)throw new ApiException(403,"No view is enabled for your account. Contact your administrator.");
        return new(role,allowed.Contains(row.UserContext)?row.UserContext:allowed[0],allowed.Length>1,row.Revision,row.DisplayName,row.Email,allowed);
    }
    public async Task<UserView> Read(Actor a,CancellationToken ct)=>View(a,await Registered(a,ct));
    public async Task<Actor> Resolve(Actor a,CancellationToken ct)
    {
        var row=await Registered(a,ct);var view=View(a,row);
        var next=a with{Role=view.Role,UserContext=view.UserContext,AdminAccess=view.AvailableContexts!.Contains(2),SellerAccess=view.AvailableContexts.Contains(3),UserAccess=view.AvailableContexts.Contains(1),DisplayName=view.DisplayName};
        if(row.ManagedRole==null)return next;
        await using var db=await database.Open(ct);
        var memberships=(await dapper.QueryAsync<UserMembership>(db,new CommandDefinition(sql.GetSqlQuery("UserMemberships"),new{workspace=a.WorkspaceId,user=a.Id},cancellationToken:ct))).ToList();
        var units=memberships.Where(m=>m.UnitLabel!=null).ToDictionary(m=>m.PropertyId,m=>new[]{m.UnitLabel!});
        var occupancies=memberships.Where(m=>m.OccupancyId!=null&&m.UnitLabel!=null&&DateTimeOffset.TryParse(m.StartsAt,out _)).Select(m=>new ResidentOccupancy(m.OccupancyId!,m.PropertyId,m.UnitLabel!,DateTimeOffset.Parse(m.StartsAt!),m.EndsAt==null?null:DateTimeOffset.Parse(m.EndsAt))).ToArray();
        return next with{PropertyUnits=units,ResidentOccupancies=occupancies,AssignedPropertyIds=memberships.Select(m=>m.PropertyId).ToArray(),CommunityPropertyIds=memberships.Select(m=>m.PropertyId).ToArray()};
    }
    public async Task<UserView> Switch(Actor a,UserViewInput input,CancellationToken ct)
    {
        var view=await Read(a,ct);
        if(input.UserContext is <1 or >3||input.Revision<0)throw new ApiException(400,"Choose a valid view and the current revision.");
        if(!view.AvailableContexts!.Contains(input.UserContext))throw new ApiException(403,"That view is not enabled for your account.");
        await using var db=await database.Open(ct);
        if(await dapper.ExecuteAsync(db,new CommandDefinition(sql.GetSqlQuery("SwitchUserView"),new{workspace=a.WorkspaceId,user=a.Id,context=input.UserContext,revision=input.Revision},cancellationToken:ct))!=1)throw new ApiException(409,"Your account changed. Refresh and try again.");
        return view with{UserContext=input.UserContext,Revision=input.Revision+1};
    }
    public async Task<object> List(Actor a,CancellationToken ct)
    {
        a.RequireManager();await using var db=await database.Open(ct);
        using var grid=await dapper.QueryMultipleAsync(db,new CommandDefinition(sql.GetSqlQuery("ManagedUsers"),new{workspace=a.WorkspaceId},cancellationToken:ct));
        var users=(await grid.ReadAsync<ManagedUser>()).ToList();var memberships=(await grid.ReadAsync<UserMembership>()).ToList();var audit=(await grid.ReadAsync<UserAdminAudit>()).ToList();
        foreach(var u in users){u.Memberships=memberships.Where(m=>m.UserId==u.UserId).ToList();if(u.ManagedRole==null){u.AllowUser=true;u.AllowAdmin=u.Role is "owner" or "manager" or "demo";u.AllowSeller=u.AllowAdmin||u.Role is not ("watchman" or "vendor")&&u.HasStore;}}
        return new{users,audit};
    }
    public async Task<ManagedUser> Save(Actor a,string id,ManagedUserInput input,bool create,CancellationToken ct)
    {
        a.RequireManager();await using var db=await database.Open(ct);await using var tx=await db.BeginTransactionAsync(ct);
        var args=new{workspace=a.WorkspaceId,user=id};
        if(!create){var previous=(await dapper.QueryAsync<ManagedUser>(db,new CommandDefinition(sql.GetSqlQuery("UserView"),args,tx,cancellationToken:ct))).SingleOrDefault();
            if(previous==null)throw new ApiException(404,"Account not found in this workspace.");
            if(id==a.Id&&(!input.AllowAdmin||input.Role is not ("owner" or "manager")))throw new ApiException(400,"You cannot remove your own admin access.");}
        foreach(var m in input.Memberships)if(await dapper.ExecuteScalarAsync<int>(db,new CommandDefinition(sql.GetSqlQuery("ValidateUserMembership"),new{workspace=a.WorkspaceId,property=m.PropertyId,unit=m.UnitId},tx,cancellationToken:ct))!=1)throw new ApiException(400,"Choose an active building and one of its registered units.");
        var p=new{workspace=a.WorkspaceId,user=id,name=input.DisplayName,email=input.Email,role=input.Role,allowUser=input.AllowUser?1:0,allowAdmin=input.AllowAdmin?1:0,allowSeller=input.AllowSeller?1:0,context=input.DefaultContext,revision=input.Revision,at=DateTimeOffset.UtcNow.ToString("O")};
        if(await dapper.ExecuteAsync(db,new CommandDefinition(sql.GetSqlQuery(create?"ManagedUserInsert":"ManagedUserUpdate"),p,tx,cancellationToken:ct))!=1)throw new ApiException(409,"This account changed. Refresh and try again.");
        var previousMemberships=create?[]:(await dapper.QueryAsync<UserMembership>(db,new CommandDefinition(sql.GetSqlQuery("UserMemberships"),args,tx,cancellationToken:ct))).ToList();
        var membershipsChanged=create||!previousMemberships.OrderBy(m=>m.PropertyId).Select(MembershipValue).SequenceEqual(input.Memberships.OrderBy(m=>m.PropertyId).Select(MembershipValue));
        if(membershipsChanged){
            if(!create)await dapper.ExecuteAsync(db,new CommandDefinition(sql.GetSqlQuery("UserMembershipDelete"),args,tx,cancellationToken:ct));
            foreach(var m in input.Memberships)await dapper.ExecuteAsync(db,new CommandDefinition(sql.GetSqlQuery("UserMembershipInsert"),new{workspace=a.WorkspaceId,user=id,property=m.PropertyId,unit=m.UnitId,occupancy=m.OccupancyId,starts=m.StartsAt,ends=m.EndsAt},tx,cancellationToken:ct));
        }
        await dapper.ExecuteAsync(db,new CommandDefinition(sql.GetSqlQuery("UserAdminAuditInsert"),new{workspace=a.WorkspaceId,user=id,id=Guid.NewGuid().ToString("N"),actor=a.Id,action=create?"account.created":"account.updated",at=p.at},tx,cancellationToken:ct));
        var result=await dapper.QuerySingleAsync<ManagedUser>(db,new CommandDefinition(sql.GetSqlQuery("UserView"),args,tx,cancellationToken:ct));result.Memberships=input.Memberships;
        await tx.CommitAsync(ct);return result;
    }
    private static (string,string?,string?,string?,string?) MembershipValue(UserMembership m)=>(m.PropertyId,m.UnitId,m.OccupancyId,m.StartsAt,m.EndsAt);
    public async Task<object> Status(Actor a,string id,ManagedUserStatusInput input,CancellationToken ct)
    {
        a.RequireManager();if(id==a.Id)throw new ApiException(400,"You cannot suspend your own account.");
        if(input.Action is not ("activate" or "suspend")||input.Revision<0)throw new ApiException(400,"Choose activate or suspend and a valid revision.");
        await using var db=await database.Open(ct);await using var tx=await db.BeginTransactionAsync(ct);
        if(await dapper.ExecuteAsync(db,new CommandDefinition(sql.GetSqlQuery("ManagedUserStatus"),new{workspace=a.WorkspaceId,user=id,status=input.Action=="activate"?"active":"suspended",revision=input.Revision},tx,cancellationToken:ct))!=1)throw new ApiException(409,"This account changed or is outside your workspace.");
        await dapper.ExecuteAsync(db,new CommandDefinition(sql.GetSqlQuery("UserAdminAuditInsert"),new{workspace=a.WorkspaceId,user=id,id=Guid.NewGuid().ToString("N"),actor=a.Id,action="account."+input.Action,at=DateTimeOffset.UtcNow.ToString("O")},tx,cancellationToken:ct));
        await tx.CommitAsync(ct);return new{status=input.Action=="activate"?"active":"suspended"};
    }
}
