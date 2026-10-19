"use client";

import { useState, useTransition } from "react";
import { deleteAccount, setSuggestions } from "@/app/actions";
import { Dialog } from "@/components/dialog";

/** The reading suggestions row: what they do (children), then a switch that saves straight away. */
export function SuggestionsSwitch({ on, children }: { on: boolean; children: React.ReactNode }) {
  const [shown, setShown] = useState(on);
  const [error, setError] = useState("");
  const [, start] = useTransition();

  return (
    <>
      <div className="settings-what">
        <div className="settings-name" id="suggestions-name">Suggest pages and tags</div>
        <div className="settings-note">{children}</div>
        {error && <p className="form-error" role="alert">{error}</p>}
      </div>
      <button className="switch" role="switch" aria-checked={shown} aria-labelledby="suggestions-name" onClick={() => {
        setShown(!shown);
        start(async () => {
          const r = await setSuggestions(!shown);
          setError(r.error ?? "");
          if (r.error) setShown(shown);
        });
      }}>
        <span />
      </button>
    </>
  );
}

/** Delete account, behind a typed confirmation. */
export function DeleteAccount() {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const confirmed = typed.trim().toLowerCase() === "delete";

  return (
    <>
      <button className="btn btn-danger btn-outline" onClick={() => {
        setTyped("");
        setError("");
        setOpen(true);
      }}>Delete my account and data</button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Delete your account?">
        <form className="dialog-form" onSubmit={(e) => {
          e.preventDefault();
          if (!confirmed) return;
          start(async () => {
            const r = await deleteAccount();
            if (r?.error) setError(r.error);
          });
        }}>
          <p className="dialog-body">
            Your account, every note in it and every share link are deleted now. Connected extensions stop syncing; what
            they kept stays only in that browser.
          </p>
          <div className="field">
            <label htmlFor="confirm-delete">Type <strong>delete</strong> to confirm</label>
            <input id="confirm-delete" className="input" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" autoFocus />
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="dialog-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn btn-danger btn-outline" disabled={!confirmed || pending}>Delete account</button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
