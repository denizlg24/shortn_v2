# packages/core/workspaces/service.ts

- Workspace · type · L5-L5 — type Workspace = Documents["workspaces"];
- UserIdentity · interface · L7-L13 — interface UserIdentity
- WorkspaceContext · interface · L15-L18 — interface WorkspaceContext
- ensurePersonalWorkspace · function · L23-L67 — async function ensurePersonalWorkspace( db: Db, user: UserIdentity, ): Promise<Workspace>
- Membership · interface · L69-L72 — interface Membership
- membershipsFor · function · L74-L96 — async function membershipsFor( db: Db, userId: string, ): Promise<Membership[]>
- workspaceContext · function · L98-L110 — async function workspaceContext( db: Db, userId: string, slug: string, ): Promise<WorkspaceContext | null>
- ownedBy · function · L115-L130 — function ownedBy<T extends { workspaceId?: ObjectId | undefined }>( workspace: Workspace, legacyOwnerField: "sub" | "userId" = "sub", ): Filter<T>
- parseObjectId · function · L132-L136 — function parseObjectId(value: string): ObjectId | null
