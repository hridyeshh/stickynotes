"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createExtensionCode } from "@/app/actions";
import { initials } from "@/components/layout";
import { KICKERS, SetupBook, Tick } from "@/components/setup";
import { connectExtension, findExtension } from "@/lib/bridge";

// The extension's Chrome Web Store page, once it has one (phase 7).
const STORE_URL = process.env.NEXT_PUBLIC_EXTENSION_URL;

/** Three steps: add the extension, connect it, try it on the sample article. */
export function Onboarding({ name, email, connected }: { name: string; email: string; connected: boolean }) {
  const [step, setStep] = useState(0);
  // null while looking. A connected extension is installed, so no need to look.
  const [added, setAdded] = useState<boolean | null>(connected || null);
  const [link, setLink] = useState<{ state: "idle" | "busy" | "done" } | { state: "error"; error: string }>({ state: connected ? "done" : "idle" });

  useEffect(() => {
    if (added === null) findExtension().then(setAdded);
  }, [added]);

  async function connect() {
    setLink({ state: "busy" });
    const r = await connectExtension(createExtensionCode);
    if ("email" in r) {
      setAdded(true);
      setLink({ state: "done" });
    } else {
      setLink({ state: "error", error: "error" in r ? `${r.error} Reload this page to try again.` : "We couldn't find the extension in this browser. Add it, then reload this page." });
    }
  }

  const first = name.split(/\s+/)[0];
  return (
    <SetupBook hello={`Dear ${first || "reader"},`} step={step} done={[added === true, link.state === "done", false]} onStep={setStep}>
      <p className="hand setup-kicker" aria-hidden="true">{KICKERS[step]}</p>

      {step === 0 && (
        <>
          <h1>Add stickynotes to your browser</h1>
          <p className="setup-lede">
            The extension does the saving. It works in Chrome, Edge and Brave, and it reads a page only when you select text on it.
          </p>
          <div className="setup-slip">
            <img className="brand-mark brand-mark-lg" src="/icon.png" alt="" width={44} height={44} />
            <div className="setup-what">
              <div className="setup-name">stickynotes for Chrome</div>
              <div className="settings-note">Highlights text on the pages you read</div>
            </div>
            {added ? (
              <span className="setup-done"><Tick />added</span>
            ) : added === null ? (
              <span className="settings-note">Looking for it…</span>
            ) : (
              <span className="row-actions">
                {STORE_URL && <a href={STORE_URL} target="_blank" rel="noopener noreferrer" className="btn btn-sticker">Add to Chrome</a>}
                {/* The extension says hello only to pages that load after it, so this page needs a reload to see it. */}
                <button className="btn btn-secondary" onClick={() => location.reload()}>I&rsquo;ve added it</button>
              </span>
            )}
          </div>
          <p className="settings-note setup-fine">
            {added === false && "Added it? Reload this page so it can say hello. "}
            Chrome asks to read site data because you can highlight on any page. Nothing is sent until you save a note.
          </p>
        </>
      )}

      {step === 1 && (
        <>
          <h1>Connect it to your account</h1>
          <p className="setup-lede">
            Notes you save in the browser then sync to your library, and changes you make here reach the extension.
          </p>
          <div className="setup-slip">
            <span className="avatar avatar-lg" aria-hidden="true">{initials(name || email)}</span>
            <div className="setup-what">
              <div className="setup-name">{name || email}</div>
              <div className="settings-note">{email}</div>
            </div>
            {link.state === "done" ? (
              <span className="setup-done"><Tick />connected</span>
            ) : (
              <button className="btn btn-sticker" disabled={link.state === "busy"} onClick={connect}>
                {link.state === "busy" ? "Connecting…" : "Connect"}
              </button>
            )}
          </div>
          {link.state === "error" && <p className="form-error" role="alert">{link.error}</p>}
        </>
      )}

      {step === 2 && (
        <>
          <h1>Save your first note</h1>
          <p className="setup-lede">Open the sample article and keep a sentence or two.</p>
          <ol className="setup-tips">
            <li><span>Select a sentence. A bar appears beside it: <em>Save note</em>, the colours, and the topic it goes to.</span></li>
            <li><span>Or press <kbd>Alt</kbd> + <kbd>S</kbd> to save without the mouse.</span></li>
            <li>Reload the page. Your highlights come back.</li>
          </ol>
        </>
      )}

      <div className="setup-nav">
        <button className="btn btn-ghost" onClick={() => setStep(step - 1)} disabled={step === 0}>Back</button>
        <div className="row-actions">
          {step < 2 ? (
            <button className="btn btn-secondary" onClick={() => setStep(step + 1)}>
              {(step === 0 ? added : link.state === "done") ? "Next" : "Skip for now"}
            </button>
          ) : (
            <>
              <Link href="/library" className="btn btn-secondary">Go to my library</Link>
              <Link href="/sample" className="btn btn-sticker">Open the sample article</Link>
            </>
          )}
        </div>
      </div>
    </SetupBook>
  );
}
