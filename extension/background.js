// The only writer of the local store and the only code that calls the API.
// Content scripts and extension pages ask for things by message.
importScripts('config.js', 'sync.js');

const { API_URL, WEB_ORIGIN } = SN_CONFIG;

// ---- Store. Writes queue up here, so two tabs saving at once can't overwrite
// each other (v1 lost notes that way). ----
// ponytail: the store is one storage key rewritten on every change; split it per
// record if stores reach many MB.
let writes = Promise.resolve();
const readStore = async () => (await chrome.storage.local.get('store')).store || SN.emptyStore();
const read = () => writes.then(readStore);

function mutate(fn) {
  const run = writes.then(async () => {
    const store = await readStore();
    const result = fn(store);
    await chrome.storage.local.set({ store });
    return result;
  });
  writes = run.catch(() => {});
  return run;
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

// ---- Sync: push everything queued, then pull. Pull only lands with an empty
// outbox, so an older server copy can't undo a change still waiting to go. ----
let syncing = null;
function sync() {
  syncing ??= (async () => {
    if (!(await getAuth())) return;
    for (;;) {
      const batch = SN.nextBatch(await read());
      if (!batch.length) break;
      const res = await api('/api/v1/sync/push', { actions: batch.map(({ seq: _seq, ...action }) => action) });
      if (res.rejected.length) console.warn('stickynotes: the server rejected', res.rejected);
      await mutate((s) => {
        SN.applyTopicIds(s, res.topic_ids);
        SN.ack(s, batch);
      });
    }
    const { cursor } = await read();
    const res = await api('/api/v1/sync/pull' + (cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''));
    await mutate((s) => {
      if (!s.outbox.length) SN.applyPull(s, res);
    });
  })().finally(() => { syncing = null; });
  return syncing;
}
const syncSoon = () => sync().catch((e) => console.warn('stickynotes: sync failed:', e.message));

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
  await mutate((store) => {
    if (store.owner && store.owner !== s.user.id) Object.assign(store, SN.emptyStore());
    store.owner = s.user.id;
  });
  await chrome.storage.local.set({ auth: { access_token: s.access_token, refresh_token: s.refresh_token, user: s.user } });
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
}

// ---- Messages. Any page's content script may save; only the web app's own top
// frame may connect; only extension pages may delete or manage the account. ----
const fromWebApp = (sender) => sender.origin === WEB_ORIGIN && sender.frameId === 0;
const fromExtension = (sender) => !!sender.url?.startsWith(chrome.runtime.getURL(''));
function allow(ok) {
  if (!ok) throw new Error('Not allowed');
}

const handlers = {
  async save({ input }) {
    if (!/^https?:\/\//.test(input?.url) || typeof input.text !== 'string' || !input.text) throw new Error('Nothing to save');
    const saved = await mutate((s) => {
      const r = SN.addHighlight(s, input, () => crypto.randomUUID());
      if (!r) return null;
      const count = Object.values(s.highlights).filter((h) => s.sources[h.url]?.topic_id === r.topic.id).length;
      return { topic: r.topic.title, count };
    });
    if (saved) syncSoon();
    return saved;
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
    await mutate((s) => ids.forEach((id) => SN.removeHighlight(s, id)));
    syncSoon();
  },
  async import({ pages }, sender) {
    allow(fromExtension(sender));
    const inputs = SN.backupToInputs(pages);
    const added = await mutate((s) => inputs.filter((i) => SN.addHighlight(s, i, () => crypto.randomUUID())).length);
    syncSoon();
    return { added };
  },
  async sync(msg, sender) {
    allow(fromExtension(sender));
    await sync();
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

const askTabToSave = (tabId) =>
  chrome.tabs.sendMessage(tabId, { type: 'save-selection' }).catch(() => {});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'hn-save' && tab?.id) askTabToSave(tab.id);
});

chrome.commands.onCommand.addListener((cmd, tab) => {
  if (cmd === 'save-selection' && tab?.id) askTabToSave(tab.id);
});
