import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { ExternalLink } from "lucide-react";
import { Brand, initials } from "@/components/layout";
import { api, ApiError } from "@/lib/api";
import { hostname, plural, topicView, type Highlight, type Source } from "@/lib/notes";

type Shared = { title: string; author: string; sources: Source[]; highlights: Highlight[] };

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
  const description = s.highlights[0]?.text.slice(0, 200);
  return {
    title: `${s.title} · stickynotes`,
    description,
    robots,
    openGraph: { title: s.title, description, type: "article", siteName: "stickynotes" },
    twitter: { card: "summary", title: s.title, description },
  };
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
        <div className="kicker">Shared notes</div>
        <h1 className="share-title">{s.title}</h1>
        <div className="byline">
          {s.author && <span className="avatar avatar-sm" aria-hidden="true">{initials(s.author)}</span>}
          <span>{s.author ? `Notes by ${s.author}` : "Notes"}{v.noteCount > 0 && ` from ${plural(v.sources.length, "source")}`}</span>
        </div>
        {!v.noteCount && <p className="no-results">There are no notes here yet.</p>}
        {v.sections.map((sec) => (
          <section key={sec.name} className="share-section">
            {sec.name && <h2>{sec.name}</h2>}
            {sec.notes.map((n) => (
              <p key={n.id} className="bullet justify">
                <mark className={`hl hl-${n.color ?? "yellow"}`}>{n.text}</mark> <a href={`#source-${n.n}`} className="src-marker" aria-label={`Source ${n.n}`}>[{n.n}]</a>
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
                  <div className="source-what">
                    <a href={src.url} target="_blank" rel="noopener noreferrer nofollow ugc">
                      {src.title || src.url}<ExternalLink size={12} aria-hidden="true" />
                    </a>
                    <div className="source-site">{src.site || hostname(src.url)}</div>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        )}
      </main>
      <footer className="share-footer">
        <span>Keep notes from what you read.</span>
        <Link href="/" className="btn btn-primary">Try stickynotes</Link>
      </footer>
    </div>
  );
}
