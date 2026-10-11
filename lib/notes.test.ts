import { test } from "node:test";
import assert from "node:assert/strict";
import { deviceLabel, libraryCards, libraryMarkdown, matches, timeAgo, toBackup, topicView, type Library } from "./notes.ts";

const now = Date.parse("2026-10-12T12:00:00Z");
const lib: Library = {
  topics: [
    { id: "t1", title: "Consistent hashing", is_public: true, share_slug: "abcdefghijkl", created_at: "2026-10-01T00:00:00Z" },
    { id: "t2", title: "Rate limiting", is_public: false, share_slug: null, created_at: "2026-10-01T00:00:00Z" },
    { id: "t3", title: "Emptied", is_public: false, share_slug: null, created_at: "2026-10-01T00:00:00Z" },
  ],
  sources: [
    { id: "s1", topic_id: "t1", url: "https://a.example/ring", title: "Rings [explained]", site: "a.example" },
    { id: "s2", topic_id: "t1", url: "https://b.example/vnodes", title: "Virtual nodes", site: "" },
    { id: "s3", topic_id: "t2", url: "https://c.example/bucket", title: "Token bucket", site: "c.example" },
  ],
  highlights: [
    { id: "h3", source_id: "s1", text: "Only n/m keys move.", section: "Technique", created_at: "2026-10-12T11:00:00Z" },
    { id: "h1", source_id: "s1", text: "Keys map onto a ring.", section: "History", created_at: "2026-10-09T08:00:00Z" },
    { id: "h2", source_id: "s2", text: "Virtual nodes even out load.", section: "Technique", created_at: "2026-10-10T08:00:00Z" },
    { id: "h4", source_id: "s3", text: "Tokens refill at a fixed rate.", section: "", created_at: "2026-10-12T11:59:30Z" },
  ],
};

test("topicView merges sections across sources and numbers sources by first note", () => {
  const v = topicView("Consistent hashing", lib.sources.filter((s) => s.topic_id === "t1"), lib.highlights, now);
  assert.deepEqual(v.sections.map((s) => [s.name, s.notes.map((n) => `${n.id}[${n.n}]`)]), [
    ["History", ["h1[1]"]],
    ["Technique", ["h2[2]", "h3[1]"]],
  ]);
  assert.deepEqual(v.sources.map((s) => `${s.n}:${s.id}`), ["1:s1", "2:s2"]);
  assert.equal(v.noteCount, 3);
  assert.equal(v.lastSaved, "1 h ago");
});

test("libraryCards puts the latest topic first, skips empty topics, and searches every word", () => {
  const cards = libraryCards(lib, now);
  assert.deepEqual(cards.map((c) => c.id), ["t2", "t1"]);
  assert.equal(cards[1].sites, "a.example, b.example");
  assert.deepEqual(cards[1].preview, ["Virtual nodes even out load.", "Only n/m keys move."]);
  assert.ok(matches(cards[1], "RING  virtual") && !matches(cards[1], "ring bucket"));
  assert.ok(matches(cards[0], "") && matches(cards[0], "c.example"));
});

test("timeAgo reads relative, then a UTC date", () => {
  assert.equal(timeAgo("2026-10-12T11:59:30Z", now), "just now");
  assert.equal(timeAgo("2026-10-12T11:15:00Z", now), "45 min ago");
  assert.equal(timeAgo("2026-10-11T10:00:00Z", now), "yesterday");
  assert.equal(timeAgo("2026-10-09T08:00:00Z", now), "3 days ago");
  assert.equal(timeAgo("2026-09-01T08:00:00Z", now), "1 Sept");
  assert.equal(timeAgo("2025-09-01T08:00:00Z", now), "1 Sept 2025");
});

test("Markdown has sections, [n] markers and escaped source links", () => {
  assert.equal(libraryMarkdown(lib, now), [
    "# Rate limiting", "", "- Tokens refill at a fixed rate. [1]", "", "## Sources", "", "1. [Token bucket](<https://c.example/bucket>)",
    "", "---", "",
    "# Consistent hashing", "", "## History", "", "- Keys map onto a ring. [1]", "", "## Technique", "",
    "- Virtual nodes even out load. [2]", "- Only n/m keys move. [1]", "", "## Sources", "",
    "1. [Rings \\[explained\\]](<https://a.example/ring>)", "2. [Virtual nodes](<https://b.example/vnodes>)", "",
  ].join("\n"));
});

test("toBackup writes the extension's restore format", () => {
  const b = toBackup(lib);
  assert.deepEqual(Object.keys(b).sort(), ["https://a.example/ring", "https://b.example/vnodes", "https://c.example/bucket"]);
  assert.deepEqual(b["https://a.example/ring"].notes[0], { id: "h3", text: "Only n/m keys move.", section: "Technique", createdAt: Date.parse("2026-10-12T11:00:00Z") });
  assert.equal(b["https://b.example/vnodes"].topic, "Consistent hashing");
});

test("deviceLabel names the browser and system, and the extension", () => {
  const mac = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36";
  assert.equal(deviceLabel({ client: "web", user_agent: mac }), "Chrome on macOS");
  assert.equal(deviceLabel({ client: "extension", user_agent: mac }), "stickynotes extension in Chrome on macOS");
  assert.equal(deviceLabel({ client: "web", user_agent: mac.replace("Safari/537.36", "Safari/537.36 Edg/152.0.0.0") }), "Edge on macOS");
  assert.equal(deviceLabel({ client: "web", user_agent: "node" }), "A web browser");
});
