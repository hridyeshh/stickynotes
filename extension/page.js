// What the extension works out from a page: the address its notes go under, the
// topic a new page is filed in, and where a saved passage sits in the page's text.
// Plain functions with no DOM or chrome.* calls, so node can test them
// (page.test.js). content.js and background.js load this file.
(function (exports) {
  // ---- Address: one source per article. The page's canonical link when it can
  // be trusted, else its own address without tracking parameters or #hash. ----
  const TRACKING = /^(utm_\w+|fbclid|gclid|dclid|msclkid|mc_cid|mc_eid|igshid|_hsenc|_hsmi)$/i;

  /** The address minus its #hash and tracking parameters. The rest of the query
   *  keeps its order and encoding, so HN's item?id= pages stay apart. */
  function cleanUrl(href) {
    const u = new URL(href);
    const query = u.search.slice(1).split('&').filter((p) => p && !TRACKING.test(p.split('=')[0])).join('&');
    const url = u.origin + u.pathname + (query ? '?' + query : '');
    // The API takes 2048 characters; past that only the query can be spared.
    return url.length > 2048 ? u.origin + u.pathname : url;
  }

  const bareHost = (h) => h.replace(/^www\./, '');

  /** The address a page's notes go under. canonical is the href of its
   *  <link rel="canonical">, if any. first is { href, canonical } as the page
   *  loaded: an app that moves to another article without reloading often leaves
   *  the old canonical link behind. */
  function pageUrl(href, canonical, first) {
    const page = new URL(href);
    try {
      const c = new URL(canonical);
      const trusted = /^https?:$/.test(c.protocol) && bareHost(c.hostname) === bareHost(page.hostname)
        && !(c.pathname === '/' && page.pathname !== '/') // sites that point every page at the homepage
        && !(first && href !== first.href && canonical === first.canonical);
      if (trusted) return cleanUrl(c.href);
    } catch {
      // no canonical link, or not a URL
    }
    return cleanUrl(href);
  }

  // ---- Topic. A new page is filed under an existing topic whose words all
  // appear in the page's title, the most specific one first; otherwise its
  // title, cleaned up, starts a new topic. ----
  const STOP = new Set(('a an and are as at by for from how in into is it its of on or the this to vs what why with your ' +
    'guide introduction intro primer tutorial overview explained beginner beginners understanding').split(' '));
  const LEAD = /^(?:(?:(?:an?|the)\s+)?(?:(?:complete|beginner'?s|quick|short|simple|gentle|visual|practical)\s+)*(?:guide|introduction|intro|primer|tutorial|overview)\s+(?:to|on|of)|understanding|what\s+(?:is|are))\s+(?:(?:an?|the)\s+)?/i;
  const TRAIL = /[\s:,–—-]+(?:(?:simply\s+)?explained|(?:an?\s+)?(?:primer|tutorial|deep dive|overview|introduction)|for beginners|in plain english|101)\W*$/i;
  const SEPARATOR = /\s+[-|–—·]\s+/;

  /** A title's words for matching: lowercase, no filler, plurals folded. */
  function words(s) {
    const out = new Set();
    for (let w of String(s || '').toLowerCase().match(/[\p{L}\p{N}]+/gu) || []) {
      if (STOP.has(w)) continue;
      if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) w = w.slice(0, -1);
      out.add(w);
    }
    return out;
  }

  const within = (a, b) => a.size > 0 && [...a].every((w) => b.has(w));

  /** The page's own title: its main heading, else the document title without the
   *  site's name ("Consistent hashing - Wikipedia" → "Consistent hashing"), with
   *  filler like "A guide to" and "explained" dropped. */
  function pageTitle({ h1, title, site }) {
    const siteWords = words(site);
    const isSite = (s) => within(words(s), siteWords);
    let t = h1 && !isSite(h1) ? h1 : String(title || '').split(SEPARATOR).filter((p) => !isSite(p))
      .reduce((a, b) => (b.length > a.length ? b : a), '');
    t = t.replace(/\s+/g, ' ').trim();
    let cut = t.replace(TRAIL, '').replace(/[?!.:]+$/, '').trim();
    const rest = cut.replace(LEAD, '');
    if (rest && rest !== cut) cut = rest[0].toUpperCase() + rest.slice(1); // "A guide to hashing" → "Hashing"
    return cut || t;
  }

  /** The topic for a page saved for the first time: { id, title } of an existing
   *  topic, or { title } for a new one. page is { h1, title, site }; topics are
   *  the ones with notes in them.
   *  ponytail: exact words with plurals folded; add stemming or synonyms if
   *  near-misses ("hash" vs "hashing") turn out to matter. */
  function topicFor(page, topics) {
    const title = pageTitle(page);
    const have = new Set([...words(page.h1), ...words(title)]);
    let best = null;
    let bestSize = 0;
    for (const t of topics) {
      const w = words(t.title);
      if (w.size > bestSize && within(w, have)) {
        best = t;
        bestSize = w.size;
      }
    }
    return best ? { id: best.id, title: best.title } : { title };
  }

  // ---- Anchors. A saved passage is found again by its text plus up to 32
  // characters either side. Everything here ignores whitespace, which pages and
  // selections lay out differently. ----
  const CONTEXT = 32;
  const strip = (s) => String(s).replace(/\s+/g, '');

  /** The anchor for text[start, end), where text is the page's text with the
   *  whitespace taken out. */
  function describe(text, start, end) {
    return { prefix: text.slice(Math.max(0, start - CONTEXT), start), suffix: text.slice(end, end + CONTEXT) };
  }

  /** Where a passage is in the page's whitespace-free text, as { start, end }, or
   *  null. Of several copies, the one whose surroundings best match the anchor. */
  function locate(text, passage, anchor) {
    const exact = strip(passage);
    if (!exact) return null;
    const prefix = String(anchor?.prefix || '');
    const suffix = String(anchor?.suffix || '');
    let best = null;
    let bestScore = -1;
    for (let i = text.indexOf(exact); i !== -1; i = text.indexOf(exact, i + 1)) {
      const end = i + exact.length;
      let score = 0;
      while (score < prefix.length && text[i - 1 - score] === prefix[prefix.length - 1 - score]) score++;
      for (let k = 0; k < suffix.length && text[end + k] === suffix[k]; k++) score++;
      if (score > bestScore) {
        best = i;
        bestScore = score;
      }
    }
    return best === null ? null : { start: best, end: best + exact.length };
  }

  exports.PG = { cleanUrl, pageUrl, pageTitle, topicFor, strip, describe, locate };
})(typeof module !== 'undefined' ? module.exports : globalThis);
