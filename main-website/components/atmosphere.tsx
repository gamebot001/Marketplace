"use client";

import { useEffect } from "react";

/**
 * Global atmosphere — layered near-black base, warm light field, restrained
 * violet haze, architectural hairlines and fine grain. The cursor gently
 * drives the light via CSS variables (fine pointers only, never React state).
 */
export default function Atmosphere() {
  useEffect(() => {
    const fine = window.matchMedia("(pointer: fine)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!fine || reduced) return;

    const root = document.documentElement;
    let targetX = window.innerWidth * 0.5;
    let targetY = window.innerHeight * 0.38;
    let x = targetX;
    let y = targetY;
    let raf = 0;

    const onMove = (e: PointerEvent) => {
      targetX = e.clientX;
      targetY = e.clientY;
    };

    const tick = (t: number) => {
      x += (targetX - x) * 0.07;
      y += (targetY - y) * 0.07;
      const wobble = Math.sin(t * 0.00011) * 16;
      root.style.setProperty("--mx", `${(x + wobble).toFixed(1)}px`);
      root.style.setProperty("--my", `${(y + wobble * 0.6).toFixed(1)}px`);
      raf = requestAnimationFrame(tick);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    raf = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="atmosphere" aria-hidden="true">
      <div className="a-base" />
      <div className="a-light" />
      <div className="a-cursor" />
      <div className="a-lines" />
      <div className="a-grain" />
    </div>
  );
}
