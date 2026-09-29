"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { MARKETPLACE_URL } from "@/lib/config";
import { ArrowUpRight } from "@/components/arrows";

function BrandMark() {
  return (
    <svg
      className="brand-mark"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M4.5 5.5h15L4.5 18.5h15"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="square"
      />
    </svg>
  );
}

export default function SiteHeader() {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let raf = 0;
    let queued = false;

    const update = () => {
      queued = false;
      el.classList.toggle("is-scrolled", window.scrollY > 10);
    };

    const onScroll = () => {
      if (!queued) {
        queued = true;
        raf = requestAnimationFrame(update);
      }
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <header className="site-header" ref={ref}>
      <div className="container header-inner">
        <Link href="/" className="brand" aria-label="Zecians — home">
          <BrandMark />
          <span className="brand-word">Zecians</span>
        </Link>
        <nav className="header-nav" aria-label="Primary">
          <Link href="/about" className="header-link">
            About
          </Link>
          <a
            href={MARKETPLACE_URL}
            className="header-market"
            aria-label="Enter the Zecians Marketplace (opens in a new tab)"
            target="_blank"
            rel="noreferrer"
          >
            <span>Marketplace</span>
            <ArrowUpRight />
          </a>
        </nav>
      </div>
    </header>
  );
}
