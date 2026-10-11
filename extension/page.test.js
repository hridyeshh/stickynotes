// Run with npm test (node --test).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { PG } = require('./page.js');

test('cleanUrl drops the hash and tracking, and keeps the rest of the query as it was', () => {
  assert.equal(PG.cleanUrl('https://news.ycombinator.com/item?id=1&utm_source=x#c2'), 'https://news.ycombinator.com/item?id=1');
  assert.equal(PG.cleanUrl('https://a.example/p?q=a%20b&fbclid=Z&x=1+2'), 'https://a.example/p?q=a%20b&x=1+2');
  assert.equal(PG.cleanUrl('https://a.example/p?utm_medium=m'), 'https://a.example/p');
  assert.equal(PG.cleanUrl(`https://a.example/p?q=${'x'.repeat(3000)}`), 'https://a.example/p', 'too long for the API');
});

test('pageUrl trusts a canonical link only from the same site, and not one left over from in-app navigation', () => {
  const watch = 'https://www.youtube.com/watch?v=abc&t=42s';
  assert.equal(PG.pageUrl(watch, 'https://youtube.com/watch?v=abc'), 'https://youtube.com/watch?v=abc', 'www. or not');
  assert.equal(PG.pageUrl(watch, 'https://other.example/watch?v=abc'), watch, 'another site');
  assert.equal(PG.pageUrl('https://a.example/post/1', 'https://a.example/'), 'https://a.example/post/1', 'every page pointed at the homepage');
  assert.equal(PG.pageUrl('https://a.example/', 'https://a.example/'), 'https://a.example/');
  const first = { href: 'https://a.example/post/1', canonical: 'https://a.example/post/1' };
  assert.equal(PG.pageUrl('https://a.example/post/2', first.canonical, first), 'https://a.example/post/2', 'left behind');
  assert.equal(PG.pageUrl('https://a.example/post/2?ref=x', 'https://a.example/post/2', first), 'https://a.example/post/2', 'updated by the app');
  assert.equal(PG.pageUrl('https://a.example/p#top', undefined), 'https://a.example/p');
  assert.equal(PG.pageUrl('https://a.example/p', 'javascript:alert(1)'), 'https://a.example/p');
});

test('pageTitle prefers the main heading and drops the site name and filler', () => {
  assert.equal(PG.pageTitle({ h1: 'Consistent hashing', title: 'x', site: 'en.wikipedia.org' }), 'Consistent hashing');
  assert.equal(PG.pageTitle({ h1: 'OpenReference', title: 'Ring hashing | OpenReference', site: 'openreference.org' }), 'Ring hashing', 'an h1 that is only the site name');
  assert.equal(PG.pageTitle({ title: 'Consistent hashing - Wikipedia', site: 'en.wikipedia.org' }), 'Consistent hashing');
  assert.equal(PG.pageTitle({ title: 'Raft explained | Some Blog', site: 'someblog.dev Some Blog' }), 'Raft');
  assert.equal(PG.pageTitle({ title: 'A guide to consistent hashing' }), 'Consistent hashing');
  assert.equal(PG.pageTitle({ title: 'What is a Bloom filter?' }), 'Bloom filter');
  assert.equal(PG.pageTitle({ title: 'iPhone tips?' }), 'iPhone tips', 'case kept when no filler leads');
  assert.equal(PG.pageTitle({ title: 'Wikipedia', site: 'wikipedia.org' }), '', 'nothing but the site name');
});

test('topicFor picks the most specific topic whose words the page has, else a new one', () => {
  const topics = [
    { id: 't1', title: 'Hashing' }, { id: 't2', title: 'Consistent hashing' },
    { id: 't3', title: 'Bloom filters' }, { id: 't4', title: 'The' },
  ];
  assert.deepEqual(PG.topicFor({ h1: 'Consistent Hashing Explained' }, topics), { id: 't2', title: 'Consistent hashing' });
  assert.deepEqual(PG.topicFor({ h1: 'How hashing works' }, topics), { id: 't1', title: 'Hashing' });
  assert.deepEqual(PG.topicFor({ title: 'Bloom filter tricks - Blog', site: 'blog.example' }, topics), { id: 't3', title: 'Bloom filters' }, 'plurals fold');
  assert.deepEqual(PG.topicFor({ h1: 'The Raft paper' }, topics), { title: 'The Raft paper' }, 'a topic of only filler matches nothing');
  assert.deepEqual(PG.topicFor({ h1: 'Rendezvous hashing' }, []), { title: 'Rendezvous hashing' });
});

test('locate finds a passage again, ignoring whitespace, and picks the copy its anchor describes', () => {
  const page = PG.strip('A: the ring maps keys. B: the ring maps keys. C.');
  const exact = PG.strip('the ring maps keys');
  const second = page.lastIndexOf(exact);
  const anchor = PG.describe(page, second, second + exact.length);
  assert.ok(anchor.prefix.length <= 32 && anchor.suffix.length <= 32);
  assert.deepEqual(PG.locate(page, 'the ring\n  maps keys', anchor), { start: second, end: second + exact.length });
  assert.deepEqual(PG.locate(page, 'the ring maps keys', null), { start: page.indexOf(exact), end: page.indexOf(exact) + exact.length }, 'no anchor: the first copy');
  assert.equal(PG.locate(page, 'not on this page', anchor), null);
  assert.equal(PG.locate(page, '   ', anchor), null);
});
