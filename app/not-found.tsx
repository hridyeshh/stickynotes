import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/layout";

export const metadata = { title: "Page not found · stickynotes" };

// The first words of each line on the page that was torn out; the tear cuts them off.
const TORN = ["Page 404", "", "Things worth keeping", "· Keys map onto a ring", "· Virtual nodes even it out", "", "so adding a server", "moves only its own keys", "", "see also: jump hash"];

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className="missing">
        <div className="missing-sheet">
          <div className="missing-stub" aria-hidden="true">
            <div className="missing-stub-in">
              {TORN.map((line, i) => <span key={i}>{line}</span>)}
            </div>
          </div>
          <p className="hand missing-was" aria-hidden="true">
            <svg className="doodle" viewBox="0 0 64 40">
              <path d="M60 32C44 10 24 6 8 16" />
              <path d="M18 8 7 16l10 9" />
            </svg>
            page 404 was here
          </p>
          <h1>
            <span className="missing-code">404</span>
            <span className="missing-title">This page doesn&rsquo;t exist.</span>
          </h1>
          <p className="missing-lede">
            The link may be old or mistyped. If you came looking for a note, it&rsquo;s safe in your library.
          </p>
          <div className="missing-actions">
            <Link href="/" className="btn btn-sticker">Back to the first page</Link>
            <Link href="/library">Open your library</Link>
          </div>
          <div className="sticky missing-sticky" aria-hidden="true">
            <p>note to self: check the link</p>
            <span>p. 404</span>
          </div>
          <span className="pencil missing-pencil" aria-hidden="true" />
          <svg className="missing-crumbs" viewBox="0 0 120 40" aria-hidden="true">
            <polygon points="8,22 20,18 24,27 14,31 6,28" />
            <polygon points="44,8 52,6 55,13 47,15" />
            <polygon points="78,26 92,22 96,30 86,35 79,33" />
          </svg>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
