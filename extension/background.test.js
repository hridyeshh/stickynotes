// Run with npm test (node --test). Loads background.js against a stand-in chrome.*
// with no account connected, so nothing reaches the network, unless a test stands in for the API too.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { SN } = require('./sync.js');

// Objects made inside the worker's context have its own prototypes; a JSON copy
// lets assert compare them.
const copy = (v) => (v === undefined ? v : JSON.parse(JSON.stringify(v)));

function loadWorker({ local = {}, fetch = () => { throw new Error('no network in tests'); } } = {}) {
  const areas = { local: structuredClone(local), session: {}, sync: {} };
  const area = (data) => ({
    get: async (key) => (key in data ? { [key]: structuredClone(data[key]) } : {}),
    set: async (items) => { for (const [k, v] of Object.entries(items)) data[k] = structuredClone(v); },
    remove: async (key) => { delete data[key]; },
  });
  const listeners = {};
  const on = (name) => ({ addListener: (fn) => { listeners[name] = fn; } });
  const badges = {};
  const sent = [];
  const opened = [];
  const chrome = {
    storage: { local: area(areas.local), session: area(areas.session), sync: area(areas.sync) },
    runtime: { onMessage: on('message'), onStartup: on('startup'), onInstalled: on('installed'), getURL: (p) => `chrome-extension://sn/${p}` },
    action: { setBadgeText: async ({ tabId, text }) => { badges[tabId] = text; }, setBadgeBackgroundColor() {}, setBadgeTextColor() {} },
    tabs: {
      onRemoved: on('removed'), onUpdated: on('updated'),
      sendMessage: async (tabId, msg) => { sent.push(copy({ tabId, ...msg })); },
      create: async ({ url }) => { opened.push(url); },
    },
    alarms: { get: async () => ({}), create() {}, onAlarm: on('alarm') },
    contextMenus: { create() {}, onClicked: on('menu') },
    commands: { onCommand: on('command') },
  };
  const ctx = vm.createContext({ chrome, console, crypto, URL, TextEncoder, atob, btoa, fetch });
  ctx.importScripts = (...files) => files.forEach((f) => vm.runInContext(fs.readFileSync(path.join(__dirname, f), 'utf8'), ctx));
  vm.runInContext(fs.readFileSync(path.join(__dirname, 'background.js'), 'utf8'), ctx);
  const send = (msg, sender) => new Promise((reply) => listeners.message(msg, sender, (r) => reply(copy(r))));
  const settle = () => new Promise((done) => setTimeout(done, 20));
  return { send, settle, areas, badges, sent, opened, listeners };
}

const page = (id, url) => ({ tab: { id }, frameId: 0, url });
const save = (url, h1, text) => ({ type: 'save', input: { url, site: new URL(url).hostname, page: { h1, title: '', site: '' }, text, section: 'Intro' } });

test('pages save, are filed by topic, and keep their badge and marks up to date', async () => {
  const w = loadWorker();
  const a = page(1, 'https://a.example/ring');
  const b = page(2, 'https://b.example/why');
  assert.deepEqual(await w.send({ type: 'page', url: 'https://a.example/ring' }, a), { highlights: [] });

  const first = await w.send(save('https://a.example/ring', 'Consistent hashing explained', 'Keys map onto a ring.'), a);
  assert.equal(first.topic, 'Consistent hashing');
  await w.settle();
  assert.equal(w.badges[1], '1');
  assert.deepEqual(w.sent.at(-1).highlights.map((h) => h.text), ['Keys map onto a ring.'], 'the page is told its marks');

  const second = await w.send(save('https://b.example/why', 'Why consistent hashing matters', 'Nodes come and go.'), b);
  assert.equal(second.topic, 'Consistent hashing', 'filed under the existing topic');
  assert.deepEqual(await w.send(save('https://a.example/ring', 'x', 'Keys map onto a ring.'), a), { duplicate: true, id: first.id, section: 'Intro' });
  assert.deepEqual(await w.send({ type: 'sync' }, a), { connected: false });
});

