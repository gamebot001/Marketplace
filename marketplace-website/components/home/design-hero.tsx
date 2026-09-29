"use client";

import { memo, useCallback, useEffect, useRef } from "react";
import { ArrowLeft, ArrowRight, BadgeCheck } from "lucide-react";
import styles from "./design-hero.module.css";

/*
 * Identity mapping — original local PFP files only, one project per slot.
 * The collection PFP is the main visual of each hero card.
 */

const COLLECTIONS = [
  { slug: "claynosaurz", name: "Claynosaurz", pfp: "/demo-marketplace/claynosaurz/pfp.avif" },
  { slug: "mad-lads", name: "Mad Lads", pfp: "/demo-marketplace/mad-lads/pfp.avif" },
  { slug: "degods", name: "DeGods", pfp: "/demo-marketplace/degods/pfp.avif" },
  { slug: "dga", name: "DGA", pfp: "/demo-marketplace/dga/pfp.avif" },
];

const COUNT = COLLECTIONS.length;
const DURATION = 950;
const SETTLE_MS = 100;
const AUTOPLAY_MS = 6500;
const PERSPECTIVE = 1600;
type Direction = -1 | 1;

const ease = (() => {
  const x1 = 0.16;
  const y1 = 0.82;
  const x2 = 0.18;
  const y2 = 1;
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sampleDX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i += 1) {
      const err = sampleX(t) - x;
      if (Math.abs(err) < 1e-5) break;
      const d = sampleDX(t);
      if (Math.abs(d) < 1e-6) break;
      t -= err / d;
    }
    return sampleY(t);
  };
})();

const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};

const wrapA = (raw: number) => {
  const m = ((raw % 4) + 4) % 4;
  return m > 2 ? m - 4 : m;
};

/*
 * Arc positions (fitted exactly to the spec keyframes):
 *   a =  0 : x    0   z  120  ry   0  s 1.00  (center)
 *   a =  1 : x  230   z  -40  ry -11  s 0.86  (right near)
 *   a = -1 : x -230   z  -40  ry  11  s 0.86  (left near)
 *   a =  2 : x  420   z -170  ry -18  s 0.70  (far right)
 *   a = -2 : x -420   z -170  ry  18  s 0.70  (far left)
 */
const depthOf = (a: number, f: number) => {
  const aa = Math.abs(a);
  return {
    x: f * (250 * a - 20 * a * aa),
    z: 120 - 175 * aa + 15 * a * a,
    ry: -(13 * a - 2 * a * aa),
    s: 1 - 0.13 * aa - 0.01 * a * a,
  };
};

const staticStyleFor = (offset: number) => {
  const a = offset === 2 ? 2 : offset === 3 ? -1 : offset;
  const d = depthOf(a, 1);
  return {
    transform: `translate3d(${d.x.toFixed(2)}px, 0px, ${d.z.toFixed(
      2
    )}px) rotateY(${d.ry.toFixed(2)}deg) scale(${d.s.toFixed(3)})`,
    opacity: (1 - smoothstep(1.22, 1.94, Math.abs(a))).toFixed(2),
  };
};

const INITIAL_CARD_STYLE = COLLECTIONS.map((_, i) => staticStyleFor(i));

/*
 * ROLE ASSIGNMENT — imperative, never via React state.
 *
 * The card roles (active / side / far) drive the amber rim, shadows and
 * pointer permissions. Deriving them from React state re-renders the card
 * subtree mid-transition and re-applies class names — which is exactly what
 * made rapid Next/Previous clicks flicker (stale class vs fresh transform).
 * Instead the roles live in data attributes written change-only from the
 * navigation handlers and the render loop.
 */
const ROLE_ACTIVE = "active";
const ROLE_SIDE = "side";
const ROLE_FAR = "far";

const roleForAngle = (a: number): string => {
  const aa = Math.abs(a);
  if (aa < 0.25) return ROLE_ACTIVE;
  if (aa < 1.5) return ROLE_SIDE;
  return ROLE_FAR;
};

