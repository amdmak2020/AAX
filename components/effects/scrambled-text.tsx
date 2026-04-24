"use client";

import { useEffect, useMemo, useState } from "react";

export function ScrambledText({
  children,
  className,
  radius = 100,
  duration = 1.2,
  speed = 0.5,
  scrambleChars = ".:"
}: {
  children: string;
  className?: string;
  radius?: number;
  duration?: number;
  speed?: number;
  scrambleChars?: string;
}) {
  const [frame, setFrame] = useState(0);
  const text = useMemo(() => children, [children]);

  useEffect(() => {
    const totalFrames = Math.max(12, Math.round(duration * 60));
    const interval = window.setInterval(() => {
      setFrame((current) => (current + 1) % totalFrames);
    }, Math.max(24, speed * 80));

    return () => window.clearInterval(interval);
  }, [duration, speed]);

  const totalFrames = Math.max(12, Math.round(duration * 60));
  const revealPoint = frame / totalFrames;
  const radiusInfluence = Math.max(1, Math.min(radius / 100, 3));

  const rendered = text
    .split("")
    .map((char, index) => {
      if (char === " ") return " ";
      const phase = ((index * 0.037 * radiusInfluence + revealPoint) % 1);
      const shouldScramble = phase > 0.58 && phase < 0.92;
      if (!shouldScramble) return char;
      return scrambleChars[(index + frame) % scrambleChars.length] ?? ".";
    })
    .join("");

  return <span className={className}>{rendered}</span>;
}
