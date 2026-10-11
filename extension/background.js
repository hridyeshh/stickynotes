// The only writer of the local store and the only code that calls the API.
// Content scripts and extension pages ask for things by message.
importScripts('config.js', 'sync.js', 'page.js');

const { API_URL, WEB_ORIGIN } = SN_CONFIG;

// ---- Store. Writes queue up here, so two tabs saving at once can't overwrite
// each other (v1 lost notes that way). This worker is the only writer, so it
// keeps the store in memory rather than reading it back on every page load.
// ponytail: the store is one storage key rewritten on every change; split it per
// record if stores reach many MB. ----
let writes = Promise.resolve();
function serial(fn) {
  const run = writes.then(fn);
  writes = run.catch(() => {});
  return run;
}

let cached = null;
async function readStore() {
  if (!cached) {
    const { store } = await chrome.storage.local.get('store');
    cached ??= store || SN.emptyStore(); // a read that started before a write mustn't replace what it wrote
  }
  return cached;
}
const read = () => writes.then(readStore);

function mutate(fn) {
  return serial(async () => {
    const store = await readStore();
    try {
      const result = fn(store);
      await chrome.storage.local.set({ store });
      return result;
    } catch (e) {
      cached = null; // fn may have changed half of it; storage still has the whole copy
      throw e;
    }
  });
}

// ---- API ----
const getAuth = async () => (await chrome.storage.local.get('auth')).auth;

