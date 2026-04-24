"use client";

import { useEffect, useRef } from "react";

type Star = {
  angle: number;
  distance: number;
  size: number;
  speed: number;
  alpha: number;
  twinkle: number;
};

export function Galaxy({
  mouseRepulsion = true,
  mouseInteraction = true,
  density = 1,
  glowIntensity = 0.3,
  saturation = 0,
  hueShift = 140,
  twinkleIntensity = 0.3,
  rotationSpeed = 0.1,
  repulsionStrength = 2,
  autoCenterRepulsion = 0,
  starSpeed = 0.5,
  speed = 1
}: {
  mouseRepulsion?: boolean;
  mouseInteraction?: boolean;
  density?: number;
  glowIntensity?: number;
  saturation?: number;
  hueShift?: number;
  twinkleIntensity?: number;
  rotationSpeed?: number;
  repulsionStrength?: number;
  autoCenterRepulsion?: number;
  starSpeed?: number;
  speed?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mouseRef = useRef({ x: 0, y: 0, active: false });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    let animationFrame = 0;
    let width = 0;
    let height = 0;
    let stars: Star[] = [];

    const createStars = () => {
      const count = Math.floor(Math.max(width, height) * 0.48 * density);
      stars = Array.from({ length: count }, () => ({
        angle: Math.random() * Math.PI * 2,
        distance: Math.pow(Math.random(), 0.58) * Math.max(width, height) * 0.62,
        size: Math.random() * 1.7 + 0.35,
        speed: (Math.random() * 0.4 + 0.2) * starSpeed,
        alpha: Math.random() * 0.72 + 0.18,
        twinkle: Math.random() * Math.PI * 2
      }));
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const scale = window.devicePixelRatio || 1;
      width = rect.width;
      height = rect.height;
      canvas.width = width * scale;
      canvas.height = height * scale;
      context.setTransform(scale, 0, 0, scale, 0, 0);
      createStars();
    };

    const onPointerMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
        active: true
      };
    };

    const onPointerLeave = () => {
      mouseRef.current.active = false;
    };

    const draw = (time: number) => {
      const centerX = width * 0.5;
      const centerY = height * 0.48;
      context.clearRect(0, 0, width, height);

      const coreGlow = context.createRadialGradient(centerX, centerY, 0, centerX, centerY, Math.max(width, height) * 0.58);
      coreGlow.addColorStop(0, `hsla(${hueShift}, ${saturation + 58}%, 62%, ${0.16 * glowIntensity})`);
      coreGlow.addColorStop(0.38, `hsla(${hueShift + 40}, ${saturation + 48}%, 54%, ${0.1 * glowIntensity})`);
      coreGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
      context.fillStyle = coreGlow;
      context.fillRect(0, 0, width, height);

      for (const star of stars) {
        star.angle += 0.00014 * rotationSpeed * speed + 0.00008 * star.speed;
        star.twinkle += 0.025 * speed;

        const spiral = star.distance * 0.0025;
        const x = centerX + Math.cos(star.angle + spiral) * star.distance * 1.18;
        const y = centerY + Math.sin(star.angle + spiral) * star.distance * 0.42;

        let drawX = x;
        let drawY = y;

        if (mouseInteraction && mouseRepulsion && mouseRef.current.active) {
          const dx = x - mouseRef.current.x;
          const dy = y - mouseRef.current.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const force = Math.max(0, 1 - distance / 170) * repulsionStrength * 24;
          if (distance > 0) {
            drawX += (dx / distance) * force;
            drawY += (dy / distance) * force;
          }
        }

        if (autoCenterRepulsion > 0) {
          const dx = x - centerX;
          const dy = y - centerY;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance > 0) {
            drawX += (dx / distance) * autoCenterRepulsion;
            drawY += (dy / distance) * autoCenterRepulsion;
          }
        }

        const twinkle = 1 + Math.sin(star.twinkle + time * 0.001) * twinkleIntensity;
        const alpha = Math.min(1, star.alpha * twinkle);
        context.beginPath();
        context.fillStyle = `hsla(${hueShift + star.distance * 0.03}, ${saturation + 55}%, 82%, ${alpha})`;
        context.shadowColor = `hsla(${hueShift}, ${saturation + 80}%, 70%, ${glowIntensity})`;
        context.shadowBlur = 10 * glowIntensity;
        context.arc(drawX, drawY, star.size * twinkle, 0, Math.PI * 2);
        context.fill();
      }

      animationFrame = window.requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener("resize", resize);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerleave", onPointerLeave);
    animationFrame = window.requestAnimationFrame(draw);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerleave", onPointerLeave);
    };
  }, [
    autoCenterRepulsion,
    density,
    glowIntensity,
    hueShift,
    mouseInteraction,
    mouseRepulsion,
    repulsionStrength,
    rotationSpeed,
    saturation,
    speed,
    starSpeed,
    twinkleIntensity
  ]);

  return <canvas aria-hidden className="absolute inset-0 h-full w-full" ref={canvasRef} />;
}
