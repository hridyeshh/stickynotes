"use client";

import { useEffect, useState } from "react";
import { createExtensionCode } from "@/app/actions";
import { connectExtension, type Connected } from "@/lib/bridge";

/** Connects as soon as the page opens: the extension's popup sent the user here. */
export function Connect() {
  const [status, setStatus] = useState<Connected | null>(null);

  useEffect(() => {
    connectExtension(createExtensionCode).then(setStatus);
  }, []);

  if (!status) return <p className="text-muted">Connecting to the stickynotes extension…</p>;
  if ("email" in status) {
    return <p>Connected{status.email && ` as ${status.email}`}. Notes you save now sync to your library. You can close this tab.</p>;
  }
  if ("missing" in status) {
    return (
      <p className="auth-error" role="alert">
        We couldn&apos;t find the stickynotes extension in this browser. Install or enable it, then reload this page.
      </p>
    );
  }
  return <p className="auth-error" role="alert">{status.error} Reload this page to try again.</p>;
}
