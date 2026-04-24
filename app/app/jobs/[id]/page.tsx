import { notFound } from "next/navigation";
import { BoostJobAutoRefresh } from "@/components/app/boost-job-auto-refresh";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BoostStatusBadge } from "@/components/app/boost-status-badge";
import { JobStatusTimeline } from "@/components/app/job-status-timeline";
import { VideoPreviewCard } from "@/components/app/video-preview-card";
import { getBoostJobForViewer } from "@/lib/app-data";
import { boostPresets, targetPlatforms } from "@/lib/app-config";
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

      <section className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="grid gap-5">
          <Card>
            <h2 className="text-xl font-black">Job details</h2>
            <dl className="mt-5 grid gap-4 text-sm">
              <div>
                <dt className="text-pearl/44">Preset</dt>
                <dd className="font-bold">{boostPresets.find((preset) => preset.key === job.preset)?.name ?? job.preset}</dd>
              </div>
              <div>
                <dt className="text-pearl/44">Target platform</dt>
                <dd className="font-bold">{targetPlatforms.find((platform) => platform.key === job.targetPlatform)?.name ?? job.targetPlatform}</dd>
              </div>
              <div>
                <dt className="text-pearl/44">Source clip</dt>
                <dd className="break-all font-bold">{job.sourceFileName ?? job.sourceVideoUrl}</dd>
              </div>
              {job.description ? (
                <div>
                  <dt className="text-pearl/44">Clip description</dt>
                  <dd className="leading-6 text-pearl/70">{job.description}</dd>
                </div>
              ) : null}
            </dl>
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
        </div>

        <Card>
          <h2 className="text-xl font-black">Boosted preview</h2>
          <div className="mt-5">
            <VideoPreviewCard posterUrl={job.outputPosterUrl} title={job.projectName} videoUrl={job.outputVideoUrl} />
          </div>
        </Card>
      </section>
    </div>
  );
}
