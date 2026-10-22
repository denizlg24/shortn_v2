import "server-only";
import { adminDenial, type AdminAction } from "@shortn/core";
import { requireAdmin } from "./session";

/** What an action page should render for this admin: the form, a step-up
 * prompt, or a refusal. The action re-checks on submit. */
export async function actionGate(action: AdminAction) {
  const current = await requireAdmin();
  const denial = adminDenial(
    { role: current.admin.role, elevatedAt: current.session.elevatedAt },
    action,
  );
  return { current, denial };
}

/** Whether to render a control (button/link) for an action at all. */
export async function canRender(action: AdminAction) {
  const { denial } = await actionGate(action);
  return denial !== "forbidden";
}
