import { statusLabels, statusTone, type JobStatus } from "@/lib/jobs";
import { cn } from "@/lib/utils";

export function StatusBadge({ status }: { status: JobStatus }) {
  return <span className={cn("rounded px-2 py-1 text-xs font-black", statusTone[status])}>{statusLabels[status]}</span>;
}
