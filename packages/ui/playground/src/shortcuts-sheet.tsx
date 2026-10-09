import {
  KeyboardHint,
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  type KeyboardHintProps,
} from "@shortn/ui";
import { usePlayground } from "./app-context";

interface ShortcutRow {
  label: string;
  keys: KeyboardHintProps["keys"];
  sequence?: boolean;
}

export function ShortcutsSheet() {
  const { copy, shortcutsOpen, setShortcutsOpen } = usePlayground();
  const s = copy.shortcuts;
  const groups: Array<{ title: string; rows: ShortcutRow[] }> = [
    {
      title: s.general,
      rows: [
        { label: s.palette, keys: ["mod", "k"] },
        { label: s.create, keys: "c" },
        { label: s.paste, keys: ["mod", "v"] },
        { label: s.search, keys: "/" },
        { label: s.help, keys: "?" },
        { label: s.goLinks, keys: ["g", "l"], sequence: true },
        { label: s.goAnalytics, keys: ["g", "a"], sequence: true },
        { label: s.goQr, keys: ["g", "q"], sequence: true },
        { label: s.goBio, keys: ["g", "b"], sequence: true },
      ],
    },
    {
      title: s.table,
      rows: [
        { label: s.down, keys: "j" },
        { label: s.up, keys: "k" },
        { label: s.open, keys: "enter" },
        { label: s.edit, keys: "e" },
        { label: s.select, keys: "x" },
        { label: s.range, keys: ["shift", "x"] },
        { label: s.selectAll, keys: ["mod", "a"] },
        { label: s.copy, keys: ["mod", "c"] },
        { label: s.clear, keys: "esc" },
      ],
    },
  ];

  return (
    <Sheet open={shortcutsOpen} onOpenChange={setShortcutsOpen}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{s.title}</SheetTitle>
          <SheetDescription>{s.description}</SheetDescription>
        </SheetHeader>
        <SheetBody className="flex flex-col gap-7">
          {groups.map((group) => (
            <section key={group.title}>
              <h3 className="mb-1 text-meta font-medium text-fg-subtle">
                {group.title}
              </h3>
              <dl>
                {group.rows.map((row) => (
                  <div
                    key={row.label}
                    className="flex items-center justify-between gap-4 border-b border-line py-2.5 last:border-b-0"
                  >
                    <dt className="text-small">{row.label}</dt>
                    <dd>
                      <KeyboardHint
                        keys={row.keys}
                        {...(row.sequence ? { sequence: true } : {})}
                      />
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}
