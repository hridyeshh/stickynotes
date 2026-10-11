import Link from "next/link";
import { Download } from "lucide-react";
import { AppHeader } from "@/components/layout";
import { load, type Me } from "@/lib/data";
import { libraryCards, plural, type Library as LibraryData } from "@/lib/notes";
import { LibraryList } from "./library";

export const metadata = { title: "Your notes · stickynotes" };

export default async function Library() {
  const [me, lib] = await Promise.all([load<Me>("/api/v1/me"), load<LibraryData>("/api/v1/library")]);
  // oxlint-disable-next-line react/purity -- a server component renders once per request
  const cards = libraryCards(lib, Date.now());
  const notes = cards.reduce((n, c) => n + c.noteCount, 0);
  const pages = cards.reduce((n, c) => n + c.sourceCount, 0);

  return (
    <>
      <AppHeader user={me} current="library" />
      <main className="page">
        <div className="page-head">
          <div>
            <h1 className="page-title">Your notes</h1>
            {cards.length > 0 && (
              <div className="page-meta">{plural(cards.length, "topic")} · {plural(notes, "note")} from {plural(pages, "page")}</div>
            )}
          </div>
          {cards.length > 0 && (
            <a href="/export?format=md" className="btn btn-secondary"><Download size={15} aria-hidden="true" />Export all</a>
          )}
        </div>
        {cards.length ? (
          <LibraryList cards={cards} />
        ) : (
          <div className="empty">
            <div className="empty-title">No notes yet</div>
            <p className="text-muted">Select a passage on any page and it appears here, filed under its topic.</p>
            <div className="row-actions">
              <Link href="/sample" className="btn btn-primary">Open the sample article</Link>
              {!me.extension_seen_at && <Link href="/onboarding" className="btn btn-secondary">Set up the extension</Link>}
            </div>
          </div>
        )}
      </main>
    </>
  );
}
