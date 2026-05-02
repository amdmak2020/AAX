import { notFound } from "next/navigation";
import { BoostJobAutoRefresh } from "@/components/app/boost-job-auto-refresh";
import { LocalTimezoneHiddenInput } from "@/components/app/local-timezone-hidden-input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BoostStatusBadge } from "@/components/app/boost-status-badge";
import { JobStatusTimeline } from "@/components/app/job-status-timeline";
import { VideoPreviewCard } from "@/components/app/video-preview-card";
import { CsrfHiddenInput } from "@/components/security/csrf-hidden-input";
import { IdempotencyHiddenInput } from "@/components/security/idempotency-hidden-input";
import { getBoostJobForViewer, getViewerWorkspace } from "@/lib/app-data";
import { formatDate } from "@/lib/utils";

const publishNoticeLabels: Record<string, string> = {
  publish_success: "Your boosted clip was posted to YouTube.",
  publish_scheduled: "Your boosted clip was scheduled on YouTube.",
  youtube_not_connected: "Connect your YouTube account first, then post the clip.",
  publish_invalid: "Check the metadata and try posting again.",
  publish_duplicate: "That post request already went through. Refresh the page first.",
  publish_rate_limited: "You posted a lot in a short window. Give it a minute and try again.",
  publish_schedule_invalid: "Pick a schedule time at least a few minutes in the future.",
  publish_missing_output: "That clip is not ready to publish yet.",
  publish_failed: "YouTube did not accept that post. Adjust the details and try again.",
  youtube_config_missing: "YouTube publishing is not configured yet."
};

export default async function AppJobDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const [job, workspace, resolvedSearchParams] = await Promise.all([
    getBoostJobForViewer(id),
    getViewerWorkspace(),
    searchParams ? searchParams : Promise.resolve(undefined)
  ]);
  if (!job) notFound();
  const publishNoticeKey = resolvedSearchParams ? (Array.isArray(resolvedSearchParams.notice) ? resolvedSearchParams.notice[0] : resolvedSearchParams.notice) : null;
  const publishNotice = publishNoticeKey ? publishNoticeLabels[publishNoticeKey] ?? null : null;
  const youtubeConnected = workspace?.youtube?.connected ?? false;

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

      {publishNotice ? <div className="mb-5 rounded-lg border border-mint/25 bg-mint/10 px-4 py-3 text-sm text-pearl/88">{publishNotice}</div> : null}

      <section className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <h2 className="text-xl font-black">Boosted preview</h2>
          <div className="mt-5">
            <VideoPreviewCard jobId={job.id} posterUrl={job.outputPosterUrl} status={job.status} title={job.projectName} videoUrl={job.outputVideoUrl} />
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

      {job.status === "completed" ? (
        <Card className="mt-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-black uppercase text-mint">YouTube publishing</p>
              <h2 className="mt-2 text-2xl font-black">Post or schedule this clip</h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-pearl/62">
                Add the metadata here, then either post right away or schedule it for later. We handle the upload from your connected YouTube account.
              </p>
            </div>
            {!youtubeConnected ? <Button href={`/api/youtube/connect?next=${encodeURIComponent(`/app/jobs/${job.id}`)}`}>Connect YouTube</Button> : null}
          </div>

          {youtubeConnected ? (
            <form action="/api/youtube/publish" className="mt-6 grid gap-4" method="post">
              <CsrfHiddenInput />
              <IdempotencyHiddenInput />
              <LocalTimezoneHiddenInput />
              <input name="jobId" type="hidden" value={job.id} />

              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-sm font-black">Video title</span>
                  <input
                    className="rounded-lg border border-pearl/10 bg-ink px-4 py-3"
                    defaultValue={job.projectName}
                    maxLength={100}
                    name="title"
                    placeholder="Title for YouTube"
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-black">Tags</span>
                  <input
                    className="rounded-lg border border-pearl/10 bg-ink px-4 py-3"
                    maxLength={500}
                    name="tags"
                    placeholder="shorts, creator tips, hooks"
                  />
                </label>
              </div>

              <label className="grid gap-2">
                <span className="text-sm font-black">Description</span>
                <textarea
                  className="min-h-32 rounded-lg border border-pearl/10 bg-ink px-4 py-3"
                  defaultValue={`Created with AutoAgentX.\n\n${job.projectName}`}
                  maxLength={5000}
                  name="description"
                  placeholder="Description for YouTube"
                />
              </label>

              <div className="grid gap-4 md:grid-cols-3">
                <label className="grid gap-2">
                  <span className="text-sm font-black">Post mode</span>
                  <select className="rounded-lg border border-pearl/10 bg-ink px-4 py-3" defaultValue="now" name="publishMode">
                    <option value="now">Post now</option>
                    <option value="schedule">Schedule for later</option>
                  </select>
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-black">Privacy</span>
                  <select className="rounded-lg border border-pearl/10 bg-ink px-4 py-3" defaultValue="unlisted" name="privacyStatus">
                    <option value="private">Private</option>
                    <option value="unlisted">Unlisted</option>
                    <option value="public">Public</option>
                  </select>
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-black">Schedule time</span>
                  <input className="rounded-lg border border-pearl/10 bg-ink px-4 py-3" name="scheduleAt" type="datetime-local" />
                </label>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button type="submit">Post to YouTube</Button>
                <p className="self-center text-sm text-pearl/56">If you choose a schedule time, the clip will stay private until YouTube publishes it.</p>
              </div>
            </form>
          ) : (
            <div className="mt-6 rounded-lg border border-pearl/10 bg-ink px-4 py-4 text-sm leading-6 text-pearl/66">
              Connect YouTube first, then this card becomes your one-stop post and schedule flow.
            </div>
          )}
        </Card>
      ) : null}
    </div>
  );
}
