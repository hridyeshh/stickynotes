import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { cache } from "react";
import { AppHeader } from "@/components/layout";
import { api } from "@/lib/api";
import { load, type Me } from "@/lib/data";
import { libraryTopic, type Library, type Suggestions } from "@/lib/notes";
import { ACCESS_COOKIE } from "@/lib/session";
import { TopicPage } from "./topic";

// One library read per request, shared by the metadata and the page.
const library = cache(() => load<Library>("/api/v1/library"));

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const topic = (await library()).topics.find((t) => t.id === id);
  return { title: `${topic?.title ?? "Notes"} · stickynotes` };
}

export default async function Topic({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [me, lib] = await Promise.all([load<Me>("/api/v1/me"), library()]);
  // oxlint-disable-next-line react/purity -- a server component renders once per request
  const view = libraryTopic(lib, id, Date.now());
  if (!view) notFound();

  // Topics with notes, for Move and Merge. Empty ones are hidden everywhere else too.
  const saved = new Set(lib.highlights.map((h) => h.source_id));
  const live = new Set(lib.sources.filter((s) => saved.has(s.id)).map((s) => s.topic_id));
  const others = lib.topics
    .filter((t) => t.id !== id && live.has(t.id))
    .map((t) => ({ id: t.id, title: t.title }))
    .sort((a, b) => a.title.localeCompare(b.title));
  // Every tag in the library, offered as you type one.
  const tags = [...new Set(lib.topics.flatMap((t) => t.tags ?? []))].sort();
  // Not awaited: the page shows first and the suggestions stream in, since a topic's first build waits on Gemini and Brave.
  const suggestions = me.suggestions && view.noteCount ? findSuggestions(id) : null;

  return (
    <>
      <AppHeader user={me} />
      <TopicPage view={view} others={others} tags={tags} suggestions={suggestions} offer={me.suggestions === null && view.noteCount > 0} />
    </>
  );
}

/** What reading suggestions found for the topic. They're extras, so any failure is quietly nothing. */
async function findSuggestions(id: string): Promise<Suggestions> {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  return api<Suggestions>(`/api/v1/topics/${encodeURIComponent(id)}/suggestions`, { token }).catch((e) => {
    console.error("suggestions failed", e);
    return { links: [], tags: [] };
  });
}
