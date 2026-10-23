"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useTranslations } from "next-intl";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical,
  Pencil,
  Plus,
  List,
  Palette,
  Settings,
  History,
  Smartphone,
  Monitor,
  EyeOff,
} from "lucide-react";
import {
  groupBioLinks,
  newBioLinksSection,
  orderBioLinks,
  bioContentSchema,
  bioContrast,
  bioFonts,
  bioPresets,
  readableBioColor,
  type BioBlock,
  type BioContent,
  type BioResolvedLink,
} from "@shortn/core/bio-content";
import {
  saveBioContentAction,
  publishBioContentAction,
  restoreBioContentAction,
  changeBioHandleAction,
  bioVersionListAction,
} from "@/server/actions/bio-publishing";
import { tourAnchor } from "@/lib/tour/anchors";
import type { PlanId } from "@shortn/billing";
import { cn } from "@shortn/ui";
import { ImageUpload, useUploadStatus } from "../page/image-upload";
import { PlanGate } from "../plan-gate";
import { LinkManager } from "./link-manager";
import "./bio-editor.css";
import { BioRenderer } from "./public/bio-renderer";
import "./public/fonts.css";

// Free pages cannot schedule sections, show the badge or hide branding;
// every paid plan can (core/bio/publishing validateContent).
const paidPlan: PlanId = "basic";

