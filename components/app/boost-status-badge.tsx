import { boostStatusLabel, boostStatusTone, type BoostJobStatus } from "@/lib/boost-jobs";

export function BoostStatusBadge({ status }: { status: BoostJobStatus }) {
  return <span className={`rounded px-2 py-1 text-xs font-black ${boostStatusTone[status]}`}>{boostStatusLabel[status]}</span>;
}
