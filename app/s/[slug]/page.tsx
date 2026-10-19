import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { ExternalLink } from "lucide-react";
import { AvatarImg, Brand } from "@/components/layout";
import { api, ApiError } from "@/lib/api";
import { hostname, plural, topicView, type Highlight, type Source } from "@/lib/notes";

type Shared = { title: string; author: string; author_avatar?: string; sources: Source[]; highlights: Highlight[] };

// Public, no sign-in. One API read per request, shared by the metadata and the page.
const shared = cache(async (slug: string) => {
  try {
    return await api<Shared>(`/api/v1/shared/${encodeURIComponent(slug)}`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
});

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const s = await shared((await params).slug);
  // Shared by link, not published: kept out of search engines either way.
  const robots = { index: false, follow: false };
  if (!s) return { title: "Not found · stickynotes", robots };
  // Link previews take this title and description, with the root layout's site name and image. Setting openGraph
  // here would replace the layout's whole object, image included.
  return { title: `${s.title} · stickynotes`, description: s.highlights[0]?.text.slice(0, 200), robots };
}

export default async function SharedTopic({ params }: Props) {
  const s = await shared((await params).slug);
  if (!s) notFound();
  // oxlint-disable-next-line react/purity -- a server component renders once per request
  const v = topicView(s.title, s.sources, s.highlights, Date.now());

  return (
    <div className="share-page">
      <header className="share-header"><Brand /></header>
      <main className="share-main">
        <div className="sheet-band byline">
          {s.author && <span className="avatar avatar-sm" aria-hidden="true"><AvatarImg pick={s.author_avatar} seed={s.author} /></span>}
          <span>{s.author ? `Notes by ${s.author}` : "Notes"}{v.noteCount > 0 && ` from ${plural(v.sources.length, "source")}`}</span>
        </div>
        <div className="ruled">
          <p><span className="sheet-label">Shared notes</span></p>
          <h1 className="share-title">{s.title}</h1>
          {!v.noteCount && <p className="no-results">There are no notes here yet.</p>}
          {v.sections.map((sec) => (
            <section key={sec.name} className="share-section">
              {sec.name && <h2>{sec.name}</h2>}
              {sec.notes.map((n) => (
                <p key={n.id} className="bullet note-text">
                  {n.text} <a href={`#source-${n.n}`} className="src-marker" aria-label={`Source ${n.n}`}>[{n.n}]</a>
                </p>
              ))}
            </section>
          ))}
          {v.sources.length > 0 && (
            <section className="sources" aria-labelledby="sources-title">
              <h2 id="sources-title">Sources</h2>
              <ol>
                {v.sources.map((src) => (
                  <li key={src.id} id={`source-${src.n}`}>
                    <a href={src.url} target="_blank" rel="noopener noreferrer nofollow ugc">
                      {src.title || src.url}<ExternalLink size={12} aria-hidden="true" />
                    </a>{" "}
                    <span className="sheet-label">{src.site || hostname(src.url)}</span>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </div>
      </main>
      <footer className="share-footer">
        <span>Keep notes from what you read.</span>
        <Link href="/" className="btn btn-primary">Try stickynotes</Link>
      </footer>
    </div>
  );
}
