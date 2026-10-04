export interface Membership { propertyId:string; unitId?:string|null; unitLabel?:string; occupancyId?:string|null; startsAt?:string|null; endsAt?:string|null }
export interface ManagedUser { userId:string; displayName:string; email:string; role:string; status:string; allowUser:boolean; allowAdmin:boolean; allowSeller:boolean; userContext:1|2|3; revision:number; memberships:Membership[] }
export interface UserAdminAudit { id:string; userId:string; actorId:string; action:string; createdAt:string }
export interface UserDirectory { users:ManagedUser[]; audit:UserAdminAudit[] }
