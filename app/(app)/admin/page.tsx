import { JobTable } from "@/components/app/job-table";
import { Card } from "@/components/ui/card";
import { adminUsers } from "@/lib/account";
import { mockJobs } from "@/lib/jobs";

export default function AdminPage() {
  return (
    <div className="mx-auto max-w-7xl">
      <p className="text-sm font-black uppercase text-coral">Internal</p>
      <h1 className="mt-3 text-4xl font-black md:text-5xl">Admin overview</h1>
      <p className="mt-4 max-w-2xl leading-7 text-pearl/66">Basic visibility for users, jobs, and failed render inspection.</p>

      <section className="mt-8 grid gap-5 md:grid-cols-3">
        <Card>
          <p className="text-3xl font-black">3</p>
          <p className="text-sm text-pearl/58">Users</p>
        </Card>
        <Card>
          <p className="text-3xl font-black">3</p>
          <p className="text-sm text-pearl/58">Jobs today</p>
        </Card>
        <Card>
          <p className="text-3xl font-black">0</p>
          <p className="text-sm text-pearl/58">Failed renders</p>
        </Card>
      </section>

      <section className="mt-10">
        <h2 className="mb-5 text-2xl font-black">Users</h2>
        <div className="overflow-hidden rounded-lg border border-pearl/10">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead className="bg-pearl/[0.06] text-pearl/56">
              <tr>
                <th className="p-4">User</th>
                <th className="p-4">Plan</th>
                <th className="p-4">Credits</th>
                <th className="p-4">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-pearl/10">
              {adminUsers.map((user) => (
                <tr key={user.id}>
                  <td className="p-4">
                    <p className="font-black">{user.name}</p>
                    <p className="mt-1 text-xs text-pearl/48">{user.email}</p>
                  </td>
                  <td className="p-4">{user.plan}</td>
                  <td className="p-4">{user.credits}</td>
                  <td className="p-4">{user.joined}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="mb-5 text-2xl font-black">Jobs</h2>
        <JobTable jobs={mockJobs} />
      </section>
    </div>
  );
}
