"use client";

/**
 * Global atmosphere system.
 *
 * Layered charcoal gradients, slow drifting light sheets, architectural
 * hairlines and fine grain are pure CSS. This component adds exactly one
 * thing: a pointer-following light field and a subtle halo, driven by a
 * single rAF loop scoped to the atmosphere, separate from page/overlay styles.
 *
 * - Fine pointers only; disabled on touch and for reduced motion.
 * - Never replaces the native cursor.
 * - No canvas, no WebGL, no particle system.
 */

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

export function Atmosphere() {
  const pathname = usePathname();
  const atmosphereRef = useRef<HTMLDivElement>(null);
  const haloRef = useRef<HTMLDivElement>(null);
  const enabledRef = useRef(false);

  useEffect(() => {
    /* The homepage renders its own environment (.mk-env). */
    if (pathname === "/") return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const finePointer = window.matchMedia("(pointer: fine)");
    const atmosphere = atmosphereRef.current;
    const halo = haloRef.current;

    const check = () => {
      enabledRef.current = finePointer.matches && !reduced.matches;
      if (halo && !enabledRef.current) {
        halo.dataset.visible = "false";
      }
    };
    check();

    reduced.addEventListener("change", check);
    finePointer.addEventListener("change", check);

    // Raw pointer position (for background light) — updated immediately.
    let rawX = window.innerWidth / 2;
    let rawY = window.innerHeight * 0.4;
    // Lerped position (for the halo) — eased for a weighty, expensive feel.
    let x = rawX;
    let y = rawY;
    let raf = 0;
    let running = false;
    let hasPointer = false;
    let lastFieldX = "";
    let lastFieldY = "";
    let lastHaloTransform = "";

    const tick = () => {
      if (!enabledRef.current || window.location.pathname === "/") {
        running = false;
        hasPointer = false;
        if (halo) halo.dataset.visible = "false";
        return;
      }
      x += (rawX - x) * 0.12;
      y += (rawY - y) * 0.12;

      const fieldX = `${Math.round(rawX)}px`;
      const fieldY = `${Math.round(rawY)}px`;
      if (atmosphere && fieldX !== lastFieldX) {
        atmosphere.style.setProperty("--mx", fieldX);
        lastFieldX = fieldX;
      }
      if (atmosphere && fieldY !== lastFieldY) {
        atmosphere.style.setProperty("--my", fieldY);
        lastFieldY = fieldY;
      }

      if (halo && enabledRef.current) {
        const transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`;
        if (transform !== lastHaloTransform) {
          halo.style.transform = transform;
          lastHaloTransform = transform;
        }
      }

      if (Math.abs(rawX - x) + Math.abs(rawY - y) > 0.35) {
        raf = requestAnimationFrame(tick);
      } else {
        running = false;
      }
    };

    const start = () => {
      if (!running) {
        running = true;
        raf = requestAnimationFrame(tick);
      }
    };

    const onMove = (e: PointerEvent) => {
      if (!enabledRef.current) return;
      /* The homepage supplies its own environment. */
      if (window.location.pathname === "/") return;
      rawX = e.clientX;
      rawY = e.clientY;
      if (!hasPointer) {
        hasPointer = true;
        if (halo) halo.dataset.visible = "true";
        x = rawX;
        y = rawY;
      }
      start();
    };

    window.addEventListener("pointermove", onMove, { passive: true });

    return () => {
      window.removeEventListener("pointermove", onMove);
      reduced.removeEventListener("change", check);
      finePointer.removeEventListener("change", check);
      cancelAnimationFrame(raf);
    };
  }, [pathname]);

  /* The homepage itself supplies the environment (.mk-env). Rendering the
     global atmosphere there is redundant and its large always-on layers
     (a 1.4s animated grain, two blurred drifting lights) saturate the
     compositor on top of the hero's own layers — the page-wide flicker. */
  if (pathname === "/") return null;

  return (
    <>
      <div className="atmosphere" ref={atmosphereRef} aria-hidden="true">
        <div className="atmosphere-field" />
        <div className="atmosphere-light atmosphere-light-a" />
        <div className="atmosphere-light atmosphere-light-b" />
        <div className="atmosphere-lines" />
        <div className="atmosphere-vignette" />
        <div className="atmosphere-grain" />
      </div>
      <div className="cursor-halo" ref={haloRef} data-visible="false" aria-hidden="true" />
    </>
  );
}
