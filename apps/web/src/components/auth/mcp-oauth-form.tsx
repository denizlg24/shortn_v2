"use client";

import { Button } from "@shortn/ui";
import { useTranslations } from "next-intl";
import { useActionState, useEffect, useRef, useState } from "react";
import { mcpOAuthAction } from "@/server/actions/mcp-oauth";
import { FormAlert } from "./auth-parts";

export function McpOAuthForm({
  phase,
  query,
  workspaces,
  selected,
}: {
  phase: "workspace" | "consent";
  query: string;
  workspaces: {
    id: string;
    name: string;
    role: "owner" | "admin" | "member" | "viewer";
  }[];
  selected?: string;
}) {
  const t = useTranslations("mcpOAuth"),
    [state, action, pending] = useActionState(mcpOAuthAction, {});
  const alert = useRef<HTMLDivElement>(null);
  const [decision, setDecision] = useState("primary");
  useEffect(() => {
    if (state.error) alert.current?.focus();
  }, [state]);
  return (
    <form action={action} aria-busy={pending} className="flex flex-col gap-4">
      <input type="hidden" name="oauth_query" value={query} />
      <input type="hidden" name="phase" value={phase} />
      {phase === "workspace" ? (
        workspaces.length ? (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="mcp-workspace" className="text-small font-medium">
              {t("workspace.label")}
            </label>
            <select
              id="mcp-workspace"
              name="workspace"
              defaultValue={selected ?? ""}
              required
              disabled={pending}
              className="h-11 w-full min-w-0 rounded-control border border-line bg-bg px-3 text-body focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
            >
              <option value="" disabled>
                {t("workspace.placeholder")}
              </option>
              {workspaces.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · {t(`roles.${item.role}`)}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <p className="text-body text-fg-muted">{t("workspace.empty")}</p>
        )
      ) : (
        <input type="hidden" name="workspace" value={selected ?? ""} />
      )}
      {state.error ? (
        <div ref={alert} tabIndex={-1} className="outline-none">
          <FormAlert>{t(`errors.${state.error}`)}</FormAlert>
        </div>
      ) : null}
      <div className="flex flex-row-reverse flex-wrap gap-3">
        <Button
          type="submit"
          name="decision"
          value={phase === "workspace" ? "continue" : "allow"}
          variant="primary"
          size="lg"
          loading={pending && decision === "primary"}
          onClick={() => setDecision("primary")}
          disabled={
            pending || !workspaces.length || (phase === "consent" && !selected)
          }
          className="flex-1"
        >
          {t(phase === "workspace" ? "continue" : "allow")}
        </Button>
        <Button
          type="submit"
          name="decision"
          value="cancel"
          formNoValidate
          variant="secondary"
          size="lg"
          loading={pending && decision === "cancel"}
          disabled={pending}
          onClick={() => setDecision("cancel")}
          className="flex-1"
        >
          {t("cancel")}
        </Button>
      </div>
    </form>
  );
}
