"use client";

import { useState } from "react";

type Spark = {
  id: number;
  x: number;
  y: number;
};

export function ClickSpark({
  children,
  sparkColor = "#ffffff",
  sparkSize = 10,
  sparkRadius = 15,
  sparkCount = 8,
  duration = 400
}: {
  children: React.ReactNode;
  sparkColor?: string;
  sparkSize?: number;
  sparkRadius?: number;
  sparkCount?: number;
  duration?: number;
}) {
  const [sparks, setSparks] = useState<Spark[]>([]);

  function addSpark(x: number, y: number) {
    const id = Date.now() + Math.random();
    setSparks((current) => [...current, { id, x, y }]);
    window.setTimeout(() => {
      setSparks((current) => current.filter((spark) => spark.id !== id));
    }, duration);
  }

  return (
    <div className="relative min-h-screen overflow-x-clip" onClick={(event) => addSpark(event.clientX, event.clientY)}>
      {children}
      <div className="pointer-events-none fixed inset-0 z-[80]">
        {sparks.map((spark) => (
          <span className="absolute block" key={spark.id} style={{ left: spark.x, top: spark.y }}>
            {Array.from({ length: sparkCount }).map((_, index) => {
              const angle = (index / sparkCount) * Math.PI * 2;
              const x = Math.cos(angle) * sparkRadius;
              const y = Math.sin(angle) * sparkRadius;

              return (
                <span
                  className="spark-ray"
                  key={index}
                  style={
                    {
                      width: sparkSize * 2.6,
                      height: Math.max(2, sparkSize / 4),
                      backgroundColor: sparkColor,
                      animationDuration: `${duration}ms`,
                      rotate: `${(angle * 180) / Math.PI}deg`,
                      "--spark-x": `${x}px`,
                      "--spark-y": `${y}px`,
                      "--spark-glow": sparkColor
                    } as React.CSSProperties
                  }
                />
              );
            })}
          </span>
        ))}
      </div>
    </div>
  );
}
