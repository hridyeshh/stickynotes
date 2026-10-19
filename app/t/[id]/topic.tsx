"use client";

import Link from "next/link";
import { Suspense, use, useState, useTransition } from "react";
import { ArrowLeft, Download, ExternalLink, Globe, Lock, Merge, Pencil, Plus, Share2, Trash2, X } from "lucide-react";
import { deleteNote, deleteTopic, mergeTopic, moveSource, renameTopic, setShare, setSuggestions, setTags } from "@/app/actions";
import { Dialog } from "@/components/dialog";
import { hostname, plural, type NumberedSource, type Suggestions, type Topic, type TopicView } from "@/lib/notes";

type Other = { id: string; title: string };
type Open = null | "share" | "delete" | "merge" | NumberedSource;
const MAX_TAGS = 12; // the API's limit

export function TopicPage({ view, others, tags, suggestions, offer }: {
  view: TopicView & { topic: Topic };
  others: Other[];
  /** Every tag in the library. */
  tags: string[];
  /** What reading suggestions found, still streaming in; null while they're off. */
  suggestions: Promise<Suggestions> | null;
  /** Reading suggestions are undecided: offer them. */
  offer: boolean;
}) {
  const { topic } = view;
  const [open, setOpen] = useState<Open>(null);
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState("");
  const [into, setInto] = useState("");
  const [dest, setDest] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  // Runs a server action; its result re-renders this page with fresh data.
  const run = (action: () => Promise<{ error?: string }>, after?: () => void) =>
    start(async () => {
      setError("");
      const r = await action();
      if (r?.error) setError(r.error);
      else after?.();
    });
  const show = (o: Open) => {
    setError("");
    setOpen(o);
  };
  const close = () => setOpen(null);
  const sites = [...new Set(view.sources.map((s) => s.site || hostname(s.url)))].join(", ");
  const notesFrom = (s: NumberedSource) => view.sections.reduce((n, sec) => n + sec.notes.filter((x) => x.source_id === s.id).length, 0);
  const moving = typeof open === "object" ? open : null;

  return (
    <main className="page page-topic">
      <div className="sheet-band">
        <Link href="/library" className="back"><ArrowLeft size={15} aria-hidden="true" />All notes</Link>
        <div className="toolbar">
          <button className="btn btn-primary" onClick={() => show("share")}>
            {topic.is_public ? <Globe size={15} aria-hidden="true" /> : <Share2 size={15} aria-hidden="true" />}
            {topic.is_public ? "Shared" : "Share"}
          </button>
          {/* ponytail: the browser's print dialog saves the PDF (print styles in site.css keep just the notes); a
              generated file would need a PDF library and embedded fonts. */}
          <button className="btn btn-secondary" disabled={!view.noteCount} onClick={() => window.print()}>
            <Download size={15} aria-hidden="true" />Save as PDF
          </button>
          <button className="btn btn-secondary" onClick={() => {
            setDraft(topic.title);
            setError("");
            setRenaming(true);
          }}>
            <Pencil size={15} aria-hidden="true" />Rename
          </button>
          {others.length > 0 && (
            <button className="btn btn-secondary" onClick={() => {
              setInto(others[0].id);
              show("merge");
            }}>
              <Merge size={15} aria-hidden="true" />Merge
            </button>
          )}
          <button className="btn btn-danger" onClick={() => show("delete")}><Trash2 size={15} aria-hidden="true" />Delete</button>
        </div>
      </div>
      {error && !open && <p className="form-error" role="alert">{error}</p>}

      <div className="ruled">
        {sites && <p><span className="sheet-label">{sites}</span></p>}
        {renaming ? (
          <form className="rename" onSubmit={(e) => {
            e.preventDefault();
            run(() => renameTopic(topic.id, draft), () => setRenaming(false));
          }}>
            <input className="input rename-input" value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={300}
              aria-label="Topic title" autoFocus onKeyDown={(e) => e.key === "Escape" && setRenaming(false)} />
            <button className="btn btn-primary" disabled={pending || !draft.trim()}>Save</button>
            <button type="button" className="btn btn-ghost" onClick={() => setRenaming(false)}>Cancel</button>
          </form>
        ) : (
          <h1 className="topic-title">{topic.title}</h1>
        )}
        <p>
          <span className="sheet-label">
            {view.noteCount ? `${plural(view.noteCount, "note")} from ${plural(view.sources.length, "source")} · last saved ${view.lastSaved}` : "No notes"}
          </span>
        </p>
        <Tags tags={topic.tags ?? []} library={tags} ideas={suggestions} pending={pending} save={(next) => run(() => setTags(topic.id, next))} />

        {view.sections.map((sec) => (
          <section key={sec.name} className="topic-section">
            {sec.name && <h2>{sec.name}</h2>}
            {sec.notes.map((n) => (
              <div key={n.id} className="note-row">
                <p className="bullet note-text">
                  {n.text} <a href={`#source-${n.n}`} className="src-marker" aria-label={`Source ${n.n}`}>[{n.n}]</a>
                </p>
                <div className="note-side">
                  <span>{n.when}</span>
                  <button className="btn btn-icon btn-quiet" title="Delete note" aria-label="Delete note" disabled={pending}
                    onClick={() => run(() => deleteNote(n.id))}>
                    <X size={14} aria-hidden="true" />
                  </button>
                </div>
              </div>
            ))}
          </section>
        ))}
        {!view.noteCount && <p className="no-results">Every note in this topic has been moved or deleted.</p>}

        {view.sources.length > 0 && (
          <section className="sources" aria-labelledby="sources-title">
            <h2 id="sources-title">Sources</h2>
            <ol>
              {view.sources.map((s) => (
                <li key={s.id} id={`source-${s.n}`}>
                  <button className="btn btn-ghost" onClick={() => {
                    setDest("");
                    show(s);
                  }}>Move</button>
                  <a href={s.url} target="_blank" rel="noopener noreferrer">{s.title || s.url}<ExternalLink size={12} aria-hidden="true" /></a>{" "}
                  <span className="sheet-label">{s.site || hostname(s.url)} · {plural(notesFrom(s), "note")}</span>
                </li>
              ))}
            </ol>
          </section>
        )}
        {suggestions && (
          <Suspense fallback={
            <section className="sources read-more" aria-busy="true">
              <h2>Read more</h2>
              <p><span className="sheet-label">Looking for pages to read next…</span></p>
            </section>
          }>
            <ReadMore suggestions={suggestions} />
          </Suspense>
        )}
        {offer && <SuggestOffer pending={pending} choose={(on) => run(() => setSuggestions(on))} />}
      </div>

      <Dialog open={open === "share"} onClose={close} title="Share this topic">
        <div className="seg" role="radiogroup" aria-label="Who can read it">
          <label className="seg-opt">
            <input type="radio" name="share" checked={!topic.is_public} disabled={pending} onChange={() => run(() => setShare(topic.id, false))} />
            <Lock size={13} aria-hidden="true" />Private
          </label>
          <label className="seg-opt">
            <input type="radio" name="share" checked={topic.is_public} disabled={pending} onChange={() => run(() => setShare(topic.id, true))} />
            <Globe size={13} aria-hidden="true" />Anyone with the link
          </label>
        </div>
        {topic.is_public && topic.share_slug ? (
          <>
            <p className="dialog-body">
              Anyone with the link can read the notes in this topic and see your name. They can&apos;t see your other topics
              or change anything. Making it private turns this link off for good.
            </p>
            <ShareLink slug={topic.share_slug} />
          </>
        ) : (
          <p className="dialog-body">Only you can see these notes.</p>
        )}
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="dialog-actions">
          {topic.is_public && topic.share_slug && (
            <a className="btn btn-ghost" href={`/s/${topic.share_slug}`} target="_blank" rel="noopener">View public page</a>
          )}
          <button className="btn btn-secondary" onClick={close}>Done</button>
        </div>
      </Dialog>

      <Dialog open={open === "delete"} onClose={close} title="Delete this topic?">
        <p className="dialog-body">
          {view.noteCount ? `This deletes ${plural(view.noteCount, "note")} from ${plural(view.sources.length, "source")}, ` : "This deletes the topic, "}
          here and in the extension{topic.is_public ? ", and turns off its share link" : ""}. This can&apos;t be undone.
        </p>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="dialog-actions">
          <button className="btn btn-secondary" onClick={close}>Cancel</button>
          <button className="btn btn-danger" disabled={pending} onClick={() => run(() => deleteTopic(topic.id))}>Delete topic</button>
        </div>
      </Dialog>

      <Dialog open={open === "merge"} onClose={close} title="Merge into another topic">
        <p className="dialog-body">Every source and note in “{topic.title}” moves into the topic you pick, and “{topic.title}” goes away.</p>
        <div className="field">
          <label htmlFor="merge-into">Merge into</label>
          <select id="merge-into" className="input" value={into} onChange={(e) => setInto(e.target.value)}>
            {others.map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}
          </select>
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="dialog-actions">
          <button className="btn btn-secondary" onClick={close}>Cancel</button>
          <button className="btn btn-primary" disabled={pending || !into} onClick={() => run(() => mergeTopic(topic.id, into))}>Merge</button>
        </div>
      </Dialog>

      <Dialog open={!!moving} onClose={close} title="Move this source">
        {moving && (
          <form className="dialog-form" onSubmit={(e) => {
            e.preventDefault();
            run(() => moveSource(moving.url, dest), close);
          }}>
            <p className="dialog-body">“{moving.title || moving.url}” and its {plural(notesFrom(moving), "note")} move to the topic you pick or name.</p>
            <div className="field">
              <label htmlFor="move-to">Topic</label>
              <input id="move-to" className="input" list="topic-titles" value={dest} onChange={(e) => setDest(e.target.value)}
                maxLength={300} placeholder="Pick a topic or type a new one" autoFocus />
              <datalist id="topic-titles">{others.map((o) => <option key={o.id} value={o.title} />)}</datalist>
            </div>
            {error && <p className="form-error" role="alert">{error}</p>}
            <div className="dialog-actions">
              <button type="button" className="btn btn-secondary" onClick={close}>Cancel</button>
              <button className="btn btn-primary" disabled={pending || !dest.trim()}>Move</button>
            </div>
          </form>
        )}
      </Dialog>
    </main>
  );
}

