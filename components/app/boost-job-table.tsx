import Link from "next/link";
import { boostPresets, targetPlatforms } from "@/lib/app-config";
import type { BoostJob } from "@/lib/boost-jobs";
import { BoostStatusBadge } from "@/components/app/boost-status-badge";
import { formatDate } from "@/lib/utils";

export function BoostJobTable({ jobs }: { jobs: BoostJob[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-pearl/10">
      <table className="w-full min-w-[900px] border-collapse text-left text-sm">
        <thead className="bg-pearl/[0.06] text-pearl/54">
          <tr>
            <th className="p-4">Project</th>
            <th className="p-4">Preset</th>
            <th className="p-4">Platform</th>
            <th className="p-4">Status</th>
            <th className="p-4">Created</th>
            <th className="p-4">Output</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-pearl/10">
          {jobs.map((job) => (
            <tr className="job-row transition hover:bg-pearl/[0.04]" key={job.id}>
              <td className="p-4">
                <Link className="font-black hover:text-mint" href={`/app/jobs/${job.id}`}>
                  {job.projectName}
                </Link>
                <p className="mt-1 text-xs text-pearl/46">{job.sourceFileName ?? "Uploaded clip"}</p>
              </td>
              <td className="p-4">{boostPresets.find((preset) => preset.key === job.preset)?.name ?? job.preset}</td>
              <td className="p-4">{targetPlatforms.find((platform) => platform.key === job.targetPlatform)?.name ?? job.targetPlatform}</td>
              <td className="p-4">
                <BoostStatusBadge status={job.status} />
              </td>
              <td className="p-4 text-pearl/64">{formatDate(job.createdAt)}</td>
              <td className="p-4 text-pearl/64">{job.outputVideoUrl ? "Ready" : "Pending"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
