// The local note store and its outbox. Plain functions over plain objects with no
// chrome.* calls, so node can test them (sync.test.js). Only background.js writes
// the store; pages and content scripts read the stored copy.
//
// store = {
//   owner:      the account id it belongs to ('' before the first connect),
//   topics:     { [id]: { id, title } },
//   sources:    { [url]: { url, topic_id, title, site } },
//   highlights: { [id]: { id, url, text, section, anchor, created_at } },
//   outbox:     actions for POST /sync/push, each with a local seq number,
//   seq, cursor (from the last pull)
// }
(function (exports) {
  function emptyStore() {
    return { owner: '', topics: {}, sources: {}, highlights: {}, outbox: [], seq: 0, cursor: '' };
  }

  const sameTitle = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();

  function queue(store, action) {
    store.outbox.push({ ...action, seq: ++store.seq });
  }

  /** The topic with this title, or a new one queued for the server. */
  function topicNamed(store, title, uuid) {
    let topic = Object.values(store.topics).find((t) => sameTitle(t.title, title));
    if (!topic) {
      topic = { id: uuid(), title };
      store.topics[topic.id] = topic;
      queue(store, { type: 'create_topic', id: topic.id, title });
    }
    return topic;
  }

  /** Saves a passage and queues it for the server. Returns { highlight, topic }, or
   *  null when the page already has this exact text. A page saved from before keeps
   *  its topic; otherwise the topic is found by title, or made. */
  function addHighlight(store, input, uuid) {
    const { url, text } = input;
    if (Object.values(store.highlights).some((h) => h.url === url && h.text === text)) return null;

    const title = (input.topicTitle || input.pageTitle || url).trim().slice(0, 300);
    let source = store.sources[url];
    const topic = (source && store.topics[source.topic_id]) || topicNamed(store, title, uuid);
    if (!source) {
      source = { url, topic_id: topic.id, title: input.pageTitle || title, site: input.site || '' };
      store.sources[url] = source;
    }
    const at = new Date(input.createdAt || Date.now());
    const highlight = {
      id: uuid(), url, text, section: input.section || '', anchor: input.anchor ?? null,
      created_at: (isNaN(at) ? new Date() : at).toISOString(),
    };
    store.highlights[highlight.id] = highlight;
    queue(store, {
      type: 'create_highlight', id: highlight.id, topic_id: topic.id, url, page_title: source.title, site: source.site,
      text, section: highlight.section, anchor: highlight.anchor, created_at: highlight.created_at,
    });
    return { highlight, topic };
  }

  /** Deletes a highlight here and queues the deletion. A source left with no
   *  highlights goes too, as it does on the server. */
  function removeHighlight(store, id) {
    const h = store.highlights[id];
    if (!h) return false;
    delete store.highlights[id];
    queue(store, { type: 'delete_highlight', id });
    if (!Object.values(store.highlights).some((x) => x.url === h.url)) delete store.sources[h.url];
    return true;
  }

  /** Files a page, with all its notes, under the topic with this title (made if
   *  need be) and queues the move. Returns the topic, or null for an unknown page.
   *  The topic it leaves stays, empty; topic matching skips empty topics. */
  function moveSource(store, url, title, uuid) {
    const source = store.sources[url];
    if (!source) return null;
    const topic = topicNamed(store, title.trim().slice(0, 300), uuid);
    if (source.topic_id !== topic.id) {
      source.topic_id = topic.id;
      queue(store, { type: 'move_source', url, topic_id: topic.id });
    }
    return topic;
  }

  /** A page's notes, oldest first. */
  function notesFor(store, url) {
    return Object.values(store.highlights).filter((h) => h.url === url)
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
  }

  /** Applies the server's topic merges (client id → the id that won) to the store
   *  and to actions still queued. */
  function applyTopicIds(store, ids) {
    for (const [from, to] of Object.entries(ids || {})) {
      const topic = store.topics[from];
      delete store.topics[from];
      if (topic && !store.topics[to]) store.topics[to] = { ...topic, id: to };
      for (const s of Object.values(store.sources)) if (s.topic_id === from) s.topic_id = to;
      for (const a of store.outbox) if (a.topic_id === from) a.topic_id = to;
    }
  }

  /** The next actions to push: at most 100 and maxBytes of JSON (the API takes 1 MB
   *  per request), and always at least one. */
  function nextBatch(store, maxBytes = 512 * 1024) {
    const batch = [];
    let bytes = 0;
    for (const a of store.outbox) {
      bytes += new TextEncoder().encode(JSON.stringify(a)).length + 1;
      if (batch.length && (batch.length === 100 || bytes > maxBytes)) break;
      batch.push(a);
    }
    return batch;
  }

  /** Drops pushed actions from the outbox, matched by seq: saves made while the
   *  push was in flight are queued behind them and must stay. */
  function ack(store, batch) {
    const sent = new Set(batch.map((a) => a.seq));
    store.outbox = store.outbox.filter((a) => !sent.has(a.seq));
  }

  /** Merges a pull into the store. Pull only with an empty outbox, so the server's
   *  copy is never older than a change still waiting here. */
  function applyPull(store, res) {
    for (const t of res.topics) {
      if (t.deleted) delete store.topics[t.id];
      else store.topics[t.id] = { id: t.id, title: t.title };
    }
    for (const s of res.sources) {
      if (s.deleted) delete store.sources[s.url];
      else store.sources[s.url] = { url: s.url, topic_id: s.topic_id, title: s.title, site: s.site };
    }
    for (const h of res.highlights) {
      if (h.deleted) delete store.highlights[h.id];
      // ISO in UTC like local saves, so created_at strings sort correctly.
      else store.highlights[h.id] = { id: h.id, url: h.url, text: h.text, section: h.section, anchor: h.anchor ?? null, created_at: new Date(h.created_at).toISOString() };
    }
    store.cursor = res.cursor;
  }

  /** Our backup format: v1's pages object, with each page's topic added. */
  function toBackup(store) {
    const pages = {};
    for (const h of Object.values(store.highlights)) {
      const s = store.sources[h.url] || { title: h.url, site: '' };
      pages[h.url] ??= { url: h.url, title: s.title, site: s.site, topic: store.topics[s.topic_id]?.title || s.title, notes: [] };
      pages[h.url].notes.push({ id: h.id, text: h.text, section: h.section, createdAt: Date.parse(h.created_at) });
    }
    return pages;
  }

  /** Reads a backup, ours or v1's (no topic: the page title stands in), as
   *  addHighlight inputs. Only http(s) pages, the only kind the server keeps. */
  function backupToInputs(pages) {
    const inputs = [];
    for (const p of Object.values(pages && typeof pages === 'object' ? pages : {})) {
      if (!/^https?:\/\//.test(p?.url) || !Array.isArray(p.notes)) continue;
      const title = String(p.title || p.url);
      for (const n of p.notes) {
        const text = String(n?.text ?? '').replace(/\s+/g, ' ').trim().slice(0, 10000);
        if (!text) continue;
        inputs.push({
          url: p.url, pageTitle: title, site: String(p.site || ''), topicTitle: String(p.topic || title),
          text, section: String(n.section || ''), createdAt: n.createdAt,
        });
      }
    }
    return inputs;
  }

  exports.SN = {
    emptyStore, addHighlight, removeHighlight, moveSource, notesFor, applyTopicIds, nextBatch, ack, applyPull, toBackup, backupToInputs,
  };
})(typeof module !== 'undefined' ? module.exports : globalThis);