/** Initial role for a card's mount index (matches staticStyleFor mapping). */
const staticAngleForIndex = (i: number) =>
  i === 2 ? 2 : i === 3 ? -1 : i;

/* Deterministic dust motes — no randomness to avoid hydration mismatch. */
const MOTES = [
  { left: "14%", top: "56%", size: 2.5, dur: "17s", delay: "-2s", dx: "34px", rise: "-130px", op: 0.38 },
  { left: "26%", top: "76%", size: 2, dur: "21s", delay: "-8s", dx: "-26px", rise: "-150px", op: 0.3 },
  { left: "38%", top: "64%", size: 3, dur: "19s", delay: "-13s", dx: "40px", rise: "-120px", op: 0.42 },
  { left: "52%", top: "82%", size: 2, dur: "23s", delay: "-5s", dx: "-38px", rise: "-140px", op: 0.3 },
  { left: "63%", top: "58%", size: 2.5, dur: "16s", delay: "-11s", dx: "28px", rise: "-125px", op: 0.4 },
  { left: "77%", top: "74%", size: 3, dur: "20s", delay: "-16s", dx: "-30px", rise: "-135px", op: 0.34 },
  { left: "88%", top: "52%", size: 2, dur: "18s", delay: "-7s", dx: "24px", rise: "-145px", op: 0.3 },
];

/**
 * Approved hero — the exact /design-preview implementation, shared by the
 * marketplace homepage (/) and the temporary /design-preview reference route.
 *
 * variant="preview" — the approved full-screen takeover (badge, fixed stage).
 * variant="home"    — the identical hero embedded in the homepage page flow
 *                     beneath the marketplace chrome. Only positioning is
 *                     overridden (.viewportHome in the CSS module); no
 *                     approved visual value is altered.
 */
