"use client";

import { useEffect, useState } from "react";
import { createExtensionCode } from "@/app/actions";

type Status =
  | { step: "looking" | "connecting" | "missing" }
  | { step: "done"; email: string }
  | { step: "error"; error: string };

// Talks to the extension's content script with same-origin window.postMessage. The
// extension sends a PKCE challenge, we send back a code minted for it, and the
// extension redeems the code with a verifier that never leaves it. No token
// crosses this page.
export function Connect() {
  const [status, setStatus] = useState<Status>({ step: "looking" });

  useEffect(() => {
    const origin = window.location.origin;
    const send = (msg: object) => window.postMessage(msg, origin);
    let asked = false;

    async function onMessage(e: MessageEvent) {
      if (e.source !== window || e.origin !== origin || typeof e.data?.type !== "string") return;
      const msg = e.data;
      if (msg.type === "sn:ready") send({ type: "sn:hello" }); // the extension loaded after us
      if (msg.type === "sn:challenge" && typeof msg.challenge === "string" && !asked) {
        asked = true;
        setStatus({ step: "connecting" });
        const res = await createExtensionCode(msg.challenge);
        if (res.code) send({ type: "sn:code", code: res.code });
        else setStatus({ step: "error", error: res.error ?? "Something went wrong." });
      }
      if (msg.type === "sn:connected") setStatus({ step: "done", email: String(msg.email ?? "") });
      if (msg.type === "sn:error") setStatus({ step: "error", error: String(msg.error ?? "Something went wrong.") });
    }

    window.addEventListener("message", onMessage);
    send({ type: "sn:hello" });
    const timer = setTimeout(() => setStatus((s) => (s.step === "looking" ? { step: "missing" } : s)), 3000);
    return () => {
      window.removeEventListener("message", onMessage);
      clearTimeout(timer);
    };
  }, []);

  switch (status.step) {
    case "looking":
      return <p className="text-muted">Looking for the stickynotes extension…</p>;
    case "connecting":
      return <p className="text-muted">Connecting…</p>;
    case "done":
      return <p>Connected{status.email && ` as ${status.email}`}. Notes you save now sync to your library. You can close this tab.</p>;
    case "missing":
      return (
        <p className="auth-error" role="alert">
          We couldn&apos;t find the stickynotes extension in this browser. Install or enable it, then reload this page.
        </p>
      );
    case "error":
      return <p className="auth-error" role="alert">{status.error} Reload this page to try again.</p>;
  }
}
