import { PageBody, PageHeader } from "@/components/page";

export default function OverviewPage() {
  return (
    <>
      <PageHeader title="Overview" />
      <PageBody>
        <p className="text-small text-fg-muted">
          Platform rollups appear here once the platform-metrics job has run.
        </p>
      </PageBody>
    </>
  );
}
