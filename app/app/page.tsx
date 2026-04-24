import { ArrowRight, Sparkles, Zap } from "lucide-react";
import { BoostJobTable } from "@/components/app/boost-job-table";
import { EmptyState } from "@/components/app/empty-state";
import { PlanBadge } from "@/components/app/plan-badge";
import { UsageMeter } from "@/components/app/usage-meter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getViewerWorkspace } from "@/lib/app-data";

export default async function AppDashboardPage() {
  const workspace = await getViewerWorkspace();
  if (!workspace) return null;

  const jobs = workspace.jobs;
  const activeJobs = jobs.filter((job) => job.status !== "completed" && job.status !== "failed").length;

  return (
    <div className="mx-auto max-w-7xl">
      <section className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="interactive-card rounded-lg border border-pearl/10 bg-pearl/[0.05] p-8">
          <p className="text-sm font-black uppercase text-mint">Boost My Clip</p>
          <h1 className="mt-3 text-4xl font-black md:text-5xl">Fix your short-form videos before you post them.</h1>
          <p className="mt-4 max-w-2xl leading-7 text-pearl/64">
            Upload a clip, choose the kind of improvement you want, and get back a more watchable version with stronger hooks and captions.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Button href="/app/create">Create a boost</Button>
            <Button href="/app/jobs" variant="secondary">
              See all jobs <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="grid gap-5">
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-pearl/50">Current plan</p>
                <h2 className="mt-1 text-2xl font-black capitalize">{workspace.subscription.plan_key}</h2>
              </div>
              <PlanBadge planKey={workspace.subscription.plan_key} />
            </div>
            <div className="mt-5">
              <UsageMeter used={workspace.subscription.credits_used} total={workspace.subscription.credits_total} />
            </div>
          </Card>
          <div className="grid gap-5 sm:grid-cols-2">
            <Card>
              <Sparkles className="h-6 w-6 text-mint" />
              <p className="mt-4 text-3xl font-black">{jobs.length}</p>
              <p className="text-sm text-pearl/58">Boosts created</p>
            </Card>
            <Card>
              <Zap className="h-6 w-6 text-coral" />
              <p className="mt-4 text-3xl font-black">{activeJobs}</p>
              <p className="text-sm text-pearl/58">Currently active</p>
            </Card>
          </div>
        </div>
      </section>

      <section className="mt-10">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-2xl font-black">Recent boosts</h2>
          <Button href="/app/jobs" variant="ghost">
            View all
          </Button>
        </div>
        {jobs.length === 0 ? (
          <EmptyState
            actionHref="/app/create"
            actionLabel="Upload your first clip"
            body="Your first boosted short will show up here as soon as you submit a clip."
            title="No boosts yet"
          />
        ) : (
          <BoostJobTable jobs={jobs.slice(0, 8)} />
        )}
      </section>
    </div>
  );
}
