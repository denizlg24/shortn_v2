"use client";

import type { ReactNode } from "react";
import { ErrorText, type ActionError } from "../editor/action-error";
import { EditorSection } from "../editor/editor-section";
import { SaveRow } from "../settings/save-row";

export interface SaveState {
  pending: boolean;
  saved: boolean;
  error: ActionError<string> | null;
}

export const idleSave: SaveState = {
  pending: false,
  saved: false,
  error: null,
};

/** One editor section with its own save (12 §Bio: saved per section). */
export function BioSection({
  title,
  description,
  dirty,
  state,
  saveLabel,
  viewerReason,
  onSave,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  dirty: boolean;
  state: SaveState;
  /** e.g. "Save profile": four sections, four distinct buttons. */
  saveLabel: string;
  /** Set for viewers: the button stays focusable and says why. */
  viewerReason: string | null;
  onSave: () => void;
  children: ReactNode;
}) {
  return (
    <EditorSection title={title} description={description}>
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          onSave();
        }}
        className="flex max-w-140 flex-col gap-4"
      >
        <fieldset disabled={viewerReason !== null} className="contents">
          {children}
        </fieldset>
        {state.error ? <ErrorText error={state.error} /> : null}
        <SaveRow
          saved={state.saved && !dirty}
          pending={state.pending}
          disabled={!dirty}
          label={saveLabel}
          {...(viewerReason ? { disabledReason: viewerReason } : {})}
        />
      </form>
    </EditorSection>
  );
}
