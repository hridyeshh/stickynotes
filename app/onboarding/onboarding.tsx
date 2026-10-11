"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { createExtensionCode } from "@/app/actions";
import { initials } from "@/components/layout";
import { connectExtension, findExtension } from "@/lib/bridge";

const STEPS = 3;

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

  return (
    <div className="onboarding">
      <div className="kicker onboarding-top">
        <span>Welcome{name ? `, ${name.split(/\s+/)[0]}` : ""}</span>
        <span>Step {step + 1} of {STEPS}</span>
      </div>
      <div className="onboarding-bars" aria-hidden="true">
        {Array.from({ length: STEPS }, (_, i) => <span key={i} className={i <= step ? "on" : ""} />)}
      </div>

      {step === 0 && (
        <>
          <h1>Add stickynotes to your browser</h1>
          <p className="onboarding-lede">
            The extension does the saving. It works in Chrome, Edge and Brave, and it only reads a page when you select text on it.
          </p>
          <div className="onboarding-card">
            <span className="brand-mark brand-mark-lg" aria-hidden="true">s</span>
            <div className="onboarding-what">
              <div className="onboarding-name">stickynotes for Chrome</div>
              <div className="settings-note">Can read and highlight text on sites you visit</div>
            </div>
            {added ? (
              <span className="onboarding-done"><Check size={16} aria-hidden="true" />Added</span>
            ) : (
              <button className="btn btn-primary" disabled={added === null} onClick={() => setAdded(null)}>
                {added === null ? "Looking…" : "Check again"}
              </button>
            )}
          </div>
          {/* ponytail: no store link until the Chrome Web Store listing exists (phase 7). */}
          <p className="settings-note onboarding-fine">
            {added === false && "We can't see the extension in this browser yet. Add it, then check again. "}
            Chrome asks to read site data because you can highlight on any page. Nothing is sent until you save a note.
          </p>
        </>
      )}

      {step === 1 && (
        <>
          <h1>Connect the extension to your account</h1>
          <p className="onboarding-lede">
            Notes you save in the browser then sync to your library, and edits made here show up in the extension.
          </p>
          <div className="onboarding-card">
            <span className="avatar avatar-lg" aria-hidden="true">{initials(name || email)}</span>
            <div className="onboarding-what">
              <div className="onboarding-name">{name || email}</div>
              <div className="settings-note">{email}</div>
            </div>
            {link.state === "done" ? (
              <span className="onboarding-done"><Check size={16} aria-hidden="true" />Connected</span>
            ) : (
              <button className="btn btn-primary" disabled={link.state === "busy"} onClick={connect}>
                {link.state === "busy" ? "Connecting…" : "Connect"}
              </button>
            )}
          </div>
          {link.state === "error" && <p className="form-error" role="alert">{link.error}</p>}
        </>
      )}

      {step === 2 && (
        <>
          <h1>Try it on a page</h1>
          <p className="onboarding-lede">Open the sample article and save a sentence or two.</p>
          <ol className="onboarding-tips">
            <li>Select some text. A <em>Save note</em> button appears next to it.</li>
            <li>Or press <kbd>Alt</kbd> + <kbd>S</kbd> to save without the mouse.</li>
            <li>Reload the page. Your highlights come back.</li>
          </ol>
        </>
      )}

      <div className="onboarding-nav">
        <button className="btn btn-ghost" onClick={() => setStep(step - 1)} disabled={step === 0}>Back</button>
        <div className="row-actions">
          {step < STEPS - 1 ? (
            <button className="btn btn-primary" onClick={() => setStep(step + 1)}>
              {(step === 0 ? added : link.state === "done") ? "Next" : "Skip for now"}
            </button>
          ) : (
            <>
              <Link href="/library" className="btn btn-secondary">Go to my library</Link>
              <Link href="/sample" className="btn btn-primary">Open the sample article</Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
