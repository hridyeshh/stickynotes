"use client";

import Link from "next/link";
import { useState } from "react";
import { Globe, Search } from "lucide-react";
import { matches, plural, type Card } from "@/lib/notes";

/** The topic cards, filtered as you type. */
export function LibraryList({ cards }: { cards: Card[] }) {
  const [q, setQ] = useState("");
  const shown = cards.filter((c) => matches(c, q));
  return (
    <>
      <label className="search">
        <Search size={16} aria-hidden="true" />
        <input className="input" type="search" value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Search notes, pages and sites" aria-label="Search your notes" />
      </label>
      <div className="topic-list">
        {shown.map((c) => (
          <Link key={c.id} href={`/t/${c.id}`} className="topic-card">
            <div className="kicker kicker-row">
              <span>{c.sites}</span>
              <span className="sep" aria-hidden="true">·</span>
              <span>{c.updated}</span>
              {c.shared && <span className="kicker-quiet"><Globe size={12} aria-hidden="true" />Shared</span>}
            </div>
            <h2 className="topic-card-title">{c.title}</h2>
            <div className="topic-card-preview">
              {c.preview.map((t, i) => <p key={i} className="bullet">{t}</p>)}
            </div>
            <div className="topic-card-count">{plural(c.noteCount, "note")} · {plural(c.sourceCount, "source")}</div>
          </Link>
        ))}
      </div>
      {!shown.length && <p className="no-results">Nothing matches “{q}”.</p>}
    </>
  );
}
