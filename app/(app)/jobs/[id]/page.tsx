import { notFound } from "next/navigation";
import { Download, RotateCcw } from "lucide-react";
import { JobAutoRefresh } from "@/components/app/job-auto-refresh";
import { ProcessingExperience } from "@/components/app/processing-experience";
import { StatusBadge } from "@/components/app/status-badge";
import { VideoPreview } from "@/components/app/video-preview";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { modeLabels } from "@/lib/jobs";
import { getAppJob } from "@/lib/supabase/data";

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await getAppJob(id);
  if (!job) notFound();

  return (
    <div className="mx-auto max-w-5xl">
      <JobAutoRefresh status={job.status} />
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm font-black uppercase text-mint">{modeLabels[job.mode]}</p>
          <h1 className="mt-3 text-4xl font-black">{job.title}</h1>
          <div className="mt-4">
            <StatusBadge status={job.status} />
          </div>
        </div>
        <div className="flex gap-3">
          <Button href={job.outputUrl ?? "#"} variant={job.status === "completed" ? "primary" : "secondary"}>
            <Download className="mr-2 h-4 w-4" />
            Download
          </Button>
          <Button href="/create" variant="secondary">
            <RotateCcw className="mr-2 h-4 w-4" />
            Recreate
          </Button>
        </div>
      </div>

      <section className="grid gap-5 lg:grid-cols-[0.7fr_1.3fr]">
        <div className="grid gap-5">
          <ProcessingExperience createdAt={job.createdAt} progress={job.progress} status={job.status} />
          <Card>
            <h2 className="text-xl font-black">Render progress</h2>
            <div className="mt-5 h-3 overflow-hidden rounded bg-pearl/10">
              <div
                className={job.status === "completed" || job.status === "failed" ? "h-3 rounded bg-mint transition-all duration-700" : "render-pulse-bar h-3 rounded bg-mint transition-all duration-700"}
                style={{ width: `${job.progress}%` }}
              />
            </div>
            <p className="mt-4 text-sm text-pearl/64">{job.progress}% complete</p>
            {job.error ? (
              <div className="mt-5 rounded-lg border border-coral/30 bg-coral/10 p-4 text-sm leading-6 text-pearl/78">
                <p className="font-black text-coral">Processing did not start</p>
                <p className="mt-2">{job.error}</p>
              </div>
            ) : null}
            <dl className="mt-6 grid gap-4 text-sm">
              <div>
                <dt className="text-pearl/44">Style</dt>
                <dd className="font-bold">{job.style}</dd>
              </div>
              <div>
                <dt className="text-pearl/44">Voice</dt>
                <dd className="font-bold">{job.voice}</dd>
              </div>
              <div>
                <dt className="text-pearl/44">Credits</dt>
                <dd className="font-bold">{job.credits}</dd>
              </div>
            </dl>
          </Card>
        </div>
        <div className="rounded-lg border border-pearl/10 bg-pearl/[0.06] p-5">
          <div className="phone-frame mx-auto max-w-[300px]">
            <VideoPreview outputUrl={job.status === "completed" ? job.outputUrl : undefined} />
          </div>
        </div>
      </section>
    </div>
  );
}
