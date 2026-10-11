"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { ArrowLeft, Copy, ExternalLink, Globe, Lock, Merge, Pencil, Share2, Trash2, X } from "lucide-react";
import { deleteNote, deleteTopic, mergeTopic, moveSource, renameTopic, setShare } from "@/app/actions";
import { Dialog } from "@/components/dialog";
import { hostname, plural, toMarkdown, type NumberedSource, type Topic, type TopicView } from "@/lib/notes";

type Other = { id: string; title: string };
type Open = null | "share" | "delete" | "merge" | NumberedSource;

export function TopicPage({ view, others }: { view: TopicView & { topic: Topic }; others: Other[] }) {
  const { topic } = view;
  const [open, setOpen] = useState<Open>(null);
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState("");
  const [into, setInto] = useState("");
  const [dest, setDest] = useState("");
  const [copied, setCopied] = useState(false);
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
      <Link href="/library" className="back"><ArrowLeft size={15} aria-hidden="true" />All notes</Link>
      {sites && <div className="kicker topic-kicker">{sites}</div>}

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
      <div className="page-meta">
        {view.noteCount ? `${plural(view.noteCount, "note")} from ${plural(view.sources.length, "source")} · last saved ${view.lastSaved}` : "No notes"}
      </div>

      <div className="toolbar">
        <button className="btn btn-primary" onClick={() => show("share")}>
          {topic.is_public ? <Globe size={15} aria-hidden="true" /> : <Share2 size={15} aria-hidden="true" />}
          {topic.is_public ? "Shared" : "Share"}
        </button>
        <button className="btn btn-secondary" disabled={!view.noteCount} onClick={async () => {
          await navigator.clipboard.writeText(toMarkdown(view));
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}>
          <Copy size={15} aria-hidden="true" />{copied ? "Copied" : "Copy as Markdown"}
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
      {error && !open && <p className="form-error" role="alert">{error}</p>}

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
                <div className="source-what">
                  <a href={s.url} target="_blank" rel="noopener noreferrer">{s.title || s.url}<ExternalLink size={12} aria-hidden="true" /></a>
                  <div className="source-site">{s.site || hostname(s.url)} · {plural(notesFrom(s), "note")}</div>
                </div>
                <button className="btn btn-ghost" onClick={() => {
                  setDest("");
                  show(s);
                }}>Move</button>
              </li>
            ))}
          </ol>
        </section>
      )}

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
