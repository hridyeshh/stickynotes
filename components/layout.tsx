import Link from "next/link";
import type { Me } from "@/lib/data";

export function Brand({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="brand">
      <img className="brand-mark" src="/icon.png" alt="" width={26} height={26} />
      <span className="brand-name">stickynotes</span>
    </Link>
  );
}

/** Header for public pages. */
export function SiteHeader() {
  return (
    <header className="site-header">
      <Brand />
      <nav className="site-nav">
        <span className="site-links">
          <Link href="/#how">How it works</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/signin">Sign in</Link>
        </span>
        <Link href="/signin?next=/onboarding" className="btn btn-sticker">Get started</Link>
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-top">
        <p className="footer-line">Read the web.<br />Keep the parts that matter.</p>
        <nav className="footer-links">
          <Link href="/#how">How it works</Link>
          <Link href="/privacy">Privacy policy</Link>
          <Link href="/#faq">Questions</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/sample">Try it on a sample</Link>
          <Link href="/signin">Sign in</Link>
        </nav>
      </div>
      {/* textLength stretches the word to the footer's width whatever the font's metrics. */}
      <svg className="footer-mark" viewBox="0 0 1000 250" aria-hidden="true">
        <text className="footer-mark-lit" x="0" y="196" textLength="1000" lengthAdjust="spacingAndGlyphs">stickynotes</text>
        <text x="0" y="192" textLength="1000" lengthAdjust="spacingAndGlyphs">stickynotes</text>
      </svg>
      <div className="footer-fine">
        <span>© 2026 stickynotes</span>
        <span>Nothing is sent until you save a note.</span>
      </div>
    </footer>
  );
}

/** Header for signed-in pages, with whether an extension is connected. */
export function AppHeader({ user, current }: { user: Me; current?: "library" | "settings" }) {
  const here = (page: string) => (current === page ? "page" : undefined);
  return (
    <header className="app-header">
      <Brand href="/library" />
      <nav className="app-nav">
        <Link href="/library" aria-current={here("library")}>Library</Link>
        <Link href="/settings" aria-current={here("settings")}>Settings</Link>
      </nav>
      {user.extension_seen_at ? (
        <span className="sync-pill" title="Notes you save in the browser show up here">
          <span className="dot dot-on" aria-hidden="true" />Extension connected
        </span>
      ) : (
        <Link href="/onboarding" className="sync-pill">
          <span className="dot" aria-hidden="true" />Connect the extension
        </Link>
      )}
      <Link href="/settings" className="avatar" title={user.email} aria-label="Settings">{initials(user.name || user.email)}</Link>
    </header>
  );
}

export function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
}
