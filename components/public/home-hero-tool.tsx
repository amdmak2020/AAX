"use client";

import { FormEvent, useMemo, useState } from "react";
import { Link as LinkIcon, UploadCloud, X } from "lucide-react";
import { FileUploadDropzone } from "@/components/app/file-upload-dropzone";

function buildNextPath(form: HTMLFormElement) {
  const formData = new FormData(form);
  const params = new URLSearchParams();
  const sourceUrl = formData.get("sourceUrl")?.toString().trim() ?? "";
  const description = formData.get("description")?.toString().trim() ?? "";
  const file = formData.get("sourceFile");

  if (sourceUrl) {
    params.set("sourceUrl", sourceUrl);
  }

  if (description) {
    params.set("description", description);
  }

  if (file instanceof File && file.size > 0 && file.name.trim()) {
    params.set("intent", "upload");
    params.set("fileName", file.name.trim());
  }

  const query = params.toString();
  return query ? `/app/create?${query}` : "/app/create";
}

export function HomeHeroTool({
  csrfToken,
  idempotencyKey,
  isLoggedIn,
  uploadLimitMb
}: {
  csrfToken: string;
  idempotencyKey: string;
  isLoggedIn: boolean;
  uploadLimitMb: number;
}) {
  const [showAuthGate, setShowAuthGate] = useState(false);
  const [nextPath, setNextPath] = useState("/app/create");
  const [email, setEmail] = useState("");

  const signupHref = useMemo(() => {
    const params = new URLSearchParams({ next: nextPath });
    if (email.trim()) {
      params.set("email", email.trim());
    }
    return `/signup?${params.toString()}`;
  }, [email, nextPath]);

  const loginHref = useMemo(() => `/login?next=${encodeURIComponent(nextPath)}`, [nextPath]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    if (isLoggedIn) {
      return;
    }

    event.preventDefault();
    const form = event.currentTarget;
    setNextPath(buildNextPath(form));
    setShowAuthGate(true);
  };

  return (
    <>
      <form action="/api/boost-jobs" className="mx-auto mt-10 max-w-4xl" encType="multipart/form-data" method="post" onSubmit={handleSubmit}>
        <input name="csrfToken" type="hidden" value={csrfToken} />
        <input name="idempotencyKey" type="hidden" value={idempotencyKey} />
        <div className="overflow-hidden rounded-lg border border-pearl/10 bg-[#121416]">
          <div className="border-b border-pearl/10 px-5 py-4">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-mint/78">Try it now</p>
            <h2 className="mt-2 text-2xl font-black md:text-3xl">Drop in a clip or paste a link</h2>
          </div>

          <div className="grid gap-6 p-5 lg:grid-cols-[1.2fr_0.8fr] lg:items-start">
            <div className="grid gap-4">
              <label className="grid gap-2">
                <span className="inline-flex items-center gap-2 text-sm font-black">
                  <LinkIcon className="h-4 w-4 text-mint" />
                  YouTube or X URL
                </span>
                <input
                  className="rounded-lg border border-pearl/10 bg-ink px-4 py-4 text-base outline-none transition focus:border-mint focus:shadow-[0_0_0_4px_rgba(61,239,176,0.14)]"
                  name="sourceUrl"
                  placeholder="https://youtube.com/... or https://x.com/..."
                  type="url"
                />
              </label>

              <div className="text-center text-xs font-bold uppercase tracking-[0.28em] text-pearl/32">or</div>

              <div>
                <span className="inline-flex items-center gap-2 text-sm font-black">
                  <UploadCloud className="h-4 w-4 text-mint" />
                  Upload a source clip
                </span>
                <div className="mt-2">
                  <FileUploadDropzone maxFileSizeMb={uploadLimitMb} name="sourceFile" required={false} />
                </div>
              </div>
            </div>

            <div className="grid gap-4">
              <label className="grid gap-2">
                <span className="text-sm font-black">What should the edit emphasize?</span>
                <textarea
                  className="min-h-32 rounded-lg border border-pearl/10 bg-ink px-4 py-4 text-base outline-none transition focus:border-mint focus:shadow-[0_0_0_4px_rgba(61,239,176,0.14)]"
                  name="description"
                  placeholder="Stronger intro, cleaner captions, faster pacing, more gameplay under the talking head..."
                  required
                />
              </label>

              <div className="rounded-lg border border-pearl/10 bg-ink/60 px-4 py-3 text-sm leading-6 text-pearl/60">
                Free plan available. No card needed. Uploads are capped at {uploadLimitMb}MB.
              </div>

              <button
                className="button-sheen inline-flex min-h-14 items-center justify-center rounded-lg bg-mint px-5 py-3 text-base font-bold text-ink transition focus:outline-none focus:ring-2 focus:ring-mint/60"
                data-button-variant="primary"
                type="submit"
              >
                Get free clips
              </button>
            </div>
          </div>
        </div>
      </form>

      {showAuthGate ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center px-5 py-10">
          <button
            aria-label="Close sign up modal"
            className="absolute inset-0 bg-black/70 backdrop-blur-md"
            onClick={() => setShowAuthGate(false)}
            type="button"
          />
          <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-[24px] border border-pearl/10 bg-[#242526] p-6 shadow-[0_30px_100px_rgba(0,0,0,0.45)]">
            <button
              aria-label="Close sign up modal"
              className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full text-pearl/52 transition hover:bg-white/5 hover:text-pearl"
              onClick={() => setShowAuthGate(false)}
              type="button"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="px-2 pt-2 text-center">
              <h3 className="mx-auto max-w-sm text-balance text-4xl font-black leading-tight">
                Finish signing up to get your free clips
              </h3>
              <p className="mt-4 text-lg text-pearl/58">Free plan available. No card required.</p>
            </div>

            <div className="mt-8 grid gap-4">
              <form action="/api/auth/google" method="post">
                <input name="csrfToken" type="hidden" value={csrfToken} />
                <input name="next" type="hidden" value={nextPath} />
                <button
                  className="flex min-h-14 w-full items-center justify-center gap-3 rounded-lg bg-white/10 px-5 text-lg font-bold text-pearl transition hover:bg-white/14"
                  type="submit"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-sm font-black text-ink">G</span>
                  Continue with Google
                </button>
              </form>

              <div className="my-1 flex items-center gap-3 text-sm font-bold text-pearl/38">
                <span className="h-px flex-1 bg-pearl/10" />
                or continue with email
                <span className="h-px flex-1 bg-pearl/10" />
              </div>

              <input
                className="min-h-14 rounded-lg border border-pearl/10 bg-[#1b1c1f] px-4 text-base text-pearl outline-none transition focus:border-mint focus:shadow-[0_0_0_4px_rgba(61,239,176,0.14)]"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Enter email address"
                type="email"
                value={email}
              />

              <a
                className="inline-flex min-h-14 items-center justify-center rounded-lg bg-pearl px-5 text-lg font-bold text-ink transition hover:bg-pearl/90"
                href={signupHref}
              >
                Continue with email
              </a>

              <p className="pt-2 text-center text-sm text-pearl/54">
                Already have an account?{" "}
                <a className="font-bold text-pearl transition hover:text-mint" href={loginHref}>
                  Sign in here
                </a>
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