function request(path, { body, token } = {}) {
  return fetch(API_URL + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

/** Seconds until a JWT expires; negative when expired or unreadable. */
function secondsLeft(jwt) {
  try {
    const { exp } = JSON.parse(atob(jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return exp - Date.now() / 1000;
  } catch {
    return -1;
  }
}

// One refresh in flight: refresh tokens rotate, so two at once would race and the
// loser would be disconnected.
// ponytail: if the worker stops between the API rotating the token and us storing
// it, the session is lost and the popup asks to connect again.
let refreshing = null;
function refresh() {
  refreshing ??= (async () => {
    const auth = await getAuth();
    if (!auth) throw new Error('Not connected');
    const res = await request('/api/v1/auth/refresh', { body: { refresh_token: auth.refresh_token } });
    if (res.status === 401) {
      await chrome.storage.local.remove('auth'); // revoked or expired: only connecting again helps
      throw new Error('Not connected');
    }
    if (!res.ok) throw new Error(`Refresh failed (${res.status})`);
    const s = await res.json();
    const next = { access_token: s.access_token, refresh_token: s.refresh_token, user: s.user };
    await chrome.storage.local.set({ auth: next });
    return next;
  })().finally(() => { refreshing = null; });
  return refreshing;
}

async function api(path, body) {
  let auth = await getAuth();
  if (!auth) throw new Error('Not connected');
  if (secondsLeft(auth.access_token) < 30) auth = await refresh();
  let res = await request(path, { body, token: auth.access_token });
  if (res.status === 401) res = await request(path, { body, token: (await refresh()).access_token });
  if (!res.ok) throw new Error(`${path} failed (${res.status})`);
  return res.json();
}

// ---- Sync: push everything queued, then pull. A pull only lands with an empty
// outbox, so an older server copy can't undo a change still waiting to go; a save
// made during the pull goes out in another round. ----
async function push() {
  for (;;) {
    const batch = SN.nextBatch(await read());
    if (!batch.length) return;
    const res = await api('/api/v1/sync/push', { actions: batch.map(({ seq: _seq, ...action }) => action) });
    if (res.rejected.length) console.warn('stickynotes: the server rejected', res.rejected);
    await mutate((s) => {
      SN.applyTopicIds(s, res.topic_ids);
      SN.ack(s, batch);
    });
  }
}

let syncing = null;
function sync() {
  syncing ??= (async () => {
    if (!(await getAuth())) return;
    for (;;) {
      await push();
      const { cursor } = await read();
      const res = await api('/api/v1/sync/pull' + (cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''));
      const changed = await mutate((s) => {
        if (s.outbox.length) return null;
        const urls = new Set(res.highlights.map((h) => h.url || s.highlights[h.id]?.url));
        SN.applyPull(s, res);
        return urls;
      });
      if (changed) return refreshTabs(changed);
    }
  })().finally(() => { syncing = null; });
  return syncing;
}
const syncSoon = () => sync().catch((e) => console.warn('stickynotes: sync failed:', e.message));

// ---- Open pages. Each page's content script reports the address it shows, so
// the toolbar badge counts its notes and its marks follow changes made elsewhere:
// the popup, the notes page, another device. ----
const getTabs = async () => (await chrome.storage.session.get('tabs')).tabs || {};
const setTab = (tabId, url) => serial(async () => {
  const tabs = await getTabs();
  if (url) tabs[tabId] = url;
  else delete tabs[tabId];
  await chrome.storage.session.set({ tabs });
});

const badge = (tabId, count) =>
  chrome.action.setBadgeText({ tabId, text: count ? String(count) : '' }).catch(() => {}); // the tab may be gone
chrome.action.setBadgeBackgroundColor({ color: '#7d5411' });
chrome.action.setBadgeTextColor({ color: '#ffffff' });

/** Updates the badge and marks of open pages showing one of urls, or of every page. */
async function refreshTabs(urls) {
  try {
    const [tabs, store] = await Promise.all([getTabs(), read()]);
    for (const [id, url] of Object.entries(tabs)) {
      if (urls && !urls.has(url)) continue;
      const highlights = SN.notesFor(store, url);
      badge(+id, highlights.length);
      chrome.tabs.sendMessage(+id, { type: 'marks', url, highlights }).catch(() => {}); // closed, or not ours any more
    }
  } catch (e) {
    console.warn('stickynotes: could not update open pages:', e.message);
  }
}

chrome.tabs.onRemoved.addListener((tabId) => setTab(tabId, null));
chrome.tabs.onUpdated.addListener((tabId, change) => {
  if (change.status !== 'loading') return;
  setTab(tabId, null); // the next page's content script reports in
  badge(tabId, 0);
});

// ---- Connecting. The web app's page (through the bridge in content.js) asks for
// a PKCE challenge, has the API mint a code for it, and hands the code back. We
// redeem it with the verifier, which never leaves the extension. ----
const b64url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function connectStart() {
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  // Session storage outlives the worker sleeping mid-handshake and is closed to content scripts.
  await chrome.storage.session.set({ verifier });
  return { challenge: b64url(new Uint8Array(digest)) };
}

async function connectFinish(code) {
  const { verifier } = await chrome.storage.session.get('verifier');
  await chrome.storage.session.remove('verifier');
  if (!verifier) throw new Error('This connection attempt expired.');
  const res = await request('/api/v1/extension/token', { body: { code, code_verifier: verifier } });
  if (!res.ok) throw new Error(res.status === 401 ? 'This connection attempt expired.' : "We couldn't reach stickynotes.");
  const s = await res.json();
  // Notes saved before connecting join this account; another account's copy is dropped.
  const dropped = await mutate((store) => {
    const other = !!store.owner && store.owner !== s.user.id;
    if (other) Object.assign(store, SN.emptyStore());
    store.owner = s.user.id;
    return other;
  });
  await chrome.storage.local.set({ auth: { access_token: s.access_token, refresh_token: s.refresh_token, user: s.user } });
  if (dropped) refreshTabs(null);
  syncSoon();
  return { email: s.user.email };
}

async function disconnect() {
  await sync().catch(() => {});
  if ((await read()).outbox.length) throw new Error("Some notes haven't synced yet. Try again once you're online.");
  const auth = await getAuth();
  if (auth) await request('/api/v1/auth/logout', { body: { refresh_token: auth.refresh_token } }).catch(() => {});
  await chrome.storage.local.remove('auth');
  // The notes live on in the account; this browser keeps no copy.
  await mutate((store) => Object.assign(store, SN.emptyStore()));
  refreshTabs(null);
}

// ---- Messages. Any page's content script may report its page, save and sync,
// and may undo or refile a note it saved minutes ago (its toast). Only the web
// app's own top frame may connect; only extension pages may delete or manage the
// account. ----
const fromWebApp = (sender) => sender.origin === WEB_ORIGIN && sender.frameId === 0;
const fromExtension = (sender) => !!sender.url?.startsWith(chrome.runtime.getURL(''));
function allow(ok) {
  if (!ok) throw new Error('Not allowed');
}

/** The note a page's toast is about: saved on the sender's page in the last 10 minutes. */
async function savedHere(id, sender) {
  const [store, tabs] = await Promise.all([read(), getTabs()]);
  const h = store.highlights[id];
  allow(h && sender.tab && tabs[sender.tab.id] === h.url && Date.now() - Date.parse(h.created_at) < 10 * 60e3);
  return h;
}

/** Topics with notes in them: the ones a page can be filed under. */
function topicsInUse(store) {
  const used = new Set(Object.values(store.sources).map((s) => s.topic_id));
  return Object.values(store.topics).filter((t) => used.has(t.id));
}

const str = (v, max) => String(v ?? '').slice(0, max);

const handlers = {
  async page({ url }, sender) {
    allow(sender.tab && /^https?:\/\//.test(url));
    await setTab(sender.tab.id, url);
    const highlights = SN.notesFor(await read(), url);
    badge(sender.tab.id, highlights.length);
    return { highlights };
  },
  async save({ input }, sender) {
    if (!/^https?:\/\//.test(input?.url) || typeof input.text !== 'string' || !input.text || input.text.length > 10000) {
      throw new Error('Nothing to save');
    }
    const page = { h1: str(input.page?.h1, 300), title: str(input.page?.title, 300), site: str(input.page?.site, 300) };
    const anchor = input.anchor && { prefix: str(input.anchor.prefix, 32), suffix: str(input.anchor.suffix, 32) };
    const r = await mutate((s) => {
      const same = Object.values(s.highlights).find((h) => h.url === input.url && h.text === input.text);
      if (same) return { duplicate: true, id: same.id, section: same.section };
      const pageTitle = PG.pageTitle(page) || input.url;
      const { highlight, topic } = SN.addHighlight(s, {
        url: input.url, site: str(input.site, 255), pageTitle, topicTitle: PG.topicFor(page, topicsInUse(s)).title || pageTitle,
        text: input.text, section: str(input.section, 300), anchor,
      }, () => crypto.randomUUID());
      return { id: highlight.id, topic: topic.title, section: highlight.section };
    });
    if (sender.tab) await setTab(sender.tab.id, input.url);
    if (!r.duplicate) {
      syncSoon();
      refreshTabs(new Set([input.url]));
    }
    return r;
  },
  async sync() {
    try {
      await sync();
    } catch (e) {
      if (await getAuth()) throw e; // offline; without auth the answer is "not connected"
    }
    return { connected: !!(await getAuth()) };
  },
  async undo({ id }, sender) {
    const h = await savedHere(id, sender);
    await mutate((s) => SN.removeHighlight(s, id));
    syncSoon();
    refreshTabs(new Set([h.url]));
  },
  async topics({ id }, sender) {
    await savedHere(id, sender);
    return { topics: topicsInUse(await read()).map((t) => t.title).sort((a, b) => a.localeCompare(b)) };
  },
  async move({ id, title }, sender) {
    const h = await savedHere(id, sender);
    if (!str(title, 300).trim()) throw new Error('Name a topic.');
    const topic = await mutate((s) => SN.moveSource(s, h.url, str(title, 300), () => crypto.randomUUID()));
    if (!topic) throw new Error('This page has no notes any more.');
    syncSoon();
    return { topic: topic.title };
  },
  // The topic in the web library once it has synced; the extension's notes page otherwise.
  async view({ url }) {
    const store = await read();
    const topic = store.sources[url]?.topic_id;
    const web = topic && (await getAuth()) && !store.outbox.length;
    await chrome.tabs.create({ url: web ? `${WEB_ORIGIN}/t/${topic}` : chrome.runtime.getURL('notes.html') + (topic ? `#${topic}` : '') });
  },
  async 'connect:start'(msg, sender) {
    allow(fromWebApp(sender));
    return connectStart();
  },
  async 'connect:finish'(msg, sender) {
    allow(fromWebApp(sender));
    return connectFinish(String(msg.code));
  },
  async delete({ ids }, sender) {
    allow(fromExtension(sender));
    const urls = await mutate((s) => {
      const touched = new Set(ids.map((id) => s.highlights[id]?.url).filter(Boolean));
      ids.forEach((id) => SN.removeHighlight(s, id));
      return touched;
    });
    syncSoon();
    refreshTabs(urls);
  },
  async import({ pages }, sender) {
    allow(fromExtension(sender));
    const inputs = SN.backupToInputs(pages);
    const added = await mutate((s) => inputs.filter((i) => SN.addHighlight(s, i, () => crypto.randomUUID())).length);
    syncSoon();
    refreshTabs(new Set(inputs.map((i) => i.url)));
    return { added };
  },
  async disconnect(msg, sender) {
    allow(fromExtension(sender));
    await disconnect();
  },
};

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (!Object.hasOwn(handlers, msg?.type)) return false;
  const handler = handlers[msg.type];
  handler(msg, sender).then((r) => reply(r ?? {}), (e) => reply({ error: e.message }));
  return true; // the reply comes later
});

// ---- Triggers: saves sync right away, the popup syncs when opened, and this
// alarm pulls other devices' changes and retries failed pushes. ----
chrome.alarms.get('sync').then((a) => a || chrome.alarms.create('sync', { periodInMinutes: 5 }));
chrome.alarms.onAlarm.addListener((a) => {
  if (a.name === 'sync') syncSoon();
});
chrome.runtime.onStartup.addListener(syncSoon);

// ---- Context menu and Alt+S, from v1 ----
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: 'hn-save', title: 'Save to notes', contexts: ['selection'] });
});

// Chrome only runs content scripts in pages loaded after the extension, so a tab
// open since before it was installed, reloaded or updated has none listening. The
// menu click or Alt+S grants activeTab, which lets us put one in and ask again.
async function askTabToSave(tabId) {
  const ask = () => chrome.tabs.sendMessage(tabId, { type: 'save-selection' });
  try {
    await ask();
  } catch {
    try {
      await chrome.scripting.insertCSS({ target: { tabId }, files: ['content.css'] });
      await chrome.scripting.executeScript({ target: { tabId }, files: ['config.js', 'page.js', 'content.js'] });
      await ask();
    } catch (e) {
      console.warn("stickynotes: can't save on this page:", e.message); // chrome:// pages, the Web Store
    }
  }
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'hn-save' && tab?.id) askTabToSave(tab.id);
});

chrome.commands.onCommand.addListener((cmd, tab) => {
  if (cmd === 'save-selection' && tab?.id) askTabToSave(tab.id);
});
