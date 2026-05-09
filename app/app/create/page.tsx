import crypto from "node:crypto";
import { AlertTriangle, Sparkles } from "lucide-react";
import { CreateBoostJobForm } from "@/components/app/create-boost-job-form";
import { Button } from "@/components/ui/button";
import { planCatalog, sourceUploadMaxMb } from "@/lib/app-config";
import { getViewerWorkspace } from "@/lib/app-data";
import { getCsrfTokenForRender } from "@/lib/csrf";
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
  const defaultSourceUrl = typeof params.sourceUrl === "string" ? params.sourceUrl : "";
  const defaultDescription = typeof params.description === "string" ? params.description : "";
  const uploadIntent = typeof params.intent === "string" ? params.intent : null;
  const uploadFileName = typeof params.fileName === "string" ? params.fileName : null;

  const plan = planCatalog[workspace.subscription.plan_key];
  const uploadLimitMb = Math.min(plan.maxFileSizeMb, sourceUploadMaxMb);
  const usageBypassed = bypassUsageLimits();
  const csrfToken = await getCsrfTokenForRender();
  const idempotencyKey = crypto.randomUUID();

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

      {uploadIntent === "upload" ? (
        <div className="mt-6 overflow-hidden rounded-lg border border-mint/20 bg-mint/10">
          <div className="px-5 py-5">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-mint/78">Almost there</p>
            <h2 className="mt-2 text-2xl font-black">Add the clip one more time</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-pearl/74">
              We carried over the rest of your draft. To protect your file, uploads do not cross the sign-up step, so just re-add
              {uploadFileName ? ` ${uploadFileName}` : " the clip"} and keep going.
            </p>
          </div>
        </div>
      ) : null}

      <CreateBoostJobForm
        csrfToken={csrfToken}
        defaultDescription={defaultDescription}
        defaultSourceUrl={defaultSourceUrl}
        idempotencyKey={idempotencyKey}
        monthlyCredits={plan.monthlyCredits}
        uploadLimitMb={uploadLimitMb}
        usageBypassed={usageBypassed}
      />
    </div>
  );
}
