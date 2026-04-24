import { requireAdmin } from "@/lib/authz";
import { getAdminOverview } from "@/lib/app-data";
import { BoostStatusBadge } from "@/components/app/boost-status-badge";
import { Card } from "@/components/ui/card";

export default async function AppAdminPage() {
  await requireAdmin();
  const overview = await getAdminOverview();

  return (
    <div className="mx-auto max-w-7xl">
      <p className="text-sm font-black uppercase text-coral">Internal</p>
      <h1 className="mt-3 text-4xl font-black md:text-5xl">Admin</h1>
      <p className="mt-4 max-w-2xl leading-7 text-pearl/64">Inspect users, subscriptions, and boost jobs. This page is role-gated.</p>

      <section className="mt-8 grid gap-5 md:grid-cols-3">
        <Card>
          <p className="text-3xl font-black">{overview.users.length}</p>
          <p className="text-sm text-pearl/58">Recent users</p>
        </Card>
        <Card>
          <p className="text-3xl font-black">{overview.jobs.length}</p>
          <p className="text-sm text-pearl/58">Recent jobs</p>
        </Card>
        <Card>
          <p className="text-3xl font-black">{overview.subscriptions.length}</p>
          <p className="text-sm text-pearl/58">Subscriptions</p>
        </Card>
      </section>

      <section className="mt-10 grid gap-5 lg:grid-cols-2">
        <Card>
          <h2 className="text-2xl font-black">Users</h2>
          <div className="mt-5 space-y-4 text-sm">
            {overview.users.map((user: { id: string; email: string; full_name: string; role: string }) => (
              <div className="rounded-lg border border-pearl/10 p-4" key={user.id}>
                <p className="font-black">{user.full_name || user.email}</p>
                <p className="mt-1 text-pearl/56">{user.email}</p>
                <p className="mt-2 text-xs uppercase text-mint">{user.role}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="text-2xl font-black">Recent jobs</h2>
          <div className="mt-5 space-y-4 text-sm">
            {overview.jobs.slice(0, 12).map((job) => (
              <div className="rounded-lg border border-pearl/10 p-4" key={job.id}>
                <div className="flex items-center justify-between gap-3">
                  <p className="font-black">{job.projectName}</p>
                  <BoostStatusBadge status={job.status} />
                </div>
                <p className="mt-1 text-pearl/56">{job.sourceFileName ?? job.sourceVideoUrl}</p>
                <p className="mt-2 text-xs uppercase text-pearl/40">{job.processorProvider}</p>
              </div>
            ))}
          </div>
        </Card>
      </section>
    </div>
  );
}
