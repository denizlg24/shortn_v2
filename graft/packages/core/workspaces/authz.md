# packages/core/workspaces/authz.ts

- Role · type · L3-L3 — type Role = Documents["workspace_members"]["role"];
- Action · type · L5-L16 — type Action = | "workspace.view" | "resource.create" | "resource.update" | "resource.delete" | "domains.manage" | "apiKeys.manage" | "webhooks.manage" | "members.manage" | "workspace.update" | "billing.manage" | "workspace.delete";
- Actor · interface · L34-L37 — interface Actor
- can · function · L40-L49 — function can( actor: Actor, action: Action, resource?: { createdBy?: string | undefined }, ): boolean
