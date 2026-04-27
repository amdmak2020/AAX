import { AlertTriangle, Sparkles } from "lucide-react";
import { FileUploadDropzone } from "@/components/app/file-upload-dropzone";
import { CsrfHiddenInput } from "@/components/security/csrf-hidden-input";
import { IdempotencyHiddenInput } from "@/components/security/idempotency-hidden-input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { planCatalog, sourceUploadMaxMb } from "@/lib/app-config";
import { getViewerWorkspace } from "@/lib/app-data";
import { bypassUsageLimits } from "@/lib/env";

const createMessages = {
  missing_source: {
    title: "Add a clip or paste a link",
    body: "Drop in a file or paste a YouTube / X URL, then try again.",
    tone: "border-coral/20 bg-coral/10",
    ctaHref: null,
    ctaLabel: null
  },
  unsupported_source: {
    title: "That link is not supported yet",
    body: "Right now we can work with YouTube and X / Twitter links.",
    tone: "border-coral/20 bg-coral/10",
    ctaHref: null,
    ctaLabel: null
  },
  missing_description: {
    title: "Add a quick description",
    body: "Give the edit a little context so the result knows what to emphasize.",
    tone: "border-coral/20 bg-coral/10",
    ctaHref: null,
    ctaLabel: null
  },
  file_too_large: {
    title: "That file is too large for this plan",
    body: "Try a smaller clip, or upgrade if you want more room.",
    tone: "border-lemon/20 bg-lemon/10",
    ctaHref: "/app/billing",
    ctaLabel: "See plans"
  },
  no_credits: {
    title: "You have no boosts left",
    body: "You used the boosts on your current plan. Upgrade to keep going.",
    tone: "border-lemon/20 bg-lemon/10",
    ctaHref: "/app/billing",
    ctaLabel: "Upgrade now"
  },
  usage_update_failed: {
    title: "We couldn't save that submission",
    body: "The clip did not go through. Give it one more try.",
    tone: "border-coral/20 bg-coral/10",
    ctaHref: null,
    ctaLabel: null
  },
  processor_unavailable: {
    title: "The editor is taking a breather",
    body: "The clip did not start processing. Give it another shot in a moment.",
    tone: "border-coral/20 bg-coral/10",
    ctaHref: null,
    ctaLabel: null
  },
  generic: {
    title: "That one didn't go through",
    body: "Nothing was lost, but the boost did not start. Try again once more.",
    tone: "border-coral/20 bg-coral/10",
    ctaHref: null,
    ctaLabel: null
  },
  duplicate_submission: {
    title: "That clip was already submitted",
    body: "This protects your credits from getting spent twice if a button gets clicked again. Refresh and submit a new request if you still want another run.",
    tone: "border-lemon/20 bg-lemon/10",
    ctaHref: null,
    ctaLabel: null
  }
} as const;

export default async function CreateBoostJobPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const workspace = await getViewerWorkspace();
  if (!workspace) return null;
  const params = searchParams ? await searchParams : {};
  const errorCode = typeof params.error === "string" ? params.error : null;
  const activeMessage = errorCode ? createMessages[errorCode as keyof typeof createMessages] ?? createMessages.generic : null;

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

      {activeMessage ? (
        <div className={`mt-6 overflow-hidden rounded-lg border ${activeMessage.tone}`}>
          <div className="flex items-start gap-4 px-5 py-5">
            <div className="mt-0.5 rounded-lg bg-black/20 p-2 text-pearl">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-black uppercase tracking-[0.18em] text-pearl/72">Try again</p>
              <h2 className="mt-2 text-2xl font-black">{activeMessage.title}</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-pearl/74">{activeMessage.body}</p>
            </div>
            {activeMessage.ctaHref && activeMessage.ctaLabel ? (
              <Button href={activeMessage.ctaHref} variant="secondary">
                <Sparkles className="mr-2 h-4 w-4" />
                {activeMessage.ctaLabel}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      <form action="/api/boost-jobs" className="mt-8" method="post" encType="multipart/form-data">
        <CsrfHiddenInput />
        <IdempotencyHiddenInput />
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
