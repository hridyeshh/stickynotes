"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createExtensionCode } from "@/app/actions";
import { AddToChrome, KICKERS, SetupBook, Tick } from "@/components/setup";
import { connectExtension, type Connected } from "@/lib/bridge";

/** Connects as soon as the page opens: the extension's popup sent the user here, so step one is done. */
export function Connect() {
  const [status, setStatus] = useState<Connected | null>(null);

  useEffect(() => {
    connectExtension(createExtensionCode).then(setStatus);
  }, []);

  const done = !!status && "email" in status;
  return (
    <SetupBook hello="almost there," step={done ? 2 : 1} done={[true, done, false]}>
      <p className="hand setup-kicker" aria-hidden="true">{KICKERS[done ? 2 : 1]}</p>
      {!status && (
        <>
          <h1>Connecting the extension</h1>
          <p className="setup-lede">Linking this browser to your account. This takes a moment.</p>
        </>
      )}
      {status && "email" in status && (
        <>
          <h1>Connected. Now save a note.</h1>
          <p className="setup-lede">
            <span className="setup-done setup-done-inline"><Tick />synced</span>
            Notes you save in this browser now go to your library{status.email && ` as ${status.email}`}. Try it on the sample article, or close this tab.
          </p>
          <div className="setup-nav">
            <Link href="/library" className="btn btn-secondary">Go to my library</Link>
            <Link href="/sample" className="btn btn-sticker">Open the sample article</Link>
          </div>
        </>
      )}
      {status && "missing" in status && (
        <>
          <h1>We can&rsquo;t see the extension</h1>
          <p className="auth-error" role="alert">
            We couldn&apos;t find the stickynotes extension in this browser. Add it from the Chrome Web Store (or turn it
            back on), then reload this page.
          </p>
          <div className="setup-nav">
            <button className="btn btn-secondary" onClick={() => location.reload()}>I&rsquo;ve added it</button>
            <AddToChrome />
          </div>
        </>
      )}
      {status && "error" in status && (
        <>
          <h1>That didn&rsquo;t connect</h1>
          <p className="auth-error" role="alert">{status.error} Reload this page to try again.</p>
        </>
      )}
    </SetupBook>
  );
}