/** The topic's tags as chips on the sheet, a field to add one, and, with suggestions on, ideas that add with a click. */
function Tags({ tags, library, ideas, pending, save }: {
  tags: string[];
  library: string[];
  ideas: Promise<Suggestions> | null;
  pending: boolean;
  save: (tags: string[]) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const add = (tag: string) => save([...tags, tag]);
  const done = () => {
    setDraft("");
    setAdding(false);
  };

  return (
    <div className="tags">
      {tags.map((t) => (
        <span key={t} className="chip">
          {t}
          <button className="chip-x" title="Remove tag" aria-label={`Remove the tag ${t}`} disabled={pending}
            onClick={() => save(tags.filter((x) => x !== t))}>
            <X size={12} aria-hidden="true" />
          </button>
        </span>
      ))}
      {adding ? (
        <form className="tag-form" onSubmit={(e) => {
          e.preventDefault();
          if (draft.trim()) add(draft);
          done();
        }}>
          <input className="chip chip-input" value={draft} onChange={(e) => setDraft(e.target.value)} list="tag-list" maxLength={32}
            aria-label="New tag" placeholder="New tag" autoFocus onBlur={() => !draft.trim() && done()}
            onKeyDown={(e) => e.key === "Escape" && done()} />
          <datalist id="tag-list">{library.filter((t) => !tags.includes(t)).map((t) => <option key={t} value={t} />)}</datalist>
        </form>
      ) : tags.length < MAX_TAGS && (
        <button className="chip chip-add" onClick={() => setAdding(true)}><Plus size={12} aria-hidden="true" />Add tag</button>
      )}
      {ideas && tags.length < MAX_TAGS && (
        <Suspense fallback={null}>
          <TagIdeas ideas={ideas} tags={tags} pending={pending} add={add} />
        </Suspense>
      )}
    </div>
  );
}

/** Tags the suggestions came up with that the topic doesn't wear yet. */
function TagIdeas({ ideas, tags, pending, add }: { ideas: Promise<Suggestions>; tags: string[]; pending: boolean; add: (tag: string) => void }) {
  const fresh = use(ideas).tags.filter((t) => !tags.includes(t));
  if (!fresh.length) return null;
  return (
    <>
      <span className="sheet-label tag-ideas">ideas:</span>
      {fresh.map((t) => (
        <button key={t} className="chip chip-idea" disabled={pending} aria-label={`Add the suggested tag ${t}`} onClick={() => add(t)}>
          <Plus size={12} aria-hidden="true" />{t}
        </button>
      ))}
    </>
  );
}

/** Pages to read next, under the sources. When nothing was found (or the APIs were busy) the sheet ends at its sources. */
function ReadMore({ suggestions }: { suggestions: Promise<Suggestions> }) {
  const { links } = use(suggestions);
  if (!links.length) return null;
  return (
    <section className="sources read-more" aria-labelledby="read-more-title">
      <h2 id="read-more-title">Read more</h2>
      <ul>
        {links.map((l) => (
          <li key={l.url} className="bullet">
            <a href={l.url} target="_blank" rel="noopener noreferrer">{l.title || l.url}<ExternalLink size={12} aria-hidden="true" /></a>{" "}
            <span className="sheet-label">{l.site || hostname(l.url)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** While reading suggestions are undecided: a sticky note on the sheet saying what turning them on sends, and to whom. */
function SuggestOffer({ pending, choose }: { pending: boolean; choose: (on: boolean) => void }) {
  return (
    <aside className="suggest-card" aria-labelledby="suggest-title">
      <h2 id="suggest-title">Want more to read?</h2>
      <p>Turn on reading suggestions and each topic lists pages that go further than your sources, with tag ideas.</p>
      <p className="suggest-fine">
        To find them, stickynotes sends a topic&apos;s title and its 30 newest notes to Google&apos;s Gemini, which writes a
        few web searches, and runs those on Brave Search. Google may use what it&apos;s sent to improve its products, and
        people at Google may read it. You can turn this off in Settings. <Link href="/privacy#suggestions">Privacy</Link> has more.
      </p>
      <div className="row-actions">
        <button className="btn btn-primary" disabled={pending} onClick={() => choose(true)}>Turn on suggestions</button>
        <button className="btn btn-ghost" disabled={pending} onClick={() => choose(false)}>No thanks</button>
      </div>
    </aside>
  );
}

/** The link and a Copy button. Rendered only inside the open dialog, so on the client. */
function ShareLink({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false);
  const url = `${location.origin}/s/${slug}`;
  return (
    <div className="copy-row">
      <input className="input" readOnly value={url} aria-label="Share link" onFocus={(e) => e.target.select()} />
      <button className="btn btn-primary" onClick={async () => {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}>{copied ? "Copied" : "Copy link"}</button>
    </div>
  );
}
