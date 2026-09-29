import Link from "next/link";

export default function NotFound() {
  return (
    <section className="notfound" aria-label="Page not found">
      <p className="notfound-code">
        4<span>0</span>4
      </p>
      <p>This page isn&rsquo;t part of the story.</p>
      <Link href="/" className="cta cta-ghost cta-lg">
        Return to Zecians
      </Link>
    </section>
  );
}
