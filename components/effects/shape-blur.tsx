"use client";

import { useEffect, useRef } from "react";

export function ShapeBlur({
  variation = 0,
  pixelRatioProp = 1,
  shapeSize = 1,
  roundness = 0.5,
  borderSize = 0.05,
  circleSize = 0.25,
  circleEdge = 1
}: {
  variation?: number;
  pixelRatioProp?: number;
  shapeSize?: number;
  roundness?: number;
  borderSize?: number;
  circleSize?: number;
  circleEdge?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pointerRef = useRef({ x: 0.5, y: 0.5 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    let animationFrame = 0;
    let width = 0;
    let height = 0;
    let time = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const ratio = Math.max(1, pixelRatioProp || window.devicePixelRatio || 1);
      width = rect.width;
      height = rect.height;
      canvas.width = width * ratio;
      canvas.height = height * ratio;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };

    const onPointerMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointerRef.current = {
        x: (event.clientX - rect.left) / rect.width,
        y: (event.clientY - rect.top) / rect.height
      };
    };

    const roundedRect = (x: number, y: number, w: number, h: number, r: number) => {
      context.beginPath();
      context.moveTo(x + r, y);
      context.arcTo(x + w, y, x + w, y + h, r);
      context.arcTo(x + w, y + h, x, y + h, r);
      context.arcTo(x, y + h, x, y, r);
      context.arcTo(x, y, x + w, y, r);
      context.closePath();
    };

    const draw = () => {
      time += 0.012;
      context.clearRect(0, 0, width, height);

      const cx = width * (0.5 + (pointerRef.current.x - 0.5) * 0.18);
      const cy = height * (0.48 + (pointerRef.current.y - 0.5) * 0.18);
      const size = Math.min(width, height) * 0.72 * shapeSize;
      const wobble = Math.sin(time + variation) * 16;

      context.save();
      context.filter = "blur(24px)";
      const gradient = context.createRadialGradient(cx, cy, size * circleSize * 0.2, cx, cy, size * circleEdge);
      gradient.addColorStop(0, "rgba(66, 246, 177, 0.28)");
      gradient.addColorStop(0.45, "rgba(255, 107, 87, 0.18)");
      gradient.addColorStop(1, "rgba(155, 124, 255, 0)");
      context.fillStyle = gradient;
      context.fillRect(0, 0, width, height);
      context.restore();

      context.save();
      context.translate(cx, cy);
      context.rotate(Math.sin(time * 0.8) * 0.08);
      context.strokeStyle = "rgba(255, 250, 240, 0.22)";
      context.lineWidth = Math.max(1, size * borderSize);
      context.fillStyle = "rgba(255, 250, 240, 0.035)";
      roundedRect(-size / 2, -size / 2 + wobble, size, size * 0.76, size * roundness * 0.24);
      context.fill();
      context.stroke();
      context.restore();

      animationFrame = window.requestAnimationFrame(draw);
    };

    resize();
    canvas.addEventListener("pointermove", onPointerMove);
    window.addEventListener("resize", resize);
    animationFrame = window.requestAnimationFrame(draw);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      canvas.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("resize", resize);
    };
  }, [borderSize, circleEdge, circleSize, pixelRatioProp, roundness, shapeSize, variation]);

  return <canvas aria-hidden className="absolute inset-0 h-full w-full" ref={canvasRef} />;
}