test('a page may undo or refile only what it just saved; only extension pages delete', async () => {
  const w = loadWorker();
  const a = page(1, 'https://a.example/ring');
  const b = page(2, 'https://b.example/why');
  const { id } = await w.send(save('https://a.example/ring', 'Consistent hashing', 'Keys map onto a ring.'), a);
  await w.send({ type: 'page', url: 'https://b.example/why' }, b);

  assert.deepEqual(await w.send({ type: 'undo', id }, b), { error: 'Not allowed' }, 'another tab');
  assert.deepEqual(await w.send({ type: 'topics', id }, b), { error: 'Not allowed' });
  assert.deepEqual(await w.send({ type: 'delete', ids: [id] }, a), { error: 'Not allowed' }, 'a page, not the extension');
  assert.deepEqual(await w.send({ type: 'topics', id }, a), { topics: ['Consistent hashing'] });

  assert.deepEqual(await w.send({ type: 'move', id, title: 'Rings' }, a), { topic: 'Rings' });
  const { store } = w.areas.local;
  const rings = Object.values(store.topics).find((t) => t.title === 'Rings');
  assert.equal(store.sources['https://a.example/ring'].topic_id, rings.id);
  assert.equal(w.areas.local.current.title, 'Rings', 'Change makes it the topic you are reading in');
  assert.deepEqual(store.outbox.map((x) => x.type), ['create_topic', 'create_highlight', 'create_topic', 'move_source']);

  assert.deepEqual(await w.send({ type: 'undo', id }, a), {});
  await w.settle();
  assert.equal(w.areas.local.store.highlights[id], undefined);
  assert.equal(w.badges[1], '');
  assert.deepEqual(await w.send({ type: 'view', url: 'https://a.example/ring' }, a), {});
  assert.equal(w.opened.at(-1), 'chrome-extension://sn/notes.html', 'no topic left: the whole notes page');

  w.listeners.updated(1, { status: 'loading' });
  await w.settle();
  assert.deepEqual(Object.keys(w.areas.session.tabs), ['2'], 'a tab that navigates away is forgotten');
});

test('a page shows notes saved under its old address too, and keeps them after a new save', async () => {
  const w = loadWorker();
  const raw = 'https://video.example/watch?v=1&list=2&start=1'; // saved before phase 4
  const canonical = 'https://video.example/watch?v=1&list=2'; // what the page files under now
  const tab = page(1, raw);
  await w.send(save(raw, 'A talk', 'An old passage.'), tab);
  await w.settle();

  const r = await w.send({ type: 'page', url: canonical, also: [canonical, raw, 'javascript:alert(1)'] }, tab);
  assert.deepEqual(r.highlights.map((h) => h.text), ['An old passage.']);
  assert.deepEqual(w.areas.session.tabs[1], [canonical, raw], 'tracked under both, never a non-web URL');

  await w.send(save(canonical, 'A talk', 'A new passage.'), tab);
  await w.settle();
  assert.deepEqual(w.sent.at(-1).highlights.map((h) => h.text), ['An old passage.', 'A new passage.'], 'the new save repaints both');
  assert.equal(w.badges[1], '2');
});

test('new pages go to the topic you are reading in until you pick another; notes keep their colour', async () => {
  const w = loadWorker();
  const ring = 'https://a.example/ring';
  const bread = 'https://b.example/starter';
  const rye = 'https://c.example/rye';
  const plan = (url, h1, id) => w.send({ type: 'plan', url, page: { h1, title: '', site: '' } }, page(id, url));

  assert.deepEqual(await plan(ring, 'Consistent hashing explained', 1), { topic: 'Consistent hashing', topics: [], color: 'yellow' });
  await w.send(save(ring, 'Consistent hashing explained', 'Keys map onto a ring.'), page(1, ring));
  await w.settle(); // saves a few ms apart, so "most recent" is clear

  // A page about something else still goes to the topic you are reading in...
  assert.equal((await plan(bread, 'Sourdough starters', 2)).topic, 'Consistent hashing');
  const second = await w.send(save(bread, 'Sourdough starters', 'Feed it daily.'), page(2, bread));
  assert.equal(second.topic, 'Consistent hashing');
  await w.settle();

  // ...until you pick one on the bar: the page moves there with its notes, in the colour you clicked.
  const pick = save(bread, 'Sourdough starters', 'Discard half first.');
  const third = await w.send({ ...pick, input: { ...pick.input, topic: 'Sourdough', color: 'pink' } }, page(2, bread));
  assert.equal(third.topic, 'Sourdough');
  const { store } = w.areas.local;
  assert.equal(store.topics[store.sources[bread].topic_id].title, 'Sourdough');
  assert.deepEqual([store.highlights[second.id].color, store.highlights[third.id].color], ['yellow', 'pink']);
  assert.equal(store.outbox.at(-1).color, 'pink', 'the server gets the colour');

  // The next page follows your pick, in your last colour; topics come most recent first.
  assert.deepEqual(await plan(rye, 'Rye bread', 3), { topic: 'Sourdough', topics: ['Sourdough', 'Consistent hashing'], color: 'pink' });

  // Three hours without a save let go: the page decides again.
  w.areas.local.current.at -= 3 * 3600e3;
  assert.equal((await plan(rye, 'Rye bread', 3)).topic, 'Rye bread');
});

