"use client";

import { FormEvent, useRef, useState } from "react";
import { FileUploadDropzone } from "@/components/app/file-upload-dropzone";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { prepareBoostJobFormForSubmit } from "@/lib/source-upload-client";

function toFriendlyErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (!message) {
    return "We couldn't upload that clip yet. Give it another try in a moment.";
  }

  if (/currently limited to/i.test(message) || /upload an mp4/i.test(message)) {
    return message;
  }

  if (/sign in before uploading/i.test(message)) {
    return "Your session needs a quick refresh before uploading. Refresh this page and try again.";
  }

  if (/too many clips/i.test(message)) {
    return message;
  }

  return "We couldn't upload that clip yet. Give it another try in a moment.";
}

export function CreateBoostJobForm({
  csrfToken,
  idempotencyKey,
  defaultSourceUrl,
  defaultDescription,
  uploadLimitMb,
  usageBypassed,
  monthlyCredits
}: {
  csrfToken: string;
  idempotencyKey: string;
  defaultSourceUrl: string;
  defaultDescription: string;
  uploadLimitMb: number;
  usageBypassed: boolean;
  monthlyCredits: number;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    const form = event.currentTarget;
    if (!selectedFile) {
      return;
    }

    event.preventDefault();
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      await prepareBoostJobFormForSubmit({
        form,
        csrfToken
      });
      form.submit();
    } catch (error) {
      if (fileInputRef.current) {
        fileInputRef.current.disabled = false;
      }
      setSubmitError(toFriendlyErrorMessage(error));
      setIsSubmitting(false);
    }
  };

  return (
    <form action="/api/boost-jobs" className="mt-8" encType="multipart/form-data" method="post" onSubmit={handleSubmit}>
      <input name="csrfToken" type="hidden" value={csrfToken} />
      <input name="idempotencyKey" type="hidden" value={idempotencyKey} />
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
              <FileUploadDropzone
                inputRef={fileInputRef}
                maxFileSizeMb={uploadLimitMb}
                name="sourceFile"
                onFileSelected={setSelectedFile}
                required={false}
              />
            </div>
          </div>

          <div className="text-center text-xs font-bold uppercase tracking-[0.28em] text-pearl/32">or paste a link</div>

          <label className="grid gap-2">
            <span className="text-sm font-black">YouTube or X URL</span>
            <input
              className="rounded-lg border border-pearl/10 bg-ink px-4 py-4 text-base outline-none transition focus:border-mint focus:shadow-[0_0_0_4px_rgba(61,239,176,0.14)]"
              defaultValue={defaultSourceUrl}
              name="sourceUrl"
              placeholder="https://youtube.com/... or https://x.com/..."
              type="url"
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-black">Description</span>
            <textarea
              className="min-h-28 rounded-lg border border-pearl/10 bg-ink px-4 py-4 text-base outline-none transition focus:border-mint focus:shadow-[0_0_0_4px_rgba(61,239,176,0.14)]"
              defaultValue={defaultDescription}
              name="description"
              placeholder="What is happening in this clip, and what should the edit emphasize?"
              required
            />
          </label>

          <div className="rounded-lg border border-pearl/10 bg-ink/60 px-4 py-3 text-sm leading-6 text-pearl/60">
            {usageBypassed ? (
              <>Dev mode is on, so limits are bypassed while we test. Uploads are capped at {uploadLimitMb}MB.</>
            ) : (
              <>Your current plan includes {monthlyCredits} boosts per month. Uploads are capped at {uploadLimitMb}MB.</>
            )}
          </div>

          {submitError ? <p className="text-sm font-semibold text-coral">{submitError}</p> : null}

          <Button className="min-h-14 w-full rounded-lg text-base shadow-[0_20px_60px_rgba(61,239,176,0.22)]" disabled={isSubmitting} type="submit">
            {isSubmitting ? "Uploading clip..." : "Make this clip more engaging"}
          </Button>
        </div>
      </Card>
    </form>
  );
}
