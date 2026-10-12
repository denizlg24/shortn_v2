# apps/web/src/components/settings/section.tsx

- SettingsPage · function · L12-L36 — function SettingsPage({ title, description, children, }: { title: ReactNode; description?: ReactNode; children: ReactNode; })
- SettingsSection · function · L38-L89 — function SettingsSection({ id, title, description, aside, tone = "default", wide = false, children, }: { /** Fragment target, e.g. `#plans`. */ id?: string; title: ReactNode; description?: ReactNode; /** Rendered at the end of the heading row, e.g. a section-level action. */ aside?: ReactNode; tone?: "default" | "danger"; /** Tables may use the full column; forms stay at 560px (12 §Settings). */ wide?: boolean; children?: ReactNode; })
- NoticeTone · type · L105-L105 — type NoticeTone = "neutral" | "success" | "warning" | "danger";
- Notice · function · L108-L138 — function Notice({ tone = "neutral", live, action, className, children, }: { tone?: NoticeTone; /** `status` for results the user just caused, `alert` for blocking problems. */ live?: "status" | "alert"; action?: ReactNode; className?: string; children: ReactNode; })
