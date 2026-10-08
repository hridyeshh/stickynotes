// Run with npm test (node --test).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { SN } = require('./sync.js');

let n = 0;
const uuid = () => `id-${++n}`;
const page = (over = {}) => ({
  url: 'https://a.example/ring', pageTitle: 'Rings', site: 'a.example', topicTitle: 'Consistent hashing',
  text: 'Keys map onto a ring.', section: 'Intro', ...over,
});

test('addHighlight files by topic title, once per text per page', () => {
  const s = SN.emptyStore();
  const first = SN.addHighlight(s, page(), uuid);
  assert.equal(first.topic.title, 'Consistent hashing');
  assert.equal(SN.addHighlight(s, page(), uuid), null, 'same text, same page');
  const other = SN.addHighlight(s, page({ url: 'https://b.example/', topicTitle: ' consistent HASHING', text: 'Other.' }), uuid);
  assert.equal(other.topic.id, first.topic.id, 'titles match ignoring case and spaces');
  const renamed = SN.addHighlight(s, page({ topicTitle: 'A new heading', text: 'Third.' }), uuid);
  assert.equal(renamed.topic.id, first.topic.id, 'a page saved from before keeps its topic');
  assert.deepEqual(s.outbox.map((a) => [a.type, a.seq]), [['create_topic', 1], ['create_highlight', 2], ['create_highlight', 3], ['create_highlight', 4]]);
  assert.equal(s.outbox[1].topic_id, first.topic.id);
});

test('removeHighlight queues the delete and drops an emptied source', () => {
  const s = SN.emptyStore();
  const a = SN.addHighlight(s, page(), uuid).highlight;
  const b = SN.addHighlight(s, page({ text: 'Second.' }), uuid).highlight;
  SN.removeHighlight(s, a.id);
  assert.ok(s.sources['https://a.example/ring'], 'b still uses the source');
  SN.removeHighlight(s, b.id);
  assert.equal(s.sources['https://a.example/ring'], undefined);
  assert.equal(SN.removeHighlight(s, 'missing'), false);
  assert.deepEqual(s.outbox.filter((x) => x.type === 'delete_highlight').map((x) => x.id), [a.id, b.id]);
});

test('applyTopicIds moves the store and queued actions to the merged id', () => {
  const s = SN.emptyStore();
  const { topic } = SN.addHighlight(s, page(), uuid);
  SN.applyTopicIds(s, { [topic.id]: 'server-topic' });
  assert.equal(s.topics[topic.id], undefined);
  assert.equal(s.topics['server-topic'].title, 'Consistent hashing');
  assert.equal(s.sources['https://a.example/ring'].topic_id, 'server-topic');
  assert.equal(s.outbox.find((a) => a.type === 'create_highlight').topic_id, 'server-topic');
});

test('ack drops only what was sent, even with saves queued meanwhile', () => {
  const s = SN.emptyStore();
  SN.addHighlight(s, page(), uuid);
  const batch = SN.nextBatch(s);
  SN.addHighlight(s, page({ text: 'Saved during the push.' }), uuid);
  SN.ack(s, batch);
  assert.deepEqual(s.outbox.map((a) => a.text), ['Saved during the push.']);
});

test('nextBatch caps count and size but always sends one', () => {
  const s = SN.emptyStore();
  for (let i = 0; i < 150; i++) SN.addHighlight(s, page({ text: `Note ${i}` }), uuid);
  assert.equal(SN.nextBatch(s).length, 100);
  assert.equal(SN.nextBatch(s, 1).length, 1);
});

test('applyPull adds, updates and deletes, and keeps the cursor', () => {
  const s = SN.emptyStore();
  const { highlight } = SN.addHighlight(s, page(), uuid);
  s.outbox = [];
  SN.applyPull(s, {
    topics: [{ id: 't2', title: 'Load balancing', deleted: false }],
    sources: [
      { url: 'https://b.example/', topic_id: 't2', title: 'LB', site: 'b.example', deleted: false },
      { url: 'https://a.example/ring', deleted: true },
    ],
    highlights: [
      { id: 'h2', url: 'https://b.example/', text: 'Spread it.', section: '', anchor: null, created_at: '2026-10-09T13:30:00+05:30', deleted: false },
      { id: highlight.id, deleted: true },
    ],
    cursor: 'c1',
  });
  assert.deepEqual(Object.keys(s.highlights), ['h2']);
  assert.deepEqual(Object.keys(s.sources), ['https://b.example/']);
  assert.equal(s.topics.t2.title, 'Load balancing');
  assert.equal(s.highlights.h2.created_at, '2026-10-09T08:00:00.000Z', 'UTC, like local saves');
  assert.equal(s.cursor, 'c1');
});

test('backups round-trip, v1 files import, non-web pages are skipped', () => {
  const s = SN.emptyStore();
  const at = Date.parse('2026-01-02T03:04:05Z');
  SN.addHighlight(s, page({ createdAt: at }), uuid);
  assert.deepEqual(SN.backupToInputs(SN.toBackup(s)).map((i) => [i.url, i.topicTitle, i.text, i.createdAt]),
    [['https://a.example/ring', 'Consistent hashing', 'Keys map onto a ring.', at]]);

  const v1 = {
    'https://news.example/item': { url: 'https://news.example/item', title: 'Item', site: 'news.example', notes: [{ id: 'x', text: ' A  note ', section: null, createdAt: 1 }] },
    'file:///tmp/a.html': { url: 'file:///tmp/a.html', title: 'Local', notes: [{ text: 'skipped' }] },
  };
  assert.deepEqual(SN.backupToInputs(v1).map((i) => [i.topicTitle, i.text, i.section]), [['Item', 'A note', '']]);
  assert.deepEqual(SN.backupToInputs(null), []);
  assert.ok(SN.addHighlight(SN.emptyStore(), page({ createdAt: 'garbage' }), uuid), 'a bad date falls back to now');
});
