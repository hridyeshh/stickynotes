// The library as the API returns it, and the pure functions that turn it into what
// the pages show. No React and no Node APIs, so `node --test` runs them directly.

export type Topic = { id: string; title: string; is_public: boolean; share_slug: string | null; created_at: string };
export type Source = { id: string; topic_id: string; url: string; title: string; site: string };
export type Highlight = { id: string; source_id: string; text: string; section: string; created_at: string };
export type Library = { topics: Topic[]; sources: Source[]; highlights: Highlight[] };
export type Device = { id: string; client: string; user_agent: string; last_active: string };

/** A source numbered by when its first note was saved: the [n] beside each note. */
export type NumberedSource = Source & { n: number };
export type Note = Highlight & { n: number; when: string };
/** One topic merged across its sources: notes grouped by section heading, oldest first. */
export type TopicView = {
  title: string;
  sources: NumberedSource[];
  sections: { name: string; notes: Note[] }[];
  noteCount: number;
  lastSaved: string;
};

export function topicView(title: string, sources: Source[], highlights: Highlight[], now: number): TopicView {
  const byId = new Map(sources.map((s) => [s.id, s]));
  const notes = highlights.filter((h) => byId.has(h.source_id)).sort((a, b) => a.created_at.localeCompare(b.created_at));
  const numbers = new Map<string, number>();
  for (const h of notes) if (!numbers.has(h.source_id)) numbers.set(h.source_id, numbers.size + 1);

  const sections = new Map<string, Note[]>();
  for (const h of notes) {
    const list = sections.get(h.section) ?? sections.set(h.section, []).get(h.section)!;
    list.push({ ...h, n: numbers.get(h.source_id)!, when: timeAgo(h.created_at, now) });
  }
  return {
    title,
    sources: [...numbers].map(([id, n]) => ({ ...byId.get(id)!, n })),
    sections: [...sections].map(([name, list]) => ({ name, notes: list })),
    noteCount: notes.length,
    lastSaved: notes.length ? timeAgo(notes[notes.length - 1].created_at, now) : "",
  };
}

/** The view of one of the library's topics, or null if there is no such topic. */
export function libraryTopic(lib: Library, id: string, now: number): (TopicView & { topic: Topic }) | null {
  const topic = lib.topics.find((t) => t.id === id);
  if (!topic) return null;
  return { topic, ...topicView(topic.title, lib.sources.filter((s) => s.topic_id === id), lib.highlights, now) };
}

export type Card = {
  id: string;
  title: string;
  shared: boolean;
  sites: string;
  updated: string;
  preview: string[];
  noteCount: number;
  sourceCount: number;
  /** Lower-cased title, notes, page titles and sites, for search. */
  haystack: string;
};

/** Library cards, most recently saved to first. Topics left with no notes are skipped. */
export function libraryCards(lib: Library, now: number): Card[] {
  const latest = new Map<string, string>();
  const cards = lib.topics.flatMap((t) => {
    const sources = lib.sources.filter((s) => s.topic_id === t.id);
    const ids = new Set(sources.map((s) => s.id));
    const notes = lib.highlights.filter((h) => ids.has(h.source_id)).sort((a, b) => a.created_at.localeCompare(b.created_at));
    if (!notes.length) return [];
    const last = notes[notes.length - 1].created_at;
    latest.set(t.id, last);
    const sites = [...new Set(sources.map((s) => s.site || hostname(s.url)))];
    return [{
      id: t.id,
      title: t.title,
      shared: t.is_public,
      sites: sites.length > 2 ? `${sites.slice(0, 2).join(", ")} +${sites.length - 2}` : sites.join(", "),
      updated: timeAgo(last, now),
      preview: notes.slice(-2).map((h) => h.text),
      noteCount: notes.length,
      sourceCount: sources.length,
      haystack: [t.title, ...notes.map((h) => `${h.text} ${h.section}`), ...sources.map((s) => `${s.title} ${s.site}`)].join("\n").toLowerCase(),
    }];
  });
  return cards.sort((a, b) => latest.get(b.id)!.localeCompare(latest.get(a.id)!));
}

/** Every word of the query appears somewhere in the card. */
export function matches(card: Card, query: string): boolean {
  return query.toLowerCase().split(/\s+/).filter(Boolean).every((w) => card.haystack.includes(w));
}

export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** "just now", "5 min ago", "3 h ago", "yesterday", "4 days ago", then "9 Oct" (UTC). */
export function timeAgo(iso: string, now: number): string {
  const s = (now - Date.parse(iso)) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 2 * 86400) return "yesterday";
  if (s < 7 * 86400) return `${Math.floor(s / 86400)} days ago`;
  const d = new Date(iso);
  const sameYear = d.getUTCFullYear() === new Date(now).getUTCFullYear();
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", ...(!sameYear && { year: "numeric" }), timeZone: "UTC" });
}

export function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** A topic as Markdown: sections of bullets with [n] markers, then the numbered sources. */
export function toMarkdown(v: Pick<TopicView, "title" | "sources" | "sections">): string {
  const out = [`# ${v.title}`];
  for (const s of v.sections) {
    out.push(...(s.name ? ["", `## ${s.name}`] : []), "", ...s.notes.map((n) => `- ${n.text} [${n.n}]`));
  }
  out.push("", "## Sources", "", ...v.sources.map((s) => `${s.n}. [${(s.title || s.url).replace(/[[\]]/g, "\\$&")}](<${s.url}>)`));
  return out.join("\n") + "\n";
}

/** Every topic with notes, most recent first, as one Markdown file. */
export function libraryMarkdown(lib: Library, now: number): string {
  return libraryCards(lib, now)
    .map((c) => toMarkdown(libraryTopic(lib, c.id, now)!))
    .join("\n---\n\n");
}

/** The extension's backup format, so a web backup restores through the extension's
 *  notes page: { [url]: { url, title, site, topic, notes: [{ id, text, section, createdAt }] } }. */
export function toBackup(lib: Library) {
  const topics = new Map(lib.topics.map((t) => [t.id, t.title]));
  const sources = new Map(lib.sources.map((s) => [s.id, s]));
  const pages: Record<string, { url: string; title: string; site: string; topic: string; notes: object[] }> = {};
  for (const h of lib.highlights) {
    const s = sources.get(h.source_id);
    if (!s) continue;
    pages[s.url] ??= { url: s.url, title: s.title, site: s.site, topic: topics.get(s.topic_id) ?? s.title, notes: [] };
    pages[s.url].notes.push({ id: h.id, text: h.text, section: h.section, createdAt: Date.parse(h.created_at) });
  }
  return pages;
}

/** "Chrome on macOS", or "stickynotes extension in Chrome on macOS". */
export function deviceLabel(d: Pick<Device, "client" | "user_agent">): string {
  const pick = (list: [RegExp, string][]) => list.find(([re]) => re.test(d.user_agent))?.[1];
  // Order matters: Edge and Opera also say Chrome, and Chrome also says Safari.
  const browser = pick([[/Edg\//, "Edge"], [/OPR\//, "Opera"], [/Firefox\//, "Firefox"], [/Chrome\//, "Chrome"], [/Safari\//, "Safari"]]);
  const os = pick([[/iPhone|iPad/, "iOS"], [/Android/, "Android"], [/CrOS/, "ChromeOS"], [/Mac OS X/, "macOS"], [/Windows/, "Windows"], [/Linux/, "Linux"]]);
  const where = browser && os ? `${browser} on ${os}` : browser || os || "";
  if (d.client === "extension") return where ? `stickynotes extension in ${where}` : "stickynotes extension";
  return where || "A web browser";
}
