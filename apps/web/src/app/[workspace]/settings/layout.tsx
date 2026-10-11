import { SettingsNav } from "@/components/settings/settings-nav";

// The sub-nav stays put; every settings page brings its own breadcrumb
// header (Settings / Members / Invite).
export default async function SettingsLayout({
  children,
  params,
}: LayoutProps<"/[workspace]/settings">) {
  const { workspace } = await params;
  return (
    <div className="flex flex-1 max-md:flex-col">
      <SettingsNav slug={workspace} />
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
