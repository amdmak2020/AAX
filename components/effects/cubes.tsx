"use client";

import { useMemo, useState } from "react";

type Ripple = {
  x: number;
  y: number;
  key: number;
  active: boolean;
};

export function Cubes({
  gridSize = 8,
  maxAngle = 45,
  radius = 3,
  borderStyle = "2px dashed #B497CF",
  faceColor = "#1a1a2e",
  rippleColor = "#ff6b6b",
  rippleSpeed = 1.5,
  autoAnimate = true,
  rippleOnClick = true
}: {
  gridSize?: number;
  maxAngle?: number;
  radius?: number;
  borderStyle?: string;
  faceColor?: string;
  rippleColor?: string;
  rippleSpeed?: number;
  autoAnimate?: boolean;
  rippleOnClick?: boolean;
}) {
  const [pointer, setPointer] = useState({ x: 50, y: 50 });
  const [ripple, setRipple] = useState<Ripple>({ x: 50, y: 50, key: 0, active: false });
  const cells = useMemo(() => Array.from({ length: gridSize * gridSize }), [gridSize]);

  return (
    <div
      className="cubes-stage"
      onClick={(event) => {
        if (!rippleOnClick) return;
        const rect = event.currentTarget.getBoundingClientRect();
        setRipple({
          x: ((event.clientX - rect.left) / rect.width) * 100,
          y: ((event.clientY - rect.top) / rect.height) * 100,
          key: Date.now(),
          active: true
        });
      }}
      onMouseMove={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        setPointer({
          x: ((event.clientX - rect.left) / rect.width) * 100,
          y: ((event.clientY - rect.top) / rect.height) * 100
        });
      }}
    >
      <div
        className="cubes-grid"
        style={{
          gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${gridSize}, minmax(0, 1fr))`
        }}
      >
        {cells.map((_, index) => {
          const x = index % gridSize;
          const y = Math.floor(index / gridSize);
          const centerX = ((x + 0.5) / gridSize) * 100;
          const centerY = ((y + 0.5) / gridSize) * 100;
          const dx = pointer.x - centerX;
          const dy = pointer.y - centerY;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const lift = Math.max(0, 22 - distance / 2.6);
          const angleX = ((dy / 100) * maxAngle).toFixed(2);
          const angleY = ((dx / 100) * -maxAngle).toFixed(2);
          const delay = (x + y) * 45;

          return (
            <div
              className={autoAnimate ? "cube-stack animate-cube-wave" : "cube-stack"}
              key={index}
              style={
                {
                  animationDelay: `${delay}ms`,
                  borderRadius: radius,
                  "--cube-lift": `${lift}px`,
                  "--cube-tilt-x": `${angleX}deg`,
                  "--cube-tilt-y": `${angleY}deg`
                } as React.CSSProperties
              }
            >
              <span className="cube-face cube-face-front" style={{ border: borderStyle, backgroundColor: faceColor, borderRadius: radius }} />
              <span className="cube-face cube-face-top" style={{ border: borderStyle, backgroundColor: faceColor, borderRadius: radius }} />
              <span className="cube-face cube-face-side" style={{ border: borderStyle, backgroundColor: faceColor, borderRadius: radius }} />
            </div>
          );
        })}
      </div>
      {ripple.active ? (
        <span
          className="cube-ripple"
          key={ripple.key}
          style={
            {
              left: `${ripple.x}%`,
              top: `${ripple.y}%`,
              borderColor: rippleColor,
              boxShadow: `0 0 44px ${rippleColor}`,
              animationDuration: `${rippleSpeed}s`
            } as React.CSSProperties
          }
        />
      ) : null}
    </div>
  );
}
