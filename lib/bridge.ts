// The web app's side of the extension bridge (the extension's side is in content.js).
// Same-origin window.postMessage only: the extension sends a PKCE challenge, we send
// back a code the API minted for it, and the extension redeems that code with a
// verifier that never leaves it. No token crosses the page.

type Msg = { type: string; [k: string]: unknown };

function listen(on: (m: Msg) => void) {
  const handler = (e: MessageEvent) => {
    if (e.source === window && e.origin === location.origin && typeof e.data?.type === "string") on(e.data);
  };
  addEventListener("message", handler);
  return () => removeEventListener("message", handler);
}

const send = (m: Msg) => postMessage(m, location.origin);

/** Whether the extension runs in this tab. It says sn:ready when it loads, and to a ping. */
export function findExtension(ms = 1500): Promise<boolean> {
  return new Promise((resolve) => {
    const stop = listen((m) => {
      if (m.type === "sn:ready") done(true);
    });
    const timer = setTimeout(() => done(false), ms);
    function done(found: boolean) {
      stop();
      clearTimeout(timer);
      resolve(found);
    }
    send({ type: "sn:ping" });
  });
}

export type Connected = { email: string } | { error: string } | { missing: true };

/** Connects the extension to the signed-in account. `mint` asks the API for a code. */
export function connectExtension(mint: (challenge: string) => Promise<{ code?: string; error?: string }>): Promise<Connected> {
  return new Promise((resolve) => {
    let asked = false;
    const stop = listen(async (m) => {
      if (m.type === "sn:ready") send({ type: "sn:hello" }); // the extension loaded after us
      if (m.type === "sn:challenge" && typeof m.challenge === "string" && !asked) {
        asked = true;
        clearTimeout(timer);
        const res = await mint(m.challenge);
        if (res.code) send({ type: "sn:code", code: res.code });
        else done({ error: res.error ?? "Something went wrong." });
      }
      if (m.type === "sn:connected") done({ email: String(m.email ?? "") });
      if (m.type === "sn:error") done({ error: String(m.error ?? "Something went wrong.") });
    });
    const timer = setTimeout(() => done({ missing: true }), 3000);
    function done(r: Connected) {
      stop();
      clearTimeout(timer);
      resolve(r);
    }
    send({ type: "sn:hello" });
  });
}