test('connecting another account keeps the notes that never synced, and View waits for a save to land', async () => {
  // This browser was last connected to an account since deleted: one note reached it, two were saved after.
  let n = 0;
  const old = SN.emptyStore();
  const note = (text, extra) => ({ url: 'https://a.example/ring', pageTitle: 'Rings', site: 'a.example', topicTitle: 'Consistent hashing', text, section: 'Intro', ...extra });
  SN.addHighlight(old, note('Synced long ago.'), () => `old-${++n}`);
  old.outbox = [];
  SN.addHighlight(old, note('Saved since.', { anchor: { prefix: 'Rings. ', suffix: ' Next' }, color: 'pink' }), () => `old-${++n}`);
  SN.removeHighlight(old, SN.addHighlight(old, note('Saved, then deleted.'), () => `old-${++n}`).highlight.id);
  old.owner = 'deleted-account';

  const pushed = [];
  const reply = (data) => ({ ok: true, status: 200, json: async () => data });
  const w = loadWorker({
    local: { store: old },
    fetch: async (url, { body } = {}) => {
      const route = new URL(url).pathname;
      if (route === '/api/v1/extension/token') {
        const exp = Date.now() / 1000 + 900;
        return reply({ access_token: `x.${btoa(JSON.stringify({ exp }))}.y`, refresh_token: 'r', user: { id: 'new-account', email: 'me@example.com' } });
      }
      if (route === '/api/v1/sync/push') {
        pushed.push(...JSON.parse(body).actions);
        return reply({ topic_ids: {}, rejected: [] });
      }
      return reply({ topics: [], sources: [], highlights: [], cursor: 'c' }); // pull
    },
  });

  const app = { origin: 'http://localhost:3000', frameId: 0, tab: { id: 9 } };
  assert.ok((await w.send({ type: 'connect:start' }, app)).challenge);
  assert.deepEqual(await w.send({ type: 'connect:finish', code: 'c' }, app), { email: 'me@example.com' });
  await w.settle();
  assert.deepEqual(pushed.map((a) => [a.type, a.title ?? a.text]), [['create_topic', 'Consistent hashing'], ['create_highlight', 'Saved since.']]);
  assert.deepEqual([pushed[1].anchor, pushed[1].color, pushed[1].section], [{ prefix: 'Rings. ', suffix: ' Next' }, 'pink', 'Intro']);
  const { store } = w.areas.local;
  assert.equal(store.owner, 'new-account');
  assert.deepEqual(Object.values(store.highlights).map((h) => h.text), ['Saved since.'], "the old account's copy is gone");
  assert.deepEqual(store.outbox, []);

  // The toast's View comes while its save is still on the way: it waits, then opens the topic on the web.
  const why = page(2, 'https://b.example/why');
  await w.send(save('https://b.example/why', 'Why consistent hashing matters', 'Nodes come and go.'), why);
  await w.send({ type: 'view', url: 'https://b.example/why' }, why);
  assert.equal(w.opened.at(-1), `http://localhost:3000/t/${w.areas.local.store.sources['https://b.example/why'].topic_id}`);
  assert.equal(pushed.at(-1).text, 'Nodes come and go.');

  await w.send({ type: 'connect' }, why);
  assert.equal(w.opened.at(-1), 'http://localhost:3000/extension/connect', "the toast's Connect");
});