export const DesignHero = memo(function DesignHero({
  variant = "preview",
}: {
  variant?: "preview" | "home";
}) {
  const activeRef = useRef(0);
  const announceRef = useRef<HTMLParagraphElement>(null);
  const ring = useRef({
    r: 0,
    anim: null as null | { from: number; to: number; start: number },
    settleStart: 0,
  });
  const pendingDirection = useRef<Direction | null>(null);

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<(HTMLElement | null)[]>([]);
  const innerRefs = useRef<(HTMLDivElement | null)[]>([]);
  const veilRefs = useRef<(HTMLDivElement | null)[]>([]);
  const reflectionRef = useRef<HTMLDivElement | null>(null);
  const bloomRef = useRef<HTMLDivElement | null>(null);

  const pointer = useRef({ x: 0, y: 0, inside: false });
  const sceneHover = useRef(false);
  const dragging = useRef(false);
  /* Wakes the render loop when it has fully settled (see the main effect). */
  const wakeRef = useRef<(() => void) | null>(null);
  const measureRef = useRef<(() => void) | null>(null);
  const drag = useRef({
    startX: 0,
    startR: 0,
    startSlot: 0,
    lastX: 0,
    lastT: 0,
    vel: 0,
    moved: false,
  });
  const nextFire = useRef(0);
  const oxf = useRef(1);
  /* Autoplay rolls freeze the environment layers; manual interaction unfreezes. */
  const envFreeze = useRef(false);
  const tilt = useRef(
    COLLECTIONS.map(() => ({ tx: 0, ty: 0, hz: 0, hy: 0, px: 0, py: 0 }))
  );
  const ambient = useRef({ x: 0, y: 0, tx: 0, ty: 0 });
  const focusX = useRef(0);
  const prevAa = useRef<number[]>([0, 1, 2, 1]);
  const lastBlur = useRef<string[]>(COLLECTIONS.map(() => ""));

  const announce = useCallback((index: number) => {
    const el = announceRef.current;
    if (el) {
      el.textContent = `${COLLECTIONS[index].name} — collection ${
        index + 1
      } of ${COUNT}`;
    }
  }, []);

  /* Every input uses this entry point. A running slide owns its complete
     tween and settle phase, including the card-role handoff. */
  const beginTransition = useCallback(
    (target: number, freezeEnvironment = false) => {
      const st = ring.current;
      if (st.anim || st.settleStart) return;
      envFreeze.current = freezeEnvironment;
      if (Math.abs(target - st.r) > 0.5) {
        st.anim = { from: st.r, to: target, start: performance.now() };
      } else {
        st.r = target;
        measureRef.current?.();
      }
      const next = (((-target / 90) % COUNT) + COUNT) % COUNT;
      if (next !== activeRef.current) {
        activeRef.current = next;
        announce(next);
      }
      /* Roles flip to the target arrangement at transition START so the
         amber rim hands over immediately (950ms border/shadow crossfade),
         exactly as the approved behavior did via state. */
      for (let i = 0; i < COUNT; i += 1) {
        const el = cardRefs.current[i];
        if (!el) continue;
        const role = roleForAngle(wrapA(i + target / 90));
        if (el.dataset.role !== role) el.dataset.role = role;
      }
      nextFire.current = Date.now() + AUTOPLAY_MS;
      wakeRef.current?.();
    },
    [announce]
  );

  const goTo = useCallback(
    (dir: Direction, opts?: { envFreeze?: boolean }) => {
      if (dragging.current) return;
      const st = ring.current;
      if (st.anim || st.settleStart) {
        // Coalesce a burst into one latest intent, rather than restarting
        // lift/easing/roles or accumulating a multi-revolution destination.
        if (!opts?.envFreeze) {
          pendingDirection.current = dir;
          nextFire.current = Date.now() + AUTOPLAY_MS;
        }
        return;
      }
      beginTransition(Math.round(st.r / 90) * 90 - dir * 90, opts?.envFreeze);
    },
    [beginTransition]
  );

  /* Autoplay — exactly 6.5s cadence, pause on hover / hidden tab,
     reset after any manual navigation, disabled for reduced motion.
     Direction: LEFT → RIGHT — the incoming collection enters from the left
     slot and travels into the center; the outgoing card exits to the right.
     Manual ←/→ controls are independent of this direction. */
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    nextFire.current = Date.now() + AUTOPLAY_MS;
    const id = setInterval(() => {
      const now = Date.now();
      if (document.hidden) {
        nextFire.current = now + AUTOPLAY_MS;
        return;
      }
      if (sceneHover.current || dragging.current) {
        nextFire.current = now + 1500;
        return;
      }
      /* Any open overlay (wallet / search / notifications / drawer) freezes
         the environment beneath it. Never slide the carousel under an open
         overlay — that put an always-animating 3D stage behind a translucent
         scrim and read as overlay/page flicker. */
      if (document.documentElement.hasAttribute("data-overlay-open")) {
        nextFire.current = now + AUTOPLAY_MS;
        return;
      }
      if (ring.current.anim || ring.current.settleStart || pendingDirection.current != null) return;
      if (now < nextFire.current) return;
      goTo(-1, { envFreeze: true });
    }, 200);
    return () => clearInterval(id);
  }, [goTo]);

  useEffect(() => {
    const fine = window.matchMedia("(pointer: fine)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)")
      .matches;
    const viewport = viewportRef.current;
    const scene = sceneRef.current;
    if (!viewport || !scene) return;

    const readOxf = () => {
      const v = parseFloat(
        window.getComputedStyle(viewport).getPropertyValue("--oxf")
      );
      oxf.current = Number.isFinite(v) && v > 0 ? v : 1;
    };
    readOxf();

    /* Geometry is measured on entry, resize, scroll and after settling.
       The animation loop only consumes cached geometry and writes styles. */
    let viewportWidth = window.innerWidth;
    let viewportHeight = window.innerHeight;
    let sceneLeft = 0;
    let sceneWidth = 1;
    const measureScene = () => {
      const r = scene.getBoundingClientRect();
      sceneLeft = r.left;
      sceneWidth = r.width || 1;
    };
    measureScene();

    const cardRects: (DOMRect | null)[] = COLLECTIONS.map(() => null);
    let rectsDirty = true;
    const refreshRects = () => {
      for (let i = 0; i < COUNT; i += 1) {
        const el = innerRefs.current[i];
        cardRects[i] = el ? el.getBoundingClientRect() : null;
      }
      rectsDirty = false;
    };

    let measurementRaf = 0;
    const queueMeasurements = () => {
      rectsDirty = true;
      if (measurementRaf) return;
      measurementRaf = requestAnimationFrame(() => {
        measurementRaf = 0;
        measureScene();
        if (!ring.current.anim && !ring.current.settleStart && !dragging.current) {
          refreshRects();
        }
        wake();
      });
    };
    measureRef.current = queueMeasurements;

    let raf = 0;
    let running = false;
    let prevNow = performance.now();
    let prevR = ring.current.r;
    let lastNavX = "";
    let lastAmbX = "";
    let lastAmbY = "";
    let lastFocusX = "";
    let lastFocusVx = "";
    let lastReflT = "";
    let lastReflO = "";
    let lastBloomT = "";
    const lastCardT: string[] = new Array(COUNT).fill("");
    const lastCardO: string[] = new Array(COUNT).fill("");
    const lastVeil: string[] = new Array(COUNT).fill("");
    const lastTilt: string[][] = COLLECTIONS.map(() => [
      "",
      "",
      "",
      "",
      "",
      "",
    ]);

    const tick = () => {
      const now = performance.now();
      const dt = Math.max(1, now - prevNow);
      const st = ring.current;

      if (!st.anim && st.settleStart && now - st.settleStart >= SETTLE_MS) {
        st.settleStart = 0;
        const queued = pendingDirection.current;
        pendingDirection.current = null;
        if (queued != null) goTo(queued);
        else queueMeasurements();
      }

      let liftK = 0;
      let animating = false;
      if (st.anim) {
        animating = true;
        const t = clamp((now - st.anim.start) / (reduced ? 1 : DURATION), 0, 1);
        const e = ease(t);
        st.r = st.anim.from + (st.anim.to - st.anim.from) * e;
        /* forward push first, decaying as the card travels around the arc */
        liftK = reduced ? 0 : Math.sin(Math.PI * Math.min(t / 0.5, 1)) * (1 - e);
        if (t >= 1) {
          st.anim = null;
          st.settleStart = now;
          rectsDirty = true;
          animating = false;
        }
      }

      const settleK = st.settleStart
        ? Math.max(0, 1 - (now - st.settleStart) / SETTLE_MS)
        : 0;
      if (!settleK) st.settleStart = 0;

      const vel = (st.r - prevR) / dt;
      const velK = reduced ? 0 : Math.min(1, Math.abs(vel) / 0.2);

      const dev = st.r - Math.round(st.r / 90) * 90;
      if (!st.anim && !envFreeze.current) {
        const navX = clamp(-dev * 0.16, -18, 18).toFixed(2);
        if (navX !== lastNavX) {
          viewport.style.setProperty("--nav-x", navX);
          lastNavX = navX;
        }
      }

      let ambientSettled = true;
      if (fine && !reduced) {
        const atx = pointer.current.inside
          ? (pointer.current.x / viewportWidth - 0.5) * 2
          : 0;
        const aty = pointer.current.inside
          ? (pointer.current.y / viewportHeight - 0.5) * 2
          : 0;
        const amb = ambient.current;
        amb.x = lerp(amb.x, atx, 0.045);
        amb.y = lerp(amb.y, aty, 0.045);
        const ax = amb.x.toFixed(4);
        const ay = amb.y.toFixed(4);
        if (ax !== lastAmbX) {
          viewport.style.setProperty("--amb-x", ax);
          lastAmbX = ax;
        }
        if (ay !== lastAmbY) {
          viewport.style.setProperty("--amb-y", ay);
          lastAmbY = ay;
        }
        if (Math.abs(amb.x - atx) + Math.abs(amb.y - aty) > 0.002)
          ambientSettled = false;
      }

      const f = oxf.current;
      const angles: number[] = new Array(COUNT);
      let bestI = 0;
      let bestAbs = Infinity;
      for (let i = 0; i < COUNT; i += 1) {
        const a = wrapA(i + st.r / 90);
        angles[i] = a;
        const abs = Math.abs(a);
        if (abs < bestAbs) {
          bestAbs = abs;
          bestI = i;
        }
      }

      /* Role self-heal — while settled (never mid-tween, so the rim never
         flickers back and forth) re-derive roles from the live ring angle.
         Covers drag release and any drift between handler-predicted roles. */
      if (!st.anim) {
        for (let i = 0; i < COUNT; i += 1) {
          const el = cardRefs.current[i];
          if (!el) continue;
          const role = roleForAngle(angles[i]);
          if (el.dataset.role !== role) el.dataset.role = role;
        }
      }

      let moving = animating || settleK > 0;

      for (let i = 0; i < COUNT; i += 1) {
        const card = cardRefs.current[i];
        if (!card) continue;
        const a = angles[i];
        const aa = Math.abs(a);
        const d = depthOf(a, f);
        const y = -10 * liftK + 1.8 * settleK;
        const z = d.z + 26 * liftK - 5 * settleK;
        const rx = Math.max(0, 1 - Math.abs(aa - 1)) - 1.4 * liftK;
        const t = `translate3d(${d.x.toFixed(2)}px, ${y.toFixed(
          2
        )}px, ${z.toFixed(2)}px) rotateY(${d.ry.toFixed(3)}deg) rotateX(${rx.toFixed(
          3
        )}deg) scale(${d.s.toFixed(4)})`;
        if (t !== lastCardT[i]) {
          card.style.transform = t;
          lastCardT[i] = t;
        }
        const o = (1 - smoothstep(1.22, 1.94, aa)).toFixed(3);
        if (o !== lastCardO[i]) {
          card.style.opacity = o;
          lastCardO[i] = o;
        }

        /* rolling depth — outgoing card blurs + dims, incoming stays sharp.
           The blur is quantized to 0.5px steps: each distinct filter value
           re-rasterizes the card inner, so per-frame values meant ~57
           full re-rasters per slide (the mid-slide card/bloom flicker).
           0.5px steps are visually identical at this scale. */
        const delta = aa - prevAa.current[i];
        prevAa.current[i] = aa;
        const outgoing = delta > 0.0006;
        const zoneK = smoothstep(0.2, 0.85, aa);
        const blurPx = outgoing
          ? Math.round(velK * zoneK * 3.2 * 2) / 2
          : 0;

        const inner = innerRefs.current[i];
        if (inner) {
          const blur = blurPx > 0 ? `blur(${blurPx.toFixed(2)}px)` : "";
          if (blur !== lastBlur.current[i]) {
            inner.style.filter = blur;
            lastBlur.current[i] = blur;
          }
        }
        const veil = veilRefs.current[i];
        if (veil) {
          const v = (outgoing ? velK * zoneK * 0.34 : 0).toFixed(3);
          if (v !== lastVeil[i]) {
            veil.style.opacity = v;
            lastVeil[i] = v;
          }
        }
      }

      /* Keep the environment's focus steady during the transition.
         Residual focus movement settles independently of queued inputs. */
      if (!st.anim && !envFreeze.current) {
        const fd = depthOf(angles[bestI], f);
        const persp = PERSPECTIVE / (PERSPECTIVE - Math.max(fd.z, -600));
        focusX.current = lerp(focusX.current, fd.x * persp, 0.16);
        if (Math.abs(focusX.current - fd.x * persp) > 0.05) moving = true;
        const fx = focusX.current.toFixed(2);
        if (fx !== lastFocusX) {
          viewport.style.setProperty("--focus-x", `${fx}px`);
          lastFocusX = fx;
        }
        const fvx = (sceneLeft + sceneWidth / 2 + focusX.current).toFixed(1);
        if (fvx !== lastFocusVx) {
          viewport.style.setProperty("--focus-vx", `${fvx}px`);
          lastFocusVx = fvx;
        }

        const refl = reflectionRef.current;
        if (refl) {
          const rt = `translateX(calc(-50% + ${fx}px)) scaleX(${(
            1 +
            velK * 0.16
          ).toFixed(3)})`;
          if (rt !== lastReflT) {
            refl.style.transform = rt;
            lastReflT = rt;
          }
          const ro = (0.9 * (1 - velK * 0.3)).toFixed(3);
          if (ro !== lastReflO) {
            refl.style.opacity = ro;
            lastReflO = ro;
          }
        }
        const bloom = bloomRef.current;
        if (bloom) {
          const bt = `translate3d(${fx}px, 0, 0) scale(${(
            1 +
            velK * 0.06
          ).toFixed(3)})`;
          if (bt !== lastBloomT) {
            bloom.style.transform = bt;
            lastBloomT = bt;
          }
        }
      }

      /*
       * Pointer tilt + cursor light — applied ONLY to the inner visual
       * wrapper (never the carousel positioning element), driven by cached
       * rects, lerped targets and change-only writes. Skipped entirely on
       * touch / coarse pointers and while the ring is travelling.
       */
      let tiltSettled = true;
      const hoverActive =
        fine && !reduced && pointer.current.inside && !dragging.current && !rectsDirty;
      let hovered = -1;
      if (hoverActive && !animating && !settleK) {
        for (let i = 0; i < COUNT; i += 1) {
          const r = cardRects[i];
          if (
            r &&
            pointer.current.x >= r.left &&
            pointer.current.x <= r.right &&
            pointer.current.y >= r.top &&
            pointer.current.y <= r.bottom
          ) {
            hovered = i;
            break;
          }
        }
      }
      for (let i = 0; i < COUNT; i += 1) {
        const el = innerRefs.current[i];
        if (!el) continue;
        const t = tilt.current[i];
        const r = cardRects[i];
        const isHover = hovered === i && r != null;
        let ttx = 0;
        let tty = 0;
        let thz = 0;
        let thy = 0;
        if (isHover && r) {
          if (t.px === 0 && t.py === 0) {
            t.px = pointer.current.x - r.left;
            t.py = pointer.current.y - r.top;
          }
          t.px = lerp(t.px, pointer.current.x - r.left, 0.3);
          t.py = lerp(t.py, pointer.current.y - r.top, 0.3);
          if (i === activeRef.current) {
            const nx = clamp((pointer.current.x - r.left) / r.width, 0, 1);
            const ny = clamp((pointer.current.y - r.top) / r.height, 0, 1);
            tty = clamp((nx - 0.5) * 8, -4, 4);
            ttx = clamp((0.5 - ny) * 4, -2, 2);
            thz = 8;
            thy = -3;
          }
        }
        t.tx = lerp(t.tx, ttx, 0.14);
        t.ty = lerp(t.ty, tty, 0.14);
        t.hz = lerp(t.hz, thz, 0.14);
        t.hy = lerp(t.hy, thy, 0.14);
        const vals = [t.tx, t.ty, t.hz, t.hy, t.px, t.py];
        const names = ["--tx", "--ty", "--hz", "--hy", "--mx", "--my"];
        const units = ["deg", "deg", "px", "px", "px", "px"];
        const digits = [3, 3, 2, 2, 1, 1];
        for (let k = 0; k < 6; k += 1) {
          const s = vals[k].toFixed(digits[k]);
          if (s !== lastTilt[i][k]) {
            el.style.setProperty(names[k], `${s}${units[k]}`);
            lastTilt[i][k] = s;
          }
        }
        if (
          Math.abs(t.tx - ttx) > 0.01 ||
          Math.abs(t.ty - tty) > 0.01 ||
          Math.abs(t.hz - thz) > 0.05 ||
          Math.abs(t.hy - thy) > 0.05
        )
          tiltSettled = false;
      }

      prevR = st.r;
      prevNow = now;

      /* Fully settled → stop the loop. No idle writes, no idle compositing. */
      if (
        !st.anim &&
        !settleK &&
        !dragging.current &&
        ambientSettled &&
        tiltSettled &&
        !moving
      ) {
        running = false;
        return;
      }
      raf = requestAnimationFrame(tick);
    };

    const wake = () => {
      if (running) return;
      running = true;
      prevNow = performance.now();
      raf = requestAnimationFrame(tick);
    };
    wakeRef.current = wake;

    const onResize = () => {
      readOxf();
      viewportWidth = window.innerWidth;
      viewportHeight = window.innerHeight;
      queueMeasurements();
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", queueMeasurements, { passive: true });
    viewport.addEventListener("scroll", queueMeasurements, { passive: true });

    wake();
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", queueMeasurements);
      viewport.removeEventListener("scroll", queueMeasurements);
      cancelAnimationFrame(raf);
      cancelAnimationFrame(measurementRaf);
      wakeRef.current = null;
      measureRef.current = null;
    };
  }, [goTo]);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    // A pointer press cannot cancel an authoritative slide or its settle.
    if (ring.current.anim || ring.current.settleStart || dragging.current) return;
    envFreeze.current = false;
    wakeRef.current?.();
    dragging.current = true;
    drag.current.startX = e.clientX;
    drag.current.startR = ring.current.r;
    drag.current.startSlot = Math.round(ring.current.r / 90) * 90;
    drag.current.lastX = e.clientX;
    drag.current.lastT = performance.now();
    drag.current.vel = 0;
    drag.current.moved = false;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    pointer.current.x = e.clientX;
    pointer.current.y = e.clientY;
    pointer.current.inside = true;
    wakeRef.current?.();
    if (!dragging.current) return;
    const now = performance.now();
    const dt = Math.max(1, now - drag.current.lastT);
    drag.current.vel = lerp(
      drag.current.vel,
      (e.clientX - drag.current.lastX) / dt,
      0.35
    );
    drag.current.lastX = e.clientX;
    drag.current.lastT = now;
    const dx = e.clientX - drag.current.startX;
    if (Math.abs(dx) > 8) drag.current.moved = true;
    const base = drag.current.startR - drag.current.startSlot;
    ring.current.r =
      drag.current.startSlot + clamp(base + dx * 0.3, -140, 140);
  };

  const endDrag = () => {
    if (!dragging.current) return;
    dragging.current = false;
    envFreeze.current = false;
    const st = ring.current;
    const flung = Math.abs(drag.current.vel) > 0.5;
    const base = Math.round(st.r / 90);
    const target = flung
      ? (base + (drag.current.vel < 0 ? -1 : 1)) * 90
      : base * 90;
    beginTransition(target);
  };

  const onSceneEnter = (e: React.PointerEvent<HTMLDivElement>) => {
    sceneHover.current = true;
    pointer.current.x = e.clientX;
    pointer.current.y = e.clientY;
    pointer.current.inside = true;
    measureRef.current?.();
    wakeRef.current?.();
  };

  const onSceneLeave = () => {
    sceneHover.current = false;
    pointer.current.inside = false;
    wakeRef.current?.();
  };

  /* Click a side card to roll it toward center. The offset is derived from
     the live ring position — never from React state — so rapid interactions
     stay in sync with the authoritative transition. */
  const onCardClick = (i: number) => {
    if (drag.current.moved) return;
    const a = wrapA(i + ring.current.r / 90);
    if (a === 1) goTo(1);
    else if (a === -1) goTo(-1);
  };

  return (
    <div
      className={
        variant === "home"
          ? `${styles.viewport} ${styles.viewportHome}`
          : styles.viewport
      }
      ref={viewportRef}
    >
      <div className={styles.bg} aria-hidden="true">
        <div className={styles.bgDriftA}>
          <div className={styles.lightSource} />
        </div>
        <div className={styles.bgDriftB}>
          <div className={styles.violetFill} />
        </div>
        <div className={styles.haze} />
        <div className={styles.hazeFocusTrack}>
          <div className={styles.hazeFocus} />
        </div>
        <div className={styles.floor}>
          <div className={styles.floorGlow} />
        </div>
        <div className={styles.motes}>
          {MOTES.map((m, i) => (
            <span
              key={i}
              style={
                {
                  left: m.left,
                  top: m.top,
                  width: `${m.size}px`,
                  height: `${m.size}px`,
                  "--mdur": m.dur,
                  "--mdelay": m.delay,
                  "--mdx": m.dx,
                  "--mrise": m.rise,
                  "--mop": m.op,
                } as React.CSSProperties
              }
            />
          ))}
        </div>
        <div className={styles.vignette} />
        <div className={styles.grain} />
      </div>

      {variant === "preview" && (
        <div className={styles.badge}>DESIGN PREVIEW · TEMPORARY ROUTE</div>
      )}

      <div className={styles.shell}>
        <section className={styles.hero}>
          <div className={styles.copy}>
            <span className={styles.eyebrow}>NFT Marketplace on Solana</span>
            <h1 className={styles.headline}>
              <span>Discover</span>
              <span>Collect</span>
              <span className={styles.trade}>Trade</span>
            </h1>
            <p className={styles.sub}>
              A modern NFT marketplace for creators, collectors and communities
              on Solana.
            </p>
            <div className={styles.actions}>
              <a className={styles.btnPrimary} href="/collections">
                Explore Collections <span aria-hidden="true">→</span>
              </a>
            </div>
          </div>

          <div className={styles.stageCol}>
            <div
              className={styles.carouselWrap}
              onPointerEnter={onSceneEnter}
              onPointerLeave={onSceneLeave}
              onKeyDown={(e) => {
                if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
                if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                  e.preventDefault();
                  goTo(e.key === "ArrowRight" ? 1 : -1);
                }
              }}
            >
              <button
                type="button"
                className={`${styles.ctrlBtn} ${styles.ctrlPrev}`}
                onClick={() => goTo(-1)}
                aria-label="Previous collection"
              >
                <ArrowLeft size={15} strokeWidth={1.75} />
              </button>

              <div
                className={styles.scene}
                ref={sceneRef}
                role="region"
                aria-roledescription="carousel"
                aria-label="Featured collections carousel"
                tabIndex={0}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                onLostPointerCapture={endDrag}
              >
              <div className={styles.orbitLines} aria-hidden="true">
                <span className={styles.orbitLineOuter} />
                <span className={styles.orbitLineInner} />
              </div>
              <div className={styles.reflection} ref={reflectionRef} aria-hidden="true" />
              <div className={styles.cardBloom} ref={bloomRef} aria-hidden="true" />
              <div className={styles.stage}>
                <div className={styles.disc} aria-hidden="true" />
                {COLLECTIONS.map((c, i) => {
                  return (
                    <article
                      key={c.slug}
                      className={styles.card}
                      data-role={roleForAngle(staticAngleForIndex(i))}
                      style={INITIAL_CARD_STYLE[i]}
                      ref={(el) => {
                        cardRefs.current[i] = el;
                      }}
                      onClick={() => onCardClick(i)}
                    >
                      <div
                        className={styles.cardInner}
                        ref={(el) => {
                          innerRefs.current[i] = el;
                        }}
                      >
                        <div className={styles.pfpWrap}>
                          <img
                            className={styles.cardPfp}
                            src={c.pfp}
                            alt={`${c.name} collection PFP`}
                            width={480}
                            height={480}
                            loading="eager"
                            draggable={false}
                          />
                          <div
                            className={styles.veil}
                            ref={(el) => {
                              veilRefs.current[i] = el;
                            }}
                          />
                        </div>
                        <div className={styles.cardFoot}>
                          <span className={styles.cardName}>
                            {c.name}
                            <BadgeCheck
                              size={14}
                              className={styles.verified}
                              strokeWidth={2.4}
                            />
                          </span>
                        </div>
                      </div>
                    </article>
                  );
                 })}
               </div>
              </div>

              <button
                type="button"
                className={`${styles.ctrlBtn} ${styles.ctrlNext}`}
                onClick={() => goTo(1)}
                aria-label="Next collection"
              >
                <ArrowRight size={15} strokeWidth={1.75} />
              </button>
            </div>
          </div>
        </section>
      </div>

      <p className={styles.srOnly} aria-live="polite" ref={announceRef} />
    </div>
  );
});
