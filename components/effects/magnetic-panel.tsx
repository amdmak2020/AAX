"use client";

import { useState } from "react";

export function MagneticPanel({
  children,
  className = ""
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const [style, setStyle] = useState<React.CSSProperties>({});

  return (
    <div
      className={`magnetic-panel ${className}`}
      onMouseLeave={() => setStyle({ transform: "perspective(900px) rotateX(0deg) rotateY(0deg) translateY(0)" })}
      onMouseMove={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width - 0.5;
        const y = (event.clientY - rect.top) / rect.height - 0.5;
        setStyle({
          transform: `perspective(900px) rotateX(${(-y * 7).toFixed(2)}deg) rotateY(${(x * 9).toFixed(2)}deg) translateY(-4px)`
        });
      }}
      style={style}
    >
      {children}
    </div>
  );
}
