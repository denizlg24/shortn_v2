# apps/web/src/server/workspace.ts

- SessionData · type · L14-L14 — type SessionData = NonNullable<Awaited<ReturnType<typeof getSession>>>;
- rememberWorkspace · function · L35-L45 — async function rememberWorkspace(userId: string, workspaceId: ObjectId)
- landingWorkspaceSlug · function · L49-L68 — async function landingWorkspaceSlug(session: SessionData)
