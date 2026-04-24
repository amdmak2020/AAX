import { Play } from "lucide-react";
import Image from "next/image";
import { examples } from "@/lib/product";

export function ExamplePhone({ index = 0 }: { index?: number }) {
  const example = examples[index];

  return (
    <div className="phone-frame relative min-h-[420px] w-full max-w-[245px] bg-coal">
      <Image alt={`${example.title} short preview`} className="h-full w-full object-cover opacity-80" fill sizes="245px" src={example.image} />
      <div className="absolute inset-x-4 top-4 flex items-center justify-between text-xs font-bold">
        <span className="rounded bg-ink/72 px-2 py-1">{example.label}</span>
        <span className="rounded bg-coral px-2 py-1 text-ink">9:16</span>
      </div>
      <div className="absolute inset-x-4 bottom-5">
        <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-lg bg-mint text-ink">
          <Play className="h-5 w-5 fill-current" />
        </div>
        <p className="rounded-lg bg-ink/78 px-3 py-2 text-center text-lg font-black leading-tight">
          {example.caption}
        </p>
      </div>
    </div>
  );
}
