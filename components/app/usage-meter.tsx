import { formatCredits } from "@/lib/utils";

export function UsageMeter({ used, total }: { used: number; total: number }) {
  const remaining = Math.max(total - used, 0);
  const percent = total > 0 ? Math.min(100, Math.round((remaining / total) * 100)) : 0;

  return (
    <div className="rounded-lg border border-pearl/10 bg-pearl/[0.05] p-4">
      <p className="text-sm font-black">{formatCredits(used, total)}</p>
      <div className="mt-3 h-3 overflow-hidden rounded bg-pearl/10">
        <div className="render-pulse-bar h-3 rounded bg-mint" style={{ width: `${percent}%` }} />
      </div>
      <p className="mt-2 text-xs text-pearl/52">{remaining} boosts remaining this period.</p>
    </div>
  );
}
