import Link from "next/link";
import { signOut } from "@/app/actions";
import type { User } from "@/lib/session";

export function Brand() {
  return (
    <Link href="/" className="brand">
      <span className="brand-mark" aria-hidden="true">s</span>
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
        <Link href="/#how">How it works</Link>
        <Link href="/#privacy">Privacy</Link>
        <Link href="/signin">Sign in</Link>
        <Link href="/signin" className="btn btn-primary">Get started</Link>
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <span>© 2026 stickynotes</span>
      <Link href="/privacy">Privacy policy</Link>
      <Link href="/terms">Terms</Link>
    </footer>
  );
}

/** Header for signed-in pages. Sign out moves to Settings in phase 5. */
export function AppHeader({ user }: { user: User }) {
  return (
    <header className="app-header">
      <Brand />
      <nav className="app-nav">
        <Link href="/library" aria-current="page">Library</Link>
      </nav>
      <span className="avatar" title={user.email}>{initials(user.name || user.email)}</span>
      <form action={signOut}>
        <button className="btn btn-ghost">Sign out</button>
      </form>
    </header>
  );
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
}