function CanvasSection({
  block,
  children,
  label,
  edit,
}: {
  block: BioBlock;
  children: ReactNode;
  label: string;
  edit: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: block.id, disabled: block.type === "profile" });
  return (
    <div
      data-section-id={block.id}
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`studio-section${!block.visible ? " studio-section-hidden" : ""}`}
    >
      <div className="studio-section-tools">
        {block.type !== "profile" ? (
          <button
            type="button"
            aria-label={label}
            {...attributes}
            {...listeners}
          >
            <GripVertical aria-hidden className="size-4" />
          </button>
        ) : null}
        <button type="button" onClick={edit}>
          <Pencil aria-hidden className="size-3.5" />
          {label}
          {!block.visible ? <EyeOff aria-hidden className="size-3.5" /> : null}
        </button>
      </div>
      <div className="studio-section-content" onClick={edit}>
        {(block.type === "links" && block.items.length === 0
          ? null
          : children) || <p className="studio-placeholder">{label}</p>}
      </div>
      <button
        type="button"
        className="studio-section-hit"
        aria-label={label}
        onClick={edit}
      />
    </div>
  );
}
export function BioEditor({
  workspace,
  id,
  initial,
  initialRevision,
  initialHandle,
  links: initialLinks,
  versions,
  paid,
  initialSection,
}: {
  initialSection?: string | undefined;
  workspace: string;
  id: string;
  initial: BioContent;
  initialRevision: number;
  initialHandle: string;
  links: Record<string, BioResolvedLink>;
  versions: { revision: number; createdAt: string }[];
  paid: boolean;
}) {
  const t = useTranslations("bio.editor"),
    p = useTranslations("bio.public"),
    previewText = useTranslations("bio.preview");
  const [content, setContent] = useState(() =>
      groupBioLinks(bioContentSchema.parse(initial)),
    ),
    [links, setLinks] = useState(initialLinks),
    [handle, setHandle] = useState(initialHandle);
  const [status, setStatus] = useState(""),
    [busy, setBusy] = useState(false),
    [desktop, setDesktop] = useState(false);
  const [panel, setPanel] = useState<
    | "add"
    | "link-target"
    | "outline"
    | "theme"
    | "settings"
    | "history"
    | "section"
    | "links"
    | null
  >(initialSection ? "links" : null);
  const [addingLinks, setAddingLinks] = useState(false);
  const [selected, setSelected] = useState<string | null>(
    initialSection ?? null,
  );
  const { uploading, onBusyChange } = useUploadStatus();
  useEffect(() => {
    if (panel) document.getElementById("studio-panel-title")?.focus();
  }, [panel]);
  const [history, setHistory] = useState(versions);
  const [qrImages, setQrImages] = useState<Record<string, string>>({});
  useEffect(() => {
    let current = true;
    void Promise.all(
      content.blocks
        .filter((block) => block.type === "qr")
        .map(async (block) => {
          if (block.type !== "qr" || !links[block.linkId]) return null;
          const href = new URL(links[block.linkId]!.href);
          href.searchParams.set("block", block.id);
          return [
            block.linkId,
            await (
              await import("qrcode")
            ).default.toDataURL(href.href, {
              margin: 2,
              errorCorrectionLevel: "M",
            }),
          ] as const;
        }),
    ).then((images) => {
      if (current)
        setQrImages(
          Object.fromEntries(images.filter((image) => image !== null)),
        );
    });
    return () => {
      current = false;
    };
  }, [content.blocks, links]);
  const revision = useRef(initialRevision),
    draft = useRef(content),
    saved = useRef(JSON.stringify(initial)),
    inFlight = useRef<Promise<boolean> | null>(null),
    mounted = useRef(true);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  // "Newest first" sections follow link creation times, which arrive with
  // each resolved link; the server applies the same order on save.
  useEffect(() => {
    setContent((current) =>
      orderBioLinks(current, (linkId) => links[linkId]?.createdAt),
    );
  }, [content, links]);
  draft.current = content;
  const save = useCallback(async (): Promise<boolean> => {
    if (inFlight.current) {
      if (!(await inFlight.current)) return false;
      return save();
    }
    const snapshot = JSON.stringify(draft.current);
    if (snapshot === saved.current) return true;
    setStatus("saving");
    const operation = (async () => {
      try {
        const result = await saveBioContentAction(
          workspace,
          id,
          revision.current,
          JSON.parse(snapshot),
        );
        if (!result.ok) {
          if (mounted.current)
            setStatus(result.error === "conflict" ? "conflict" : "saveFailed");
          return false;
        }
        revision.current = result.value.revision;
        saved.current = snapshot;
        if (mounted.current) setStatus("saved");
        return true;
      } catch {
        if (mounted.current) setStatus("saveFailed");
        return false;
      } finally {
        inFlight.current = null;
      }
    })();
    inFlight.current = operation;
    return operation;
  }, [workspace, id]);
  useEffect(() => {
    const timer = setTimeout(() => {
      void save();
    }, 900);
    return () => clearTimeout(timer);
  }, [content, save]);
  useEffect(() => {
    mounted.current = true;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (JSON.stringify(draft.current) !== saved.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      mounted.current = false;
      window.removeEventListener("beforeunload", beforeUnload);
    };
  }, []);
  function update(blockId: string, patch: Record<string, unknown>) {
    setContent((c) => ({
      ...c,
      blocks: c.blocks.map((b) =>
        b.id === blockId ? ({ ...b, ...patch } as BioBlock) : b,
      ),
    }));
  }
  function move(blockId: string, delta: number) {
    setContent((c) => {
      const at = c.blocks.findIndex((b) => b.id === blockId),
        to = at + delta;
      return at <= 0 || to <= 0 || to >= c.blocks.length
        ? c
        : { ...c, blocks: arrayMove(c.blocks, at, to) };
    });
  }
  const field = (
    label: string,
    value: string,
    onChange: (value: string) => void,
    type = "text",
    disabled = false,
  ) => (
    <label className="flex flex-col gap-1 text-small">
      {label}
      <input
        className="min-h-10 w-full rounded-control border border-line-strong bg-bg px-3 py-2 text-fg focus-visible:outline-2 focus-visible:outline-signal disabled:cursor-not-allowed disabled:opacity-50"
        type={type}
        value={value ?? ""}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
  const select = (
    label: string,
    value: string,
    options: string[],
    onChange: (value: string) => void,
  ) => (
    <label className="flex flex-col gap-1 text-small">
      {label}
      <select
        aria-label={label}
        className="min-h-10 rounded-control border border-line-strong bg-bg px-2 text-fg"
        value={value ?? options[0] ?? ""}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((value) => (
          <option value={value} key={value}>
            {value === ""
              ? t("customTheme")
              : links[value]?.title ||
                ([
                  "vertical",
                  "paginated",
                  "list",
                  "small-grid",
                  "large-grid",
                  "image-grid",
                  "arrows",
                  "labels",
                  "image-text",
                  "image-only",
                  "theme",
                  "square",
                  "rounded",
                  "cover",
                  "contain",
                  "text",
                  "minimal",
                  "soft",
                  "filled",
                  "outline",
                  "none",
                  "subtle",
                  "solid",
                  "divider",
                  "regular",
                  "medium",
                  "bold",
                  "compact",
                  "comfortable",
                  "spacious",
                  "muted",
                  "small",
                ].includes(value)
                  ? t(`layouts.${value}` as "layouts.vertical")
                  : value)}
          </option>
        ))}
      </select>
    </label>
  );
  const add = (type: BioBlock["type"]) => {
    const common = { id: crypto.randomUUID(), visible: true };
    const linkId = Object.keys(links)[0] ?? "";
    const block =
      type === "links"
        ? newBioLinksSection(common.id)
        : type === "link"
          ? { ...common, type, linkId, title: "", image: "", highlight: false }
          : type === "qr"
            ? { ...common, type, linkId, title: "" }
            : type === "header" || type === "text"
              ? { ...common, type, text: "" }
              : type === "image"
                ? { ...common, type, url: "", alt: "" }
                : type === "embed"
                  ? { ...common, type, provider: "youtube", url: "" }
                  : { ...common, type: "socials", items: [] };
    setContent((c) => ({ ...c, blocks: [...c.blocks, block as BioBlock] }));
    setSelected(common.id);
    setAddingLinks(type === "links");
    setPanel(type === "links" ? "links" : "section");
  };
  async function publish() {
    setBusy(true);
    try {
      if (!(await save())) return;
      const result = await publishBioContentAction(
        workspace,
        id,
        revision.current,
      );
      if (result.ok) setHistory(await bioVersionListAction(workspace, id));
      setStatus(
        result.ok
          ? "published"
          : result.error === "conflict"
            ? "conflict"
            : "publishFailed",
      );
    } catch {
      setStatus("publishFailed");
    } finally {
      setBusy(false);
    }
  }
  const profile = content.blocks[0];
  const selectedBlock = content.blocks.find((block) => block.id === selected);
  const open = (block: BioBlock) => {
    setSelected(block.id);
    setPanel("section");
  };
  const startAddingLinks = () => {
    setAddingLinks(true);
    const sections = content.blocks.filter((block) => block.type === "links");
    if (!sections.length) add("links");
    else if (sections.length === 1) {
      setSelected(sections[0]!.id);
      setPanel("links");
    } else setPanel("link-target");
  };
  const panelTitle =
    panel === "link-target"
      ? t("chooseLinkSection")
      : panel === "section" && selectedBlock
        ? t(`types.${selectedBlock.type}`)
        : panel === "links"
          ? t("manageLinks")
          : panel === "add"
            ? t("addSection")
            : panel === "outline"
              ? t("sections")
              : panel === "theme"
                ? t("theme")
                : panel === "history"
                  ? t("versions")
                  : t("pageSettings");
  const previewLinks = Object.fromEntries(
    Object.entries(links).map(([id, link]) => [
      id,
      { ...link, ...(qrImages[id] ? { qrImage: qrImages[id] } : {}) },
    ]),
  );
  const selectedPreset =
    Object.entries(bioPresets).find(([, preset]) =>
      (Object.keys(content.theme) as (keyof BioContent["theme"])[]).every(
        (key) => content.theme[key] === preset[key],
      ),
    )?.[0] ?? "";
  const previewLabels = {
    branding: p("branding"),
    loadEmbed: p.raw("loadEmbed"),
    embedConsent: p.raw("embedConsent"),
    unavailable: p("unavailable"),
  };
  return (
    <div className="bio-studio">
      <div className="studio-toolbar" {...tourAnchor("bio-toolbar")}>
        <div className="flex flex-wrap gap-2">
          <button
            className="studio-primary"
            type="button"
            disabled={uploading || busy}
            onClick={startAddingLinks}
          >
            <Plus aria-hidden />
            {t("addLinks")}
          </button>
          <button
            type="button"
            className="studio-tool"
            disabled={uploading || busy || content.blocks.length >= 150}
            onClick={() => setPanel("add")}
          >
            <Plus aria-hidden />
            {t("addSection")}
          </button>
          <button
            type="button"
            className="studio-tool"
            disabled={uploading || busy}
            onClick={() => profile && open(profile)}
          >
            <Pencil aria-hidden />
            {t("editProfile")}
          </button>
          {(
            [
              ["outline", List, "sections"],
              ["theme", Palette, "theme"],
              ["settings", Settings, "pageSettings"],
              ["history", History, "history"],
            ] as const
          ).map(([name, Icon, label]) => (
            <button
              key={name}
              aria-label={t(label)}
              className="studio-tool"
              type="button"
              disabled={uploading || busy}
              onClick={() => setPanel(name)}
            >
              <Icon aria-hidden />
              <span>{t(label)}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="studio-tool"
            aria-label={t("phone")}
            aria-pressed={!desktop}
            onClick={() => setDesktop(false)}
          >
            <Smartphone aria-hidden />
          </button>
          <button
            type="button"
            className="studio-tool"
            aria-label={t("desktop")}
            aria-pressed={desktop}
            onClick={() => setDesktop(true)}
          >
            <Monitor aria-hidden />
          </button>
          <button
            className="studio-primary"
            type="button"
            disabled={busy || uploading}
            onClick={() => void publish()}
          >
            {t("publish")}
          </button>
        </div>
      </div>
      <div className="studio-status">
        <p role="status">
          {status ? t(`status.${status}` as "status.saved") : t("draftHint")}
        </p>
        {status === "saveFailed" ? (
          <button type="button" onClick={() => void save()}>
            {t("saveDraft")}
          </button>
        ) : null}
        <span>{t("canvasHint")}</span>
      </div>
      <div className="studio-canvas" hidden={panel !== null}>
        <div className="studio-preview" style={{ width: desktop ? 760 : 390 }}>
          <DndContext
            id={`bio-canvas-${id}`}
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={({ active, over }) => {
              if (over && active.id !== over.id)
                setContent((c) => {
                  const from = c.blocks.findIndex((b) => b.id === active.id),
                    to = c.blocks.findIndex((b) => b.id === over.id);
                  return from > 0 && to > 0
                    ? { ...c, blocks: arrayMove(c.blocks, from, to) }
                    : c;
                });
            }}
          >
            <SortableContext
              items={content.blocks.slice(1).map((b) => b.id)}
              strategy={verticalListSortingStrategy}
            >
              <BioRenderer
                content={content}
                links={previewLinks}
                preview
                labels={previewLabels}
                renderSection={(block, children) => (
                  <CanvasSection
                    block={block}
                    label={t("editSection", { type: t(`types.${block.type}`) })}
                    edit={() => open(block)}
                  >
                    {children}
                  </CanvasSection>
                )}
              />
            </SortableContext>
          </DndContext>
          <button
            className="studio-add-bottom"
            type="button"
            disabled={uploading || busy}
            onClick={() => setPanel("add")}
          >
            <Plus aria-hidden className="size-4" />
            {t("addSection")}
          </button>
        </div>
      </div>
      {panel !== null ? (
        <section
          className="studio-workspace"
          aria-labelledby="studio-panel-title"
        >
          <div className="studio-workspace-heading">
            <button
              type="button"
              className="studio-tool"
              disabled={uploading || busy}
              onClick={() => setPanel(null)}
            >
              {t("backToCanvas")}
            </button>
            <h2
              id="studio-panel-title"
              tabIndex={-1}
              className="text-emphasis font-semibold"
            >
              {panelTitle}
              {(panel === "links" || panel === "section") &&
              selectedBlock?.type === "links" &&
              selectedBlock.title ? (
                <span className="ml-2 break-words text-small font-normal text-fg-muted">
                  · {selectedBlock.title}
                </span>
              ) : null}
            </h2>
            <p className="text-small text-fg-muted">
              {panel === "links" ? t("linksHint") : t("draftHint")}
            </p>
          </div>
          <div className="studio-workspace-layout">
            <div className="studio-workspace-body">
              <fieldset disabled={busy || uploading} className="min-w-0">
                {panel === "link-target" ? (
                  <div className="grid gap-2">
                    <p className="mb-3 text-small text-fg-muted">
                      {t("chooseLinkSectionHint")}
                    </p>
                    {content.blocks
                      .filter((block) => block.type === "links")
                      .map((block, index) =>
                        block.type === "links" ? (
                          <button
                            key={block.id}
                            type="button"
                            className="flex min-h-14 min-w-0 items-center justify-between gap-3 border-b border-line px-2 text-left text-small hover:bg-bg-subtle"
                            onClick={() => {
                              setSelected(block.id);
                              setAddingLinks(true);
                              setPanel("links");
                            }}
                          >
                            <span className="min-w-0 truncate">
                              {block.title ||
                                t("untitledSection", { number: index + 1 })}
                            </span>
                            <span className="shrink-0 text-meta text-fg-muted">
                              {t("linkTotal", { count: block.items.length })}
                            </span>
                          </button>
                        ) : null,
                      )}
                    <button
                      type="button"
                      className="studio-tool justify-self-start"
                      disabled={content.blocks.length >= 150}
                      onClick={() => add("links")}
                    >
                      <Plus aria-hidden />
                      {t("newLinkSection")}
                    </button>
                  </div>
                ) : null}
                {panel === "outline" ? (
                  <div className="grid gap-2">
                    {content.blocks.map((block, index) => (
                      <div
                        key={block.id}
                        className="flex items-center gap-2 border-b border-line py-2"
                      >
                        <button
                          type="button"
                          className="min-h-10 flex-1 text-left text-small"
                          onClick={() => open(block)}
                        >
                          {block.type === "links"
                            ? block.title ||
                              t("untitledSection", { number: index })
                            : t(`types.${block.type}`)}
                          {block.type === "links"
                            ? ` · ${block.items.length}`
                            : ""}
                          {!block.visible ? ` · ${t("hidden")}` : ""}
                        </button>
                        <button
                          type="button"
                          className="studio-tool"
                          disabled={index <= 1}
                          onClick={() => move(block.id, -1)}
                        >
                          {t("up")}
                        </button>
                        <button
                          type="button"
                          className="studio-tool"
                          disabled={
                            index === 0 || index === content.blocks.length - 1
                          }
                          onClick={() => move(block.id, 1)}
                        >
                          {t("down")}
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
                {panel === "settings" ? (
                  <>
                    <fieldset
                      disabled={busy}
                      className="flex flex-col gap-4 border-b border-line py-5"
                    >
                      <legend className="pt-5 font-medium">
                        {t("address")}
                      </legend>
                      {field(t("handle"), handle, setHandle)}
                      <button
                        type="button"
                        className="self-start text-small text-signal underline"
                        onClick={async () => {
                          try {
                            const result = await changeBioHandleAction(
                              workspace,
                              id,
                              handle,
                            );
                            setStatus(
                              result.ok ? "handleSaved" : "handleFailed",
                            );
                          } catch {
                            setStatus("handleFailed");
                          }
                        }}
                      >
                        {t("saveHandle")}
                      </button>
                    </fieldset>
                  </>
                ) : null}
                {panel === "section" &&
                selectedBlock?.type === "profile" &&
                profile?.type === "profile" ? (
                  <div className="grid gap-4 border-b border-line py-5">
                    <h2 className="font-medium">{t("types.profile")}</h2>
                    {field(t("title"), profile.title, (title) =>
                      update(profile.id, { title }),
                    )}
                    {field(
                      t("description"),
                      profile.description,
                      (description) => update(profile.id, { description }),
                    )}
                    {
                      <ImageUpload
                        label={t("avatar")}
                        purpose="avatar"
                        value={profile.avatar}
                        onChange={(avatar) => update(profile.id, { avatar })}
                        onBusyChange={onBusyChange}
                      />
                    }
                    <div className="flex flex-col gap-2">
                      <label
                        className={cn(
                          "text-small",
                          !paid &&
                            !profile.paidBadge &&
                            "cursor-not-allowed opacity-50",
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={profile.paidBadge ?? false}
                          disabled={!paid && !profile.paidBadge}
                          onChange={(e) =>
                            update(profile.id, { paidBadge: e.target.checked })
                          }
                        />{" "}
                        {t("paidBadge")}
                      </label>
                      {paid ? null : (
                        <PlanGate feature="bioBadge" plan={paidPlan} />
                      )}
                    </div>
                    {select(
                      t("avatarShape"),
                      profile.avatarShape,
                      ["circle", "rounded", "square"],
                      (avatarShape) => update(profile.id, { avatarShape }),
                    )}
                    {select(
                      t("align"),
                      profile.align,
                      ["left", "center", "right"],
                      (align) => update(profile.id, { align }),
                    )}
                  </div>
                ) : null}
                {panel === "section"
                  ? content.blocks
                      .filter(
                        (block) =>
                          block.id === selected && block.type !== "profile",
                      )
                      .map((block) => (
                        <div key={block.id} className="grid gap-4">
                          {block.type === "links" ? (
                            <>
                              <button
                                type="button"
                                className="studio-primary justify-self-start"
                                onClick={() => {
                                  setSelected(block.id);
                                  setAddingLinks(false);
                                  setPanel("links");
                                }}
                              >
                                <Pencil aria-hidden />
                                {t("manageCount", {
                                  count: block.items.length,
                                })}
                              </button>
                              {field(t("title"), block.title, (title) =>
                                update(block.id, { title }),
                              )}
                              <div className="grid gap-1">
                                <label className="text-small">
                                  <input
                                    type="checkbox"
                                    checked={block.order === "newest"}
                                    onChange={(e) =>
                                      update(block.id, {
                                        order: e.target.checked
                                          ? "newest"
                                          : "manual",
                                      })
                                    }
                                  />{" "}
                                  {t("newestFirst")}
                                </label>
                                <p className="text-small text-fg-muted">
                                  {t("newestFirstHint")}
                                </p>
                              </div>
                              {select(
                                t("cardStyle"),
                                block.cardStyle,
                                [
                                  "list",
                                  "small-grid",
                                  "large-grid",
                                  "image-grid",
                                ],
                                (cardStyle) => update(block.id, { cardStyle }),
                              )}
                              {block.cardStyle !== "list" ? (
                                <>
                                  {select(
                                    t("cardContent"),
                                    block.cardContent,
                                    ["image-text", "image-only", "text"],
                                    (cardContent) =>
                                      update(block.id, { cardContent }),
                                  )}
                                  {select(
                                    t("cardRadius"),
                                    block.cardRadius,
                                    ["theme", "square", "rounded"],
                                    (cardRadius) =>
                                      update(block.id, { cardRadius }),
                                  )}
                                  {block.cardContent !== "text"
                                    ? select(
                                        t("imageFit"),
                                        block.imageFit,
                                        ["cover", "contain"],
                                        (imageFit) =>
                                          update(block.id, { imageFit }),
                                      )
                                    : null}
                                  {block.cardContent === "image-only" ? (
                                    <p className="text-small text-fg-muted">
                                      {t("imageOnlyHint")}
                                    </p>
                                  ) : null}
                                </>
                              ) : null}
                              <details className="border-b border-line pb-4">
                                <summary className="cursor-pointer py-2 text-small font-medium">
                                  {t("linkStyling")}
                                </summary>
                                <div className="grid gap-4 pt-3">
                                  {select(
                                    t("linkSurface"),
                                    block.linkSurface ?? "theme",
                                    [
                                      "theme",
                                      "minimal",
                                      "soft",
                                      "filled",
                                      "outline",
                                    ],
                                    (linkSurface) =>
                                      update(block.id, { linkSurface }),
                                  )}
                                  {select(
                                    t("linkBorder"),
                                    block.linkBorder ?? "theme",
                                    [
                                      "theme",
                                      "none",
                                      "subtle",
                                      "solid",
                                      "divider",
                                    ],
                                    (linkBorder) =>
                                      update(block.id, { linkBorder }),
                                  )}
                                  {select(
                                    t("linkWeight"),
                                    block.linkWeight ?? "theme",
                                    ["theme", "regular", "medium", "bold"],
                                    (linkWeight) =>
                                      update(block.id, { linkWeight }),
                                  )}
                                  {select(
                                    t("linkSpacing"),
                                    block.linkSpacing ?? "comfortable",
                                    ["compact", "comfortable", "spacious"],
                                    (linkSpacing) =>
                                      update(block.id, { linkSpacing }),
                                  )}
                                  <label className="text-small">
                                    <input
                                      type="checkbox"
                                      checked={block.showLinkArrow ?? true}
                                      onChange={(e) =>
                                        update(block.id, {
                                          showLinkArrow: e.target.checked,
                                        })
                                      }
                                    />{" "}
                                    {t("showLinkArrow")}
                                  </label>
                                </div>
                              </details>
                              {select(
                                t("linkLayout"),
                                block.layout,
                                ["vertical", "paginated"],
                                (layout) => update(block.id, { layout }),
                              )}
                              {block.layout === "paginated"
                                ? select(
                                    t("pageSize"),
                                    String(block.pageSize ?? 10),
                                    ["4", "6", "10", "20", "50"],
                                    (value) =>
                                      update(block.id, {
                                        pageSize: Number(value),
                                      }),
                                  )
                                : null}
                              {block.layout === "paginated" ? (
                                <>
                                  {select(
                                    t("paginationStyle"),
                                    block.paginationStyle,
                                    ["arrows", "labels"],
                                    (paginationStyle) =>
                                      update(block.id, { paginationStyle }),
                                  )}
                                  {select(
                                    t("paginationAppearance"),
                                    block.paginationAppearance ?? "muted",
                                    ["muted", "minimal", "outline", "filled"],
                                    (paginationAppearance) =>
                                      update(block.id, {
                                        paginationAppearance,
                                      }),
                                  )}
                                  {select(
                                    t("paginationSize"),
                                    block.paginationSize ?? "small",
                                    ["small", "comfortable"],
                                    (paginationSize) =>
                                      update(block.id, { paginationSize }),
                                  )}
                                  <label className="text-small">
                                    <input
                                      type="checkbox"
                                      checked={block.showPageCount ?? true}
                                      onChange={(e) =>
                                        update(block.id, {
                                          showPageCount: e.target.checked,
                                        })
                                      }
                                    />{" "}
                                    {t("showPageCount")}
                                  </label>
                                </>
                              ) : null}
                              <label className="text-small">
                                <input
                                  type="checkbox"
                                  checked={block.showLinkCount ?? false}
                                  onChange={(e) =>
                                    update(block.id, {
                                      showLinkCount: e.target.checked,
                                    })
                                  }
                                />{" "}
                                {t("showLinkCount")}
                              </label>
                            </>
                          ) : null}
                          {block.type === "link" || block.type === "qr" ? (
                            <>
                              <button
                                type="button"
                                className="studio-tool justify-self-start"
                                onClick={() => setPanel("links")}
                              >
                                {t("existingLink")}:{" "}
                                {links[block.linkId]?.title ?? t("noLinks")}
                              </button>
                              {field(t("title"), block.title, (title) =>
                                update(block.id, { title }),
                              )}
                              {block.type === "link" ? (
                                <>
                                  <ImageUpload
                                    label={t("image")}
                                    value={block.image}
                                    onChange={(image) =>
                                      update(block.id, { image })
                                    }
                                    onBusyChange={onBusyChange}
                                  />
                                  <label className="text-small">
                                    <input
                                      type="checkbox"
                                      checked={block.highlight}
                                      onChange={(e) =>
                                        update(block.id, {
                                          highlight: e.target.checked,
                                        })
                                      }
                                    />{" "}
                                    {t("highlight")}
                                  </label>
                                </>
                              ) : null}
                            </>
                          ) : null}
                          {block.type === "header" || block.type === "text" ? (
                            <label className="flex flex-col gap-1 text-small">
                              {t("text")}
                              <textarea
                                className="min-h-24 rounded-control border border-line-strong bg-bg p-3"
                                value={block.text}
                                onChange={(e) =>
                                  update(block.id, { text: e.target.value })
                                }
                              />
                            </label>
                          ) : null}
                          {block.type === "image" || block.type === "embed" ? (
                            <>
                              {block.type === "image" ? (
                                <ImageUpload
                                  label={t("types.image")}
                                  value={block.url}
                                  onChange={(url) => update(block.id, { url })}
                                  onBusyChange={onBusyChange}
                                />
                              ) : (
                                field(t("url"), block.url, (url) =>
                                  update(block.id, { url }),
                                )
                              )}
                              {block.type === "image" ? (
                                <>
                                  {field(t("alt"), block.alt, (alt) =>
                                    update(block.id, { alt }),
                                  )}
                                  {field(
                                    t("optionalLink"),
                                    block.link ?? "",
                                    (link) =>
                                      update(block.id, {
                                        link: link || undefined,
                                      }),
                                  )}
                                </>
                              ) : (
                                select(
                                  t("provider"),
                                  block.provider,
                                  [
                                    "youtube",
                                    "spotify",
                                    "soundcloud",
                                    "vimeo",
                                    "apple-music",
                                  ],
                                  (provider) => update(block.id, { provider }),
                                )
                              )}
                            </>
                          ) : null}
                          {block.type === "socials" ? (
                            <>
                              {block.items.map((item, at) => (
                                <div
                                  key={at}
                                  className="grid gap-2 sm:grid-cols-2"
                                >
                                  {field(
                                    t("platform"),
                                    item.platform,
                                    (platform) =>
                                      update(block.id, {
                                        items: block.items.map((v, i) =>
                                          i === at ? { ...v, platform } : v,
                                        ),
                                      }),
                                  )}
                                  {field(t("url"), item.url, (url) =>
                                    update(block.id, {
                                      items: block.items.map((v, i) =>
                                        i === at ? { ...v, url } : v,
                                      ),
                                    }),
                                  )}
                                  <button
                                    type="button"
                                    className="text-small text-danger"
                                    onClick={() =>
                                      update(block.id, {
                                        items: block.items.filter(
                                          (_, i) => i !== at,
                                        ),
                                      })
                                    }
                                  >
                                    {t("remove")}
                                  </button>
                                </div>
                              ))}
                              <button
                                type="button"
                                className="text-left text-small text-signal"
                                onClick={() =>
                                  update(block.id, {
                                    items: [
                                      ...block.items,
                                      { platform: "website", url: "" },
                                    ],
                                  })
                                }
                              >
                                {t("addSocial")}
                              </button>
                            </>
                          ) : null}
                          <label className="text-small">
                            <input
                              type="checkbox"
                              checked={block.visible}
                              onChange={(e) =>
                                update(block.id, { visible: e.target.checked })
                              }
                            />{" "}
                            {t("visible")}
                          </label>
                          <div className="flex flex-col gap-2">
                            <div className="grid gap-3 sm:grid-cols-2">
                              {field(
                                t("from"),
                                block.schedule?.from?.slice(0, 16) ?? "",
                                (value) =>
                                  update(block.id, {
                                    schedule: {
                                      ...block.schedule,
                                      from: value
                                        ? `${value}:00.000Z`
                                        : undefined,
                                    },
                                  }),
                                "datetime-local",
                                !paid && !block.schedule?.from,
                              )}
                              {field(
                                t("to"),
                                block.schedule?.to?.slice(0, 16) ?? "",
                                (value) =>
                                  update(block.id, {
                                    schedule: {
                                      ...block.schedule,
                                      to: value
                                        ? `${value}:00.000Z`
                                        : undefined,
                                    },
                                  }),
                                "datetime-local",
                                !paid && !block.schedule?.to,
                              )}
                            </div>
                            {paid ? null : (
                              <PlanGate feature="bioSchedule" plan={paidPlan} />
                            )}
                          </div>
                          <div className="flex flex-wrap gap-5 text-small">
                            <button
                              type="button"
                              disabled={content.blocks[1]?.id === block.id}
                              onClick={() => move(block.id, -1)}
                            >
                              {t("up")}
                            </button>
                            <button
                              type="button"
                              disabled={content.blocks.at(-1)?.id === block.id}
                              onClick={() => move(block.id, 1)}
                            >
                              {t("down")}
                            </button>
                            <button
                              type="button"
                              className="text-danger"
                              onClick={() => {
                                setContent((c) => ({
                                  ...c,
                                  blocks: c.blocks.filter(
                                    (b) => b.id !== block.id,
                                  ),
                                }));
                                setPanel(null);
                              }}
                            >
                              {t("remove")}
                            </button>
                          </div>
                        </div>
                      ))
                  : null}
                {panel === "links" && selectedBlock?.type === "links" ? (
                  <>
                    <button
                      type="button"
                      className="mb-5 min-h-10 text-small text-signal"
                      onClick={() => setPanel("section")}
                    >
                      {t("backToSection")}
                    </button>
                    <LinkManager
                      key={`${selectedBlock.id}:${addingLinks}`}
                      workspace={workspace}
                      bioId={id}
                      items={selectedBlock.items}
                      links={links}
                      onChange={(items) => update(selectedBlock.id, { items })}
                      onResolve={(id, link) =>
                        setLinks((current) => ({ ...current, [id]: link }))
                      }
                      onBusyChange={onBusyChange}
                      uploading={uploading}
                      startWithLibrary={addingLinks}
                      newest={selectedBlock.order === "newest"}
                      onNewestChange={(newest) =>
                        update(selectedBlock.id, {
                          order: newest ? "newest" : "manual",
                        })
                      }
                    />
                  </>
                ) : null}
                {panel === "links" && selectedBlock?.type === "qr" ? (
                  <LinkManager
                    key={selectedBlock.id}
                    workspace={workspace}
                    bioId={id}
                    items={[]}
                    links={links}
                    chooseOnly
                    onChange={(items) => {
                      if (items[0]) {
                        update(selectedBlock.id, { linkId: items[0].linkId });
                        setPanel("section");
                      }
                    }}
                    onResolve={(id, link) =>
                      setLinks((current) => ({ ...current, [id]: link }))
                    }
                    onBusyChange={onBusyChange}
                    uploading={uploading}
                  />
                ) : null}
                {panel === "add" ? (
                  <div className="grid gap-2">
                    {(
                      [
                        "links",
                        "header",
                        "text",
                        "image",
                        "socials",
                        "embed",
                        "qr",
                      ] as const
                    ).map((type) => (
                      <button
                        type="button"
                        className="flex min-h-14 items-center justify-between border-b border-line px-2 text-left text-small"
                        key={type}
                        disabled={
                          content.blocks.length >= 150 ||
                          (type === "qr" && !Object.keys(links).length)
                        }
                        onClick={() => add(type)}
                      >
                        {t(`types.${type}`)}
                        <Plus aria-hidden className="size-4" />
                      </button>
                    ))}
                  </div>
                ) : null}
                {panel === "theme" ? (
                  <>
                    <fieldset className="grid gap-4 border-b border-line py-5">
                      <legend className="pt-5 font-medium">{t("theme")}</legend>
                      {select(
                        t("preset"),
                        selectedPreset,
                        ["", ...Object.keys(bioPresets)],
                        (name) => {
                          if (bioPresets[name])
                            setContent((c) => ({
                              ...c,
                              theme: bioPresets[name]!,
                            }));
                        },
                      )}
                      <div className="grid gap-4 sm:grid-cols-2">
                        {(
                          ["background", "surface", "text", "accent"] as const
                        ).map((token) => (
                          <div key={token}>
                            {field(
                              t(`colors.${token}`),
                              content.theme[token],
                              (value) =>
                                setContent((c) => ({
                                  ...c,
                                  theme: { ...c.theme, [token]: value },
                                })),
                              "color",
                            )}
                          </div>
                        ))}
                      </div>
                      {bioContrast(
                        content.theme.text,
                        content.theme.background,
                      ) < 4.5 ? (
                        <p className="text-small">
                          {t("contrast")}{" "}
                          <button
                            type="button"
                            className="text-signal underline"
                            onClick={() =>
                              setContent((c) => ({
                                ...c,
                                theme: {
                                  ...c.theme,
                                  text: readableBioColor(
                                    c.theme.text,
                                    c.theme.background,
                                  ),
                                },
                              }))
                            }
                          >
                            {t("fixContrast")}
                          </button>
                        </p>
                      ) : null}
                      {content.theme.legacyFont ? (
                        <p className="text-small text-fg-muted">
                          {t("legacyFont", { font: content.theme.legacyFont })}
                        </p>
                      ) : null}
                      {select(
                        t("font"),
                        content.theme.font,
                        [...bioFonts],
                        (font) =>
                          setContent((c) => ({
                            ...c,
                            theme: {
                              ...c.theme,
                              font: font as BioContent["theme"]["font"],
                              legacyFont: undefined,
                            },
                          })),
                      )}
                      {select(
                        t("buttonStyle"),
                        content.theme.buttonStyle,
                        ["fill", "outline", "soft", "shadow-less"],
                        (buttonStyle) =>
                          setContent((c) => ({
                            ...c,
                            theme: {
                              ...c.theme,
                              buttonStyle:
                                buttonStyle as BioContent["theme"]["buttonStyle"],
                            },
                          })),
                      )}
                      {select(
                        t("radius"),
                        String(content.theme.radius),
                        ["0", "6", "12", "999"],
                        (radius) =>
                          setContent((c) => ({
                            ...c,
                            theme: {
                              ...c.theme,
                              radius: Number(radius) as 0 | 6 | 12 | 999,
                            },
                          })),
                      )}
                      {select(
                        t("density"),
                        content.theme.density,
                        ["comfortable", "compact"],
                        (density) =>
                          setContent((c) => ({
                            ...c,
                            theme: {
                              ...c.theme,
                              density: density as "comfortable" | "compact",
                            },
                          })),
                      )}
                      <ImageUpload
                        label={t("cover")}
                        value={content.theme.backgroundImage ?? ""}
                        onChange={(backgroundImage) =>
                          setContent((c) => ({
                            ...c,
                            theme: {
                              ...c.theme,
                              backgroundImage: backgroundImage || undefined,
                            },
                          }))
                        }
                        onBusyChange={onBusyChange}
                      />
                      <div className="flex flex-col gap-2">
                        <label
                          className={cn(
                            "text-small",
                            !paid &&
                              !content.hideBranding &&
                              "cursor-not-allowed opacity-50",
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={content.hideBranding}
                            disabled={!paid && !content.hideBranding}
                            onChange={(e) =>
                              setContent((c) => ({
                                ...c,
                                hideBranding: e.target.checked,
                              }))
                            }
                          />{" "}
                          {t("hideBranding")}
                        </label>
                        {paid ? null : (
                          <PlanGate feature="bioBranding" plan={paidPlan} />
                        )}
                      </div>
                    </fieldset>
                  </>
                ) : null}
                {panel === "settings" ? (
                  <fieldset className="grid gap-4 border-b border-line py-5">
                    <legend className="pt-5 font-medium">{t("seo")}</legend>
                    <ImageUpload
                      label={t("favicon")}
                      value={content.seo.favicon ?? ""}
                      onChange={(favicon) =>
                        setContent((c) => ({
                          ...c,
                          seo: { ...c.seo, favicon: favicon || undefined },
                        }))
                      }
                      onBusyChange={onBusyChange}
                    />
                    {select(
                      t("language"),
                      content.locale,
                      ["en", "pt", "es"],
                      (locale) =>
                        setContent((c) => ({
                          ...c,
                          locale: locale as "en" | "pt" | "es",
                        })),
                    )}
                    {field(t("title"), content.seo.title, (title) =>
                      setContent((c) => ({ ...c, seo: { ...c.seo, title } })),
                    )}
                    {field(
                      t("description"),
                      content.seo.description,
                      (description) =>
                        setContent((c) => ({
                          ...c,
                          seo: { ...c.seo, description },
                        })),
                    )}
                    <label className="text-small">
                      <input
                        type="checkbox"
                        checked={content.seo.noindex}
                        onChange={(e) =>
                          setContent((c) => ({
                            ...c,
                            seo: { ...c.seo, noindex: e.target.checked },
                          }))
                        }
                      />{" "}
                      {t("noindex")}
                    </label>
                  </fieldset>
                ) : null}
                {panel === "history" ? (
                  <section className="py-5">
                    <h2 className="mb-3 font-medium">{t("versions")}</h2>
                    {history.map((version) => (
                      <button
                        type="button"
                        className="block py-2 text-small text-signal underline"
                        key={version.revision}
                        disabled={busy}
                        onClick={async () => {
                          setBusy(true);
                          try {
                            if (!(await save())) return;
                            const result = await restoreBioContentAction(
                              workspace,
                              id,
                              revision.current,
                              version.revision,
                            );
                            if (result.ok && result.draft) {
                              revision.current = result.draft.revision;
                              saved.current = JSON.stringify(
                                result.draft.content,
                              );
                              setContent(groupBioLinks(result.draft.content));
                              setLinks((current) => ({
                                ...current,
                                ...result.links,
                              }));
                              setStatus("restored");
                            } else setStatus("saveFailed");
                          } catch {
                            setStatus("saveFailed");
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        {t("restore", { version: version.revision })}
                      </button>
                    ))}
                    {!history.length ? (
                      <p className="text-small text-fg-muted">
                        {t("noVersions")}
                      </p>
                    ) : null}
                  </section>
                ) : null}
              </fieldset>
            </div>
            <aside
              className="studio-settings-preview"
              aria-label={previewText("label")}
            >
              <h2 className="mb-3 text-small font-medium">
                {previewText("label")}
              </h2>
              <div className="studio-settings-preview-scroll">
                <div
                  className="studio-preview"
                  style={{ width: desktop ? 760 : 390 }}
                >
                  <BioRenderer
                    content={content}
                    links={previewLinks}
                    preview
                    labels={previewLabels}
                  />
                </div>
              </div>
            </aside>
          </div>
        </section>
      ) : null}
    </div>
  );
}
