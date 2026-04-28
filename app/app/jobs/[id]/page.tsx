import { notFound } from "next/navigation";
import { BoostJobAutoRefresh } from "@/components/app/boost-job-auto-refresh";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BoostStatusBadge } from "@/components/app/boost-status-badge";
import { JobStatusTimeline } from "@/components/app/job-status-timeline";
import { VideoPreviewCard } from "@/components/app/video-preview-card";
import { getBoostJobForViewer } from "@/lib/app-data";
import { formatDate } from "@/lib/utils";

export default async function AppJobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await getBoostJobForViewer(id);
  if (!job) notFound();

  return (
    <div className="mx-auto max-w-6xl">
      <BoostJobAutoRefresh status={job.status} />
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm font-black uppercase text-mint">Boost job</p>
          <h1 className="mt-3 text-4xl font-black">{job.projectName}</h1>
          <div className="mt-4 flex items-center gap-3">
            <BoostStatusBadge status={job.status} />
            <span className="text-sm text-pearl/48">{formatDate(job.createdAt)}</span>
          </div>
        </div>
        <div className="flex gap-3">
          {job.outputVideoUrl ? <Button href={job.outputVideoUrl}>Download boosted clip</Button> : null}
          <Button href="/app/create" variant="secondary">
            Boost another clip
          </Button>
        </div>
      </div>

      <section className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <h2 className="text-xl font-black">Boosted preview</h2>
          <div className="mt-5">
            <VideoPreviewCard posterUrl={job.outputPosterUrl} title={job.projectName} videoUrl={job.outputVideoUrl} />
          </div>
        </Card>

        <Card>
          <h2 className="text-xl font-black">Status timeline</h2>
          <div className="mt-5">
            <JobStatusTimeline status={job.status} />
          </div>
          {job.errorMessage ? (
            <div className="mt-5 rounded-lg border border-coral/30 bg-coral/10 p-4 text-sm leading-6 text-pearl/70">
              <p className="font-black text-coral">Something went wrong</p>
              <p className="mt-2">{job.errorMessage}</p>
            </div>
          ) : null}
        </Card>
      </section>
    </div>
  );
}
