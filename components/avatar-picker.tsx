"use client";

import { useState, useTransition } from "react";
import { setAvatar } from "@/app/actions";
import { AVATARS } from "@/lib/notes";

/** Every avatar as a button (Settings and setup). Picking one saves it straight away. */
export function AvatarPicker({ current }: { current: string }) {
  const [pick, setPick] = useState(current);
  const [error, setError] = useState("");
  const [, start] = useTransition();

  return (
    <>
      <div className="avatar-choices" role="group" aria-label="Avatar">
        {AVATARS.map(([key, label]) => (
          <button key={key} type="button" className="avatar-choice" aria-pressed={key === pick} aria-label={label} title={label}
            onClick={() => {
              const before = pick;
              setPick(key);
              start(async () => {
                const r = await setAvatar(key);
                setError(r.error ?? "");
                if (r.error) setPick(before);
              });
            }}>
            <img src={`/avatars/${key}.webp`} alt="" />
          </button>
        ))}
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
    </>
  );
}
