# apps/web/src/components/settings/members/roles.ts

- AssignableRole · type · L3-L3 — type AssignableRole = Exclude<Role, "owner">;
- Actor · interface · L5-L8 — interface Actor
- canManageMembers · function · L14-L14 — canManageMembers = (actor: Actor)
- assignableRoles · function · L16-L17 — assignableRoles = (actor: Actor): AssignableRole[]
- isAssignableRole · function · L19-L20 — isAssignableRole = (value: string): value is AssignableRole
- memberBlock · function · L23-L31 — function memberBlock( actor: Actor, target: Pick<MemberView, "userId" | "role">, ): "readOnly" | "adminOwnerOnly" | null
