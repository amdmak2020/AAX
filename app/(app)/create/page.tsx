import { Link2 } from "lucide-react";
import { CreateLivePreview } from "@/components/app/create-live-preview";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function CreatePage() {
  return (
    <div className="mx-auto max-w-6xl">
      <div className="max-w-3xl">
        <p className="text-sm font-black uppercase text-mint">Create</p>
        <h1 className="mt-3 text-4xl font-black md:text-5xl">Make a half-screen short from a Twitter/X video.</h1>
        <p className="mt-4 leading-7 text-pearl/66">Paste the video URL, pick a preset, and send it to render.</p>
      </div>

      <form className="mt-8 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]" action="/api/jobs" method="post" encType="multipart/form-data">
        <section className="rounded-lg border border-pearl/10 bg-pearl/[0.06] p-6">
          <input name="mode" type="hidden" value="twitter" />
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-mint text-ink">
            <Link2 className="h-6 w-6" />
          </div>
          <h2 className="mt-5 text-2xl font-black">Twitter/X to Half-Screen Short</h2>
          <p className="mt-3 leading-7 text-pearl/64">
            This MVP has one job: turn a Twitter or X video URL into a vertical half-screen short.
          </p>
          <div className="mt-6 rounded-lg bg-ink/54 p-4 text-sm leading-6 text-pearl/62">
            Best for clips, reactions, commentary, and short source videos that need a more watchable feed format.
          </div>
          <CreateLivePreview />
        </section>

        <Card>
          <input name="style" type="hidden" value="Clean Split" />
          <input name="voice" type="hidden" value="Original audio" />

          <label className="grid gap-2">
            <span className="text-sm font-black">Project name</span>
            <input className="rounded-lg border border-pearl/10 bg-ink px-4 py-3 outline-none focus:border-mint" name="title" placeholder="My next viral short" required />
          </label>

          <label className="mt-5 grid gap-2">
            <span className="text-sm font-black">Twitter/X video URL</span>
            <input
              className="rounded-lg border border-pearl/10 bg-ink px-4 py-3 outline-none focus:border-mint"
              name="twitterUrl"
              placeholder="https://x.com/account/status/..."
              required
              type="url"
            />
          </label>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Button type="submit">Generate half-screen short</Button>
            <Button href="/dashboard" variant="secondary">
              Save for later
            </Button>
          </div>
        </Card>
      </form>
    </div>
  );
}
