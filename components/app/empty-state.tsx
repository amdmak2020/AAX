import { Button } from "@/components/ui/button";

export function EmptyState({
  title,
  body,
  actionHref,
  actionLabel
}: {
  title: string;
  body: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="rounded-lg border border-dashed border-pearl/16 bg-pearl/[0.04] px-6 py-12 text-center">
      <h2 className="text-2xl font-black">{title}</h2>
      <p className="mx-auto mt-3 max-w-xl leading-7 text-pearl/62">{body}</p>
      {actionHref && actionLabel ? (
        <Button className="mt-6" href={actionHref}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
