import { statusTimeline, type BoostJobStatus } from "@/lib/boost-jobs";

const order: BoostJobStatus[] = ["draft", "queued", "processing", "rendering", "completed", "failed"];

export function JobStatusTimeline({ status }: { status: BoostJobStatus }) {
  const statusIndex = order.indexOf(status);

  return (
    <div className="grid gap-3">
      {statusTimeline.map((step, index) => {
        const active = index <= Math.max(0, statusIndex - 1) || step.key === status;
        return (
          <div className="flex gap-3" key={step.key}>
            <div className={`mt-1 h-3 w-3 rounded-full ${active ? "bg-mint" : "bg-pearl/18"}`} />
            <div>
              <p className={`font-black ${active ? "text-pearl" : "text-pearl/44"}`}>{step.label}</p>
              <p className="text-sm leading-6 text-pearl/58">{step.description}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
