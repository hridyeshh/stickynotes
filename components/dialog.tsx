"use client";

import { useEffect, useId, useRef } from "react";

/** A modal on the native <dialog>: focus trap, Escape and the top layer for free.
 *  Clicking the backdrop closes it too. */
export function Dialog({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const d = ref.current;
    if (open && !d?.open) d?.showModal();
    if (!open && d?.open) d.close();
  }, [open]);

  return (
    <dialog ref={ref} className="dialog-shell" aria-labelledby={id} onClose={onClose} onClick={(e) => e.target === ref.current && onClose()}>
      {open && (
        <div className="dialog">
          <h2 className="dialog-title" id={id}>{title}</h2>
          {children}
        </div>
      )}
    </dialog>
  );
}
