"use client";

import {
  useEffect,
  useRef,
  type CSSProperties,
  type ElementType,
  type ReactNode,
} from "react";

type RevealProps = {
  as?: ElementType;
  children: ReactNode;
  className?: string;
  /** Stagger delay in seconds. */
  delay?: number;
  threshold?: number;
  id?: string;
};

/**
 * Scroll reveal wrapper. IntersectionObserver adds `is-visible` once; all
 * motion is carried by CSS. Falls back to visible under reduced motion.
 */
export default function Reveal({
  as = "div",
  children,
  className = "",
  delay = 0,
  threshold = 0.18,
  id,
}: RevealProps) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.classList.add("is-visible");
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            el.classList.add("is-visible");
            observer.disconnect();
          }
        }
      },
      { threshold, rootMargin: "0px 0px -8% 0px" }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  const Tag = as as "div";

  return (
    <Tag
      ref={ref as never}
      id={id}
      className={`reveal ${className}`.trim()}
      style={delay ? ({ "--reveal-delay": `${delay}s` } as CSSProperties) : undefined}
    >
      {children}
    </Tag>
  );
}

type MaskLinesProps = {
  as?: ElementType;
  lines: ReactNode[];
  className?: string;
  baseDelay?: number;
  step?: number;
  id?: string;
};

/**
 * Masked line-by-line reveal for display typography. Each line rises out of
 * an overflow-hidden mask as the block enters the viewport.
 */
export function MaskLines({
  as = "h2",
  lines,
  className = "",
  baseDelay = 0,
  step = 0.1,
  id,
}: MaskLinesProps) {
  return (
    <Reveal as={as} className={`mask ${className}`.trim()} id={id}>
      {lines.map((line, i) => (
        <span className="mask" key={i}>
          <span
            className="mask-line"
            style={{ "--reveal-delay": `${baseDelay + i * step}s` } as CSSProperties}
          >
            {line}
          </span>
        </span>
      ))}
    </Reveal>
  );
}
