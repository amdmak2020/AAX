"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export function InteractiveSurface({
  children,
  className = ""
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const [style, setStyle] = useState<React.CSSProperties>({
    ["--spot-x" as string]: "50%",
    ["--spot-y" as string]: "50%"
  });

  return (
    <div
      className={cn("interactive-surface", className)}
      onMouseLeave={() =>
        setStyle({
          ["--spot-x" as string]: "50%",
          ["--spot-y" as string]: "50%"
        })
      }
      onMouseMove={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width) * 100;
        const y = ((event.clientY - rect.top) / rect.height) * 100;
        setStyle({
          ["--spot-x" as string]: `${x}%`,
          ["--spot-y" as string]: `${y}%`
        });
      }}
      style={style}
    >
      {children}
    </div>
  );
}
