"use client";

import { useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { ShapeBlur } from "@/components/effects/shape-blur";
import { ScrambledText } from "@/components/effects/scrambled-text";

const prompts = [
  "Paste the tweet. We shape the short.",
  "Captions, layout, motion, export.",
  "Half-screen format without editing.",
  "Your feed-ready clip is one render away."
];

export function CreateLivePreview() {
  const [index, setIndex] = useState(0);
  const text = useMemo(() => prompts[index % prompts.length], [index]);

  return (
    <button
      className="relative mt-6 min-h-48 w-full overflow-hidden rounded-lg border border-mint/20 bg-ink/60 p-5 text-left"
      onClick={() => setIndex((current) => current + 1)}
      type="button"
    >
      <div className="absolute inset-0 opacity-75">
        <ShapeBlur variation={2} shapeSize={0.85} roundness={0.5} borderSize={0.04} circleSize={0.22} circleEdge={1} />
      </div>
      <div className="relative">
        <div className="inline-flex items-center gap-2 rounded bg-mint px-2 py-1 text-xs font-black uppercase text-ink">
          <Sparkles className="h-3.5 w-3.5" />
          Tap to remix
        </div>
        <p className="mt-7 text-3xl font-black leading-tight">
          <ScrambledText radius={100} duration={1.2} speed={0.5} scrambleChars=".:">
            {text}
          </ScrambledText>
        </p>
        <p className="mt-4 text-sm leading-6 text-pearl/60">The preview reacts while you set up the render.</p>
      </div>
    </button>
  );
}
