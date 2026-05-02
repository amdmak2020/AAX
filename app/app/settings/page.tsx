import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmSubmitButton } from "@/components/admin/confirm-submit-button";
import { CsrfHiddenInput } from "@/components/security/csrf-hidden-input";
import { getViewerWorkspace } from "@/lib/app-data";
import { brand } from "@/lib/app-config";
import { hasYouTubeOAuthConfig } from "@/lib/env";

const noticeLabels: Record<string, string> = {
  deletion_requested: "Your deletion request was recorded and the account was locked for follow-up.",
  csrf_failed: "The security token expired. Refresh and try again.",
  unexpected_fields: "Unexpected form data was rejected.",
  invalid_request: "That request was invalid.",
  youtube_connected: "Your YouTube account is connected and ready to publish.",
  youtube_disconnected: "Your YouTube account was disconnected.",
  youtube_failed: "That YouTube action did not complete. Try again.",
  youtube_config_missing: "YouTube publishing is not fully configured yet. Add the Google OAuth keys and app encryption key first."
};

type AppSettingsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function asNotice(value: string | string[] | undefined) {
  const key = Array.isArray(value) ? value[0] : value;
  return key ? noticeLabels[key] ?? null : null;
}

export default async function AppSettingsPage({ searchParams }: AppSettingsPageProps) {
  const workspace = await getViewerWorkspace();
  if (!workspace) return null;
  const youtubeConfigReady = hasYouTubeOAuthConfig();
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const notice = asNotice(resolvedSearchParams?.notice);

  return (
    <div className="mx-auto max-w-4xl">
      <p className="text-sm font-black uppercase text-mint">Settings</p>
      <h1 className="mt-3 text-4xl font-black md:text-5xl">Account settings</h1>

      {notice ? <div className="mt-6 rounded-lg border border-mint/25 bg-mint/10 px-4 py-3 text-sm text-pearl/88">{notice}</div> : null}

      <div className="mt-8 grid gap-5">
        <Card>
          <h2 className="text-2xl font-black">Profile</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-sm font-black">Full name</span>
              <input className="rounded-lg border border-pearl/10 bg-ink px-4 py-3" defaultValue={workspace.profile.full_name} />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-black">Email</span>
              <input className="rounded-lg border border-pearl/10 bg-ink px-4 py-3" defaultValue={workspace.profile.email} />
            </label>
          </div>
          <p className="mt-6 text-sm text-pearl/56">Profile edits are intentionally limited right now while we keep account identity changes on the safer server-side path.</p>
        </Card>

        <Card>
          <h2 className="text-2xl font-black">Defaults</h2>
          <p className="mt-3 leading-7 text-pearl/62">
            Subtitle style, default preset, and preferred platform defaults can live here as the product grows.
          </p>
        </Card>

        <Card>
          <h2 className="text-2xl font-black">YouTube publishing</h2>
          <p className="mt-3 leading-7 text-pearl/62">
            Connect your YouTube account once, then post finished boosted clips straight from the completed job page with title, description, tags, and schedule controls.
          </p>
          {!youtubeConfigReady ? (
            <div className="mt-6 rounded-lg border border-amber/30 bg-amber/10 px-4 py-4 text-sm leading-6 text-pearl/82">
              <p className="font-black text-amber">Setup incomplete</p>
              <p className="mt-2">
                We still need the Google OAuth setup in Vercel before account connection can work: <code>APP_ENCRYPTION_KEY</code>, <code>YOUTUBE_CLIENT_ID</code>, and <code>YOUTUBE_CLIENT_SECRET</code>.
              </p>
              <p className="mt-2 text-pearl/62">
                Google Cloud must also allow <code>https://www.autoagentx.com/api/youtube/callback</code> as an OAuth redirect URI.
              </p>
            </div>
          ) : null}
          <div className="mt-6 rounded-lg border border-pearl/10 bg-ink px-4 py-4">
            {workspace.youtube?.connected ? (
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-black uppercase text-mint">Connected</p>
                  <p className="mt-2 text-xl font-black">{workspace.youtube.channelTitle ?? "YouTube account connected"}</p>
                  <p className="mt-2 text-sm text-pearl/56">Finished videos can now be posted or scheduled from the job page.</p>
                </div>
                <form action="/api/youtube/disconnect" method="post">
                  <CsrfHiddenInput />
                  <ConfirmSubmitButton
                    className="rounded-lg border border-coral/30 bg-coral/10 px-4 py-3 text-left font-semibold text-coral transition hover:bg-coral/15"
                    confirmMessage="Disconnect your YouTube account from AutoAgentX?"
                  >
                    Disconnect YouTube
                  </ConfirmSubmitButton>
                </form>
              </div>
            ) : (
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-black uppercase text-violet">Not connected</p>
                  <p className="mt-2 text-xl font-black">Connect your YouTube account</p>
                  <p className="mt-2 text-sm text-pearl/56">We use secure Google OAuth and only ask for the upload permission needed to publish your finished clips.</p>
                </div>
                {youtubeConfigReady ? (
                  <Button href="/api/youtube/connect?next=%2Fapp%2Fsettings">Connect YouTube</Button>
                ) : (
                  <Button disabled>Connect YouTube</Button>
                )}
              </div>
            )}
          </div>
        </Card>

        <Card>
          <h2 className="text-2xl font-black">Privacy controls</h2>
          <p className="mt-3 leading-7 text-pearl/62">
            Export your account data any time. If you want your account and stored job data removed, send a deletion request and we will lock the account while we process it.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button href="/api/account/export">Export my data</Button>
            <Button href="/privacy" variant="secondary">
              Privacy Policy
            </Button>
            <Button href="/refunds" variant="secondary">
              Refund Policy
            </Button>
          </div>
          <form action="/api/account/delete-request" className="mt-6 grid gap-3 md:max-w-xl">
            <CsrfHiddenInput />
            <input
              className="rounded-lg border border-pearl/10 bg-ink px-4 py-3"
              maxLength={160}
              name="reason"
              placeholder="Reason for deletion request (optional)"
            />
            <ConfirmSubmitButton
              className="rounded-lg border border-coral/30 bg-coral/10 px-4 py-3 text-left font-semibold text-coral transition hover:bg-coral/15"
              confirmMessage={`Request account deletion and lock your account for follow-up with ${brand.supportEmail}?`}
            >
              Request account deletion
            </ConfirmSubmitButton>
          </form>
        </Card>
      </div>
    </div>
  );
}
