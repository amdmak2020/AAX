import { FileUploadDropzone } from "@/components/app/file-upload-dropzone";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { planCatalog, sourceUploadMaxMb } from "@/lib/app-config";
import { getViewerWorkspace } from "@/lib/app-data";
import { bypassUsageLimits } from "@/lib/env";

export default async function CreateBoostJobPage() {
  const workspace = await getViewerWorkspace();
  if (!workspace) return null;

  const plan = planCatalog[workspace.subscription.plan_key];
  const uploadLimitMb = Math.min(plan.maxFileSizeMb, sourceUploadMaxMb);
  const usageBypassed = bypassUsageLimits();

  return (
    <div className="mx-auto max-w-5xl">
      <div className="max-w-2xl">
        <p className="text-sm font-black uppercase text-mint">Create boost</p>
        <h1 className="mt-3 text-4xl font-black md:text-5xl">Drop in a clip or paste a link.</h1>
        <p className="mt-4 leading-7 text-pearl/66">
          That&apos;s it. Upload a video under {uploadLimitMb}MB or paste a YouTube / X link, and we&apos;ll handle the rest.
        </p>
      </div>

      <form action="/api/boost-jobs" className="mt-8" method="post" encType="multipart/form-data">
        <Card className="relative overflow-hidden border-mint/20 bg-[radial-gradient(circle_at_top,rgba(61,239,176,0.14),transparent_40%),linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0))] p-8 md:p-10">
          <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-mint/50 to-transparent" />

          <div className="grid gap-6">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.18em] text-mint/78">Source</p>
              <h2 className="mt-3 text-2xl font-black md:text-3xl">Choose one input</h2>
            </div>

            <div>
              <span className="text-sm font-black">Upload a source clip</span>
              <div className="mt-2">
                <FileUploadDropzone maxFileSizeMb={uploadLimitMb} name="sourceFile" required={false} />
              </div>
            </div>

            <div className="text-center text-xs font-bold uppercase tracking-[0.28em] text-pearl/32">or paste a link</div>

            <label className="grid gap-2">
              <span className="text-sm font-black">YouTube or X URL</span>
              <input
                className="rounded-lg border border-pearl/10 bg-ink px-4 py-4 text-base outline-none transition focus:border-mint focus:shadow-[0_0_0_4px_rgba(61,239,176,0.14)]"
                name="sourceUrl"
                placeholder="https://youtube.com/... or https://x.com/..."
                type="url"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-black">Description</span>
              <textarea
                className="min-h-28 rounded-lg border border-pearl/10 bg-ink px-4 py-4 text-base outline-none transition focus:border-mint focus:shadow-[0_0_0_4px_rgba(61,239,176,0.14)]"
                name="description"
                placeholder="What is happening in this clip, and what should the edit emphasize?"
                required
              />
            </label>

            <div className="rounded-lg border border-pearl/10 bg-ink/60 px-4 py-3 text-sm leading-6 text-pearl/60">
              {usageBypassed ? (
                <>Dev mode is on, so limits are bypassed while we test. Uploads are capped at {uploadLimitMb}MB.</>
              ) : (
                <>Your current plan includes {plan.monthlyCredits} boosts per month. Uploads are capped at {uploadLimitMb}MB.</>
              )}
            </div>

            <Button className="min-h-14 w-full rounded-lg text-base shadow-[0_20px_60px_rgba(61,239,176,0.22)]" type="submit">
              Make this clip more engaging
            </Button>
          </div>
        </Card>
      </form>
    </div>
  );
}
