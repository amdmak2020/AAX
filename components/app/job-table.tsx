import Link from "next/link";
import { modeLabels, type VideoJob } from "@/lib/jobs";
import { StatusBadge } from "@/components/app/status-badge";

export function JobTable({ jobs }: { jobs: VideoJob[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-pearl/10">
      <table className="w-full min-w-[720px] border-collapse text-left text-sm">
        <thead className="bg-pearl/[0.06] text-pearl/56">
          <tr>
            <th className="p-4">Project</th>
            <th className="p-4">Mode</th>
            <th className="p-4">Status</th>
            <th className="p-4">Progress</th>
            <th className="p-4">Credits</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-pearl/10">
          {jobs.map((job) => (
            <tr className="job-row transition hover:bg-pearl/[0.04]" key={job.id}>
              <td className="p-4">
                <Link className="font-black hover:text-mint" href={`/jobs/${job.id}`}>
                  {job.title}
                </Link>
                <p className="mt-1 text-xs text-pearl/48">{job.id}</p>
              </td>
              <td className="p-4 text-pearl/70">{modeLabels[job.mode]}</td>
              <td className="p-4">
                <StatusBadge status={job.status} />
              </td>
              <td className="p-4">
                <div className="h-2 w-32 overflow-hidden rounded bg-pearl/10">
                  <div
                    className={job.status === "completed" || job.status === "failed" ? "h-2 rounded bg-mint" : "render-pulse-bar h-2 rounded bg-mint"}
                    style={{ width: `${job.progress}%` }}
                  />
                </div>
              </td>
              <td className="p-4 text-pearl/70">{job.credits}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
