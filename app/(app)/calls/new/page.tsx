import type { Metadata } from "next";
import { pageAccess } from "@/lib/auth/page-guard";
import { PageHeader } from "@/components/ui/layout";
import CallWorkflow from "./CallWorkflow";

export const metadata: Metadata = { title: "Start call" };

export default async function NewCallPage({
  searchParams,
}: {
  searchParams: Promise<{ phone?: string; followUpId?: string }>;
}) {
  await pageAccess();
  const params = await searchParams;

  return (
    <>
      <PageHeader
        title="Start call"
        subtitle="Look the number up before dialling so ownership and history are clear."
        breadcrumbs={[{ label: "Calls", href: "/calls" }, { label: "Start call" }]}
      />

      <div className="card" style={{ maxWidth: 640 }}>
        <div className="card-body">
          <CallWorkflow initialPhone={params.phone} initialFollowUpId={params.followUpId} />
        </div>
      </div>
    </>
  );
}
