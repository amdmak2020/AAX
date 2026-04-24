import { cn } from "@/lib/utils";

export function Card({
  children,
  className
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("interactive-card rounded-lg border border-pearl/10 bg-[#111418] p-6", className)}>{children}</div>;
}
