"use client";

import Link from "next/link";
import { useState } from "react";
import { Globe, Search } from "lucide-react";
import { Notebook, toneFor } from "@/components/notebook";
import { matches, plural, type Card } from "@/lib/notes";

/** The topics as a shelf of notebooks, filtered as you type. */
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
      <ul className="topic-shelf">
        {shown.map((c) => (
          <li key={c.id}>
            <Link href={`/t/${c.id}`} className="topic-nb"
              aria-label={`${c.title}: ${plural(c.noteCount, "note")} from ${plural(c.sourceCount, "source")}${c.shared ? ", shared" : ""}`}>
              {/* The cover carries the latest note on a sticky note. */}
              <Notebook tone={toneFor(c.id)} topic={c.title} notes={c.noteCount} sources={c.sourceCount}>
                {c.preview[0] && <span className="sticky topic-nb-sticky">{c.preview[0]}</span>}
                {c.shared && <span className="topic-nb-shared"><Globe size={12} aria-hidden="true" />shared</span>}
              </Notebook>
              <span className="topic-nb-meta">{c.sites} · {c.updated}</span>
            </Link>
          </li>
        ))}
      </ul>
      {!shown.length && <p className="no-results">Nothing matches “{q}”.</p>}
    </>
  );
}
