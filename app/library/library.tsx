"use client";

import Link from "next/link";
import { useState } from "react";
import { Globe, Search } from "lucide-react";
import { Notebook, toneFor } from "@/components/notebook";
import { matches, plural, tagCounts, type Card } from "@/lib/notes";

/** The topics as a shelf of notebooks, filtered as you type and by a tag. */
export function LibraryList({ cards }: { cards: Card[] }) {
  const [q, setQ] = useState("");
  const [tag, setTag] = useState("");
  const tags = tagCounts(cards);
  const shown = cards.filter((c) => (!tag || c.tags.includes(tag)) && matches(c, q));
  return (
    <>
      <label className="search">
        <Search size={16} aria-hidden="true" />
        <input className="input" type="search" value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Search notes, tags, pages and sites" aria-label="Search your notes" />
      </label>
      {tags.length > 0 && (
        <div className="chips" role="group" aria-label="Show topics with a tag">
          <button className="chip" aria-pressed={!tag} onClick={() => setTag("")}>All</button>
          {tags.map(([t, n]) => (
            <button key={t} className="chip" aria-pressed={tag === t} aria-label={`${t}, ${plural(n, "topic")}`} onClick={() => setTag(tag === t ? "" : t)}>
              {t}<span className="chip-n" aria-hidden="true">{n}</span>
            </button>
          ))}
        </div>
      )}
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
      {!shown.length && <p className="no-results">Nothing {tag && <>tagged “{tag}” </>}matches “{q}”.</p>}
    </>
  );
}
