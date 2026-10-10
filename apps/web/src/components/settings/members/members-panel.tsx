"use client";

import type { InviteView, MemberView } from "@shortn/core";
import { useMemo } from "react";
import { InviteSection } from "./invite-form";
import { InviteList } from "./invite-list";
import { MemberList } from "./member-list";
import type { Actor } from "./roles";

export function MembersPanel({
  workspace,
  members,
  invites,
  actor,
  seats,
  canUpgrade,
  now,
}: {
  workspace: { slug: string; name: string };
  members: MemberView[];
  invites: InviteView[];
  actor: Actor;
  seats: { used: number; limit: number | null };
  canUpgrade: boolean;
  /** Server time, so relative dates render the same on server and client. */
  now: string;
}) {
  const nowDate = useMemo(() => new Date(now), [now]);
  return (
    <>
      <InviteSection
        slug={workspace.slug}
        actor={actor}
        seats={seats}
        canUpgrade={canUpgrade}
      />
      <MemberList workspace={workspace} members={members} actor={actor} />
      <InviteList
        slug={workspace.slug}
        invites={invites}
        members={members}
        actor={actor}
        now={nowDate}
      />
    </>
  );
}
