import { JobTable } from "@/components/app/job-table";
import { Button } from "@/components/ui/button";
import { getCurrentAppData } from "@/lib/supabase/data";

export default async function JobsPage() {
  const { jobs } = await getCurrentAppData();

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-black uppercase text-mint">Projects</p>
          <h1 className="mt-3 text-4xl font-black md:text-5xl">Your video jobs</h1>
          <p className="mt-3 text-pearl/64">Track every queued, rendering, completed, and failed export.</p>
        </div>
        <Button href="/create">Create video</Button>
      </div>
      <JobTable jobs={jobs} />
    </div>
  );
}
