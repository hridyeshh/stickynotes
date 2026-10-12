/** The notebook drawing: one topic as a school notebook with a name label. Styles: .nb in app/site.css. */

export type Tone = "kraft" | "sky" | "pink" | "sage" | "navy" | "tangerine";
const TONES: Tone[] = ["kraft", "sky", "pink", "sage", "navy", "tangerine"];

/** The same cover colour for a topic every time. */
export function toneFor(id: string): Tone {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return TONES[h % TONES.length];
}

/** The name label, filled in for a topic. */
export function Label({ topic, notes, sources }: { topic: string; notes: number; sources: number }) {
  return (
    <div className="nb-label">
      <div className="nb-label-in">
        <div className="nb-top"><span>Topic</span><b>{topic}</b></div>
        <div className="nb-cell"><span>Notes</span><b>{notes}</b></div>
        <div className="nb-cell"><span>Sources</span><b>{sources}</b></div>
      </div>
    </div>
  );
}

export function Notebook({ tone, children, ...label }: {
  tone: Tone;
  topic: string;
  notes: number;
  sources: number;
  children?: React.ReactNode;
}) {
  return (
    <div className={`nb nb-${tone}`}>
      <Label {...label} />
      <span className="nb-emboss" aria-hidden="true">s</span>
      {children}
    </div>
  );
}
