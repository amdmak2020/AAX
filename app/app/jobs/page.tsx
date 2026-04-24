import { BoostJobTable } from "@/components/app/boost-job-table";
import { EmptyState } from "@/components/app/empty-state";
import { Button } from "@/components/ui/button";
import { getViewerWorkspace } from "@/lib/app-data";

export default async function AppJobsPage() {
  const workspace = await getViewerWorkspace();
  if (!workspace) return null;

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-black uppercase text-mint">Jobs</p>
          <h1 className="mt-3 text-4xl font-black md:text-5xl">All boosted clips</h1>
          <p className="mt-3 text-pearl/64">Track every uploaded source clip and the improved output it becomes.</p>
        </div>
        <Button href="/app/create">Create a boost</Button>
      </div>
      {workspace.jobs.length === 0 ? (
        <EmptyState actionHref="/app/create" actionLabel="Upload a clip" body="As soon as you submit a clip, it will appear here." title="No jobs yet" />
      ) : (
        <BoostJobTable jobs={workspace.jobs} />
      )}
    </div>
  );
}
