"use client";

import { useState } from "react";

export function BorderGlow({
  children,
  edgeSensitivity = 30,
  glowColor = "40 80 80",
  backgroundColor = "#120F17",
  borderRadius = 8,
  glowRadius = 40,
  glowIntensity = 1,
  coneSpread = 25,
  animated = false,
  colors = ["#c084fc", "#f472b6", "#38bdf8"]
}: {
  children: React.ReactNode;
  edgeSensitivity?: number;
  glowColor?: string;
  backgroundColor?: string;
  borderRadius?: number;
  glowRadius?: number;
  glowIntensity?: number;
  coneSpread?: number;
  animated?: boolean;
  colors?: string[];
}) {
  const [position, setPosition] = useState({ x: 50, y: 50, nearEdge: false, hovering: false });
  const rgbGlow = glowColor.includes(",") ? glowColor : glowColor.trim().split(/\s+/).join(", ");
  const glowVisible = animated || position.hovering;
  const borderVisible = animated || position.nearEdge;

  return (
    <div
      className="border-glow-shell"
      onMouseLeave={() => setPosition((current) => ({ ...current, hovering: false, nearEdge: false }))}
      onMouseMove={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width) * 100;
        const y = ((event.clientY - rect.top) / rect.height) * 100;
        const nearEdge =
          event.clientX - rect.left < edgeSensitivity ||
          rect.right - event.clientX < edgeSensitivity ||
          event.clientY - rect.top < edgeSensitivity ||
          rect.bottom - event.clientY < edgeSensitivity;
        setPosition({ x, y, nearEdge, hovering: true });
      }}
      style={
        {
          borderRadius,
          background: backgroundColor,
          "--glow-x": `${position.x}%`,
          "--glow-y": `${position.y}%`,
          "--glow-radius": `${glowRadius}px`,
          "--glow-opacity": glowVisible ? glowIntensity : 0,
          "--border-opacity": borderVisible ? 1 : 0.18,
          "--cone-spread": `${coneSpread}deg`,
          "--glow-rgb": rgbGlow,
          "--border-gradient": `conic-gradient(from ${coneSpread}deg at ${position.x}% ${position.y}%, ${colors.join(", ")}, ${colors[0]})`
        } as React.CSSProperties
      }
    >
      <div className="border-glow-content" style={{ borderRadius: Math.max(borderRadius - 1, 0) }}>
        {children}
      </div>
    </div>
  );
}
