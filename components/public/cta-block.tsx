import { Button } from "@/components/ui/button";

export function CtaBlock({
  title,
  body,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel
}: {
  title: string;
  body: string;
  primaryHref: string;
  primaryLabel: string;
  secondaryHref?: string;
  secondaryLabel?: string;
}) {
  return (
    <div className="rounded-lg border border-pearl/10 bg-pearl/[0.05] px-8 py-12 text-center">
      <h2 className="mx-auto max-w-3xl text-balance text-4xl font-black md:text-5xl">{title}</h2>
      <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-pearl/66">{body}</p>
      <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
        <Button href={primaryHref}>{primaryLabel}</Button>
        {secondaryHref && secondaryLabel ? (
          <Button href={secondaryHref} variant="secondary">
            {secondaryLabel}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
