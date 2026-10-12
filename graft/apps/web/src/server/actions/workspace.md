# apps/web/src/server/actions/workspace.ts

- membersAction · function · L27-L36 — async function membersAction( workspace: string, ): Promise<{ members: MemberView[]; invites: InviteView[] }>
- inviteMemberAction · function · L38-L59 — async function inviteMemberAction( workspace: string, input: { email: string; role: "admin" | "member" | "viewer" }, ): Promise<ActionResult<InviteView>>
- revokeInviteAction · function · L61-L66 — async function revokeInviteAction( workspace: string, id: string, ): Promise<ActionResult<null>>
- changeRoleAction · function · L68-L77 — async function changeRoleAction( workspace: string, userId: string, next: "admin" | "member" | "viewer", ): Promise<ActionResult<null>>
- removeMemberAction · function · L79-L84 — async function removeMemberAction( workspace: string, userId: string, ): Promise<ActionResult<null>>
- createWorkspaceAction · function · L86-L102 — async function createWorkspaceAction(input: { name: string; slug: string; }): Promise<ActionResult<{ slug: string }>>
- updateWorkspaceAction · function · L104-L122 — async function updateWorkspaceAction( workspace: string, input: { name?: string; slug?: string }, ): Promise<ActionResult<{ slug: string; name: string }>>
- deleteWorkspaceAction · function · L124-L128 — async function deleteWorkspaceAction( workspace: string, ): Promise<ActionResult<null>>
