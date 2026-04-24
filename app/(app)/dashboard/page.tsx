import { ArrowRight, Clock, CreditCard, Film, PlusCircle } from "lucide-react";
import { JobTable } from "@/components/app/job-table";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getCurrentAppData } from "@/lib/supabase/data";
import { formatCredits } from "@/lib/utils";

export default async function DashboardPage() {
  const { account, jobs, usingFallback } = await getCurrentAppData();
  const percent = Math.round((account.creditsUsed / account.creditsTotal) * 100);

  return (
    <div className="mx-auto max-w-7xl">
      <section className="grid gap-5 lg:grid-cols-[1.4fr_0.6fr]">
        <div className="interactive-card rounded-lg border border-pearl/10 bg-pearl/[0.06] p-8">
          <p className="text-sm font-black uppercase text-mint">Welcome back</p>
          <h1 className="mt-3 text-4xl font-black md:text-5xl">Ready to make the next short?</h1>
          <p className="mt-4 max-w-2xl leading-7 text-pearl/66">
            Start with a Twitter/X video URL. Your recent jobs and exports stay here.
          </p>
          {usingFallback ? (
            <p className="mt-4 rounded-lg border border-lemon/25 bg-lemon/10 px-4 py-3 text-sm font-bold text-lemon">
              Supabase is configured locally. Run the schema in Supabase to switch this dashboard from demo data to live data.
            </p>
          ) : null}
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button href="/create">
              <PlusCircle className="mr-2 h-4 w-4" />
              Create video
            </Button>
            <Button href="/jobs" variant="secondary">
              View projects <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
        <Card>
          <CreditCard className="h-6 w-6 text-lemon" />
          <h2 className="mt-4 text-2xl font-black">{formatCredits(account.creditsUsed, account.creditsTotal)}</h2>
          <div className="mt-5 h-3 overflow-hidden rounded bg-pearl/10">
            <div className="render-pulse-bar h-3 rounded bg-mint" style={{ width: `${100 - percent}%` }} />
          </div>
          <p className="mt-4 text-sm leading-6 text-pearl/60">Credits renew monthly. Upgrade any time for more exports.</p>
          <Button className="mt-6 w-full" href="/app/billing" variant="secondary">
            Manage plan
          </Button>
        </Card>
      </section>

      <section className="mt-8 grid gap-5 md:grid-cols-3">
        <Card>
          <Film className="h-6 w-6 text-mint" />
          <p className="mt-4 text-3xl font-black">{jobs.length}</p>
          <p className="text-sm text-pearl/58">Videos generated</p>
        </Card>
        <Card>
          <Clock className="h-6 w-6 text-coral" />
          <p className="mt-4 text-3xl font-black">{jobs.filter((job) => job.status !== "completed" && job.status !== "failed").length}</p>
          <p className="text-sm text-pearl/58">In progress</p>
        </Card>
        <Card>
          <CreditCard className="h-6 w-6 text-lemon" />
          <p className="mt-4 text-3xl font-black">{account.plan}</p>
          <p className="text-sm text-pearl/58">Current plan</p>
        </Card>
      </section>

      <section className="mt-10">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-2xl font-black">Recent jobs</h2>
          <Button href="/jobs" variant="ghost">
            View all
          </Button>
        </div>
        <JobTable jobs={jobs} />
      </section>
    </div>
  );
}
