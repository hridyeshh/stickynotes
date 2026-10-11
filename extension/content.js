(() => {
  // background.js may inject this into a page that runs it already (askTabToSave).
  if (globalThis.snContent) return;
  globalThis.snContent = true;

  const MIN_LEN = 3;
  const MAX_LEN = 10000; // the server's limit
  let autoSave = false;

  chrome.storage.local.get('settings', ({ settings }) => { autoSave = !!settings?.autoSave; });
  chrome.storage.onChanged.addListener((c) => {
    if (c.settings) autoSave = !!c.settings.newValue?.autoSave;
  });

  // One source per URL. The query string stays, so HN's item?id= and YouTube's
  // watch?v= pages stay apart; only the #hash goes.
  const pageUrl = () => location.href.split('#')[0];
  const clean = (s) => (s || '').replace(/\s+/g, ' ').trim().slice(0, 200);

  // ---- Heading detection ----
  function pageHeading() {
    const h1 = [...document.querySelectorAll('h1')]
      .find((h) => h.offsetParent !== null && h.innerText.trim());
    if (h1) return clean(h1.innerText);
    const og = document.querySelector('meta[property="og:title"]')?.content;
    if (og) return clean(og);
    // "Consistent hashing - Wikipedia" -> "Consistent hashing"
    return clean(document.title.split(/\s[-|–—·]\s/)[0]) || location.hostname;
  }

  // Nearest h2/h3/h4 above the selection = the sub-section you were reading
  function sectionHeading(node) {
    const el = node.nodeType === 1 ? node : node.parentElement;
    if (!el) return null;
    let found = null;
    for (const h of document.querySelectorAll('h2, h3, h4')) {
      if (h.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) found = h;
      else break;
    }
    if (!found) return null;
    const t = clean(found.innerText.replace(/\[\s*edit\s*\]/gi, ''));
    return t || null;
  }

  // ---- Visual highlight of saved text (CSS Custom Highlight API) ----
  const savedRanges = [];
  function markRange(range) {
    if (!window.CSS?.highlights || typeof Highlight === 'undefined') return;
    savedRanges.push(range);
    CSS.highlights.set('hn-saved', new Highlight(...savedRanges));
  }

  // ---- UI (shadow DOM so page CSS can't break it) ----
  const host = document.createElement('div');
  host.style.cssText = 'all:initial;position:fixed;top:0;left:0;z-index:2147483647;';
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `
    <style>
      .btn{position:fixed;display:none;padding:6px 10px;border-radius:8px;border:0;
        background:#1f2937;color:#fff;font:600 12px/1 system-ui,sans-serif;cursor:pointer;
        box-shadow:0 4px 14px rgba(0,0,0,.25)}
      .btn:hover{background:#111827}
      .toast{position:fixed;right:16px;bottom:16px;max-width:320px;padding:10px 14px;border-radius:10px;
        background:#1f2937;color:#fff;font:13px/1.4 system-ui,sans-serif;opacity:0;
        transition:opacity .2s;pointer-events:none;box-shadow:0 4px 14px rgba(0,0,0,.25)}
      .toast.show{opacity:1}
    </style>
    <button class="btn">＋ Save note</button>
    <div class="toast"></div>`;
  const btn = root.querySelector('.btn');
  const toastEl = root.querySelector('.toast');
  (document.body || document.documentElement).appendChild(host);

  let toastTimer;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2000);
  }
  const hideBtn = () => { btn.style.display = 'none'; };

  function isEditable() {
    const a = document.activeElement;
    return a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.isContentEditable);
  }

  // An extension reload or update orphans this script: the page keeps running it,
  // but chrome.* is gone and its calls throw instead of rejecting.
  const send = async (msg) => chrome.runtime.sendMessage(msg);

  // ---- Save. The background worker files it, so tabs never overwrite each other. ----
  async function saveSelection() {
    hideBtn();
    const sel = window.getSelection();
    const text = (sel?.toString() || '').replace(/\s+/g, ' ').trim();
    if (!text || text.length < MIN_LEN || !sel.rangeCount) return false;
    if (!/^https?:$/.test(location.protocol)) { toast('Notes can only be saved on web pages.'); return false; }
    if (text.length > MAX_LEN) { toast('That selection is too long to save.'); return false; }

    const range = sel.getRangeAt(0).cloneRange();
    const title = pageHeading();
    const res = await send({
      type: 'save',
      // ponytail: the topic is the page heading until phase 4's topic matcher.
      input: { url: pageUrl(), pageTitle: title, site: location.hostname, topicTitle: title, text, section: sectionHeading(range.startContainer) || '' },
    }).catch(() => ({ error: 'stickynotes was updated. Reload this page to save again.' }));
    if (res?.error) { toast(res.error); return false; }
    if (!res?.topic) { toast('Already in your notes'); return false; }

    markRange(range);
    sel.removeAllRanges();
    toast(`Saved to “${res.topic}” (${res.count})`);
    return true;
  }

  btn.addEventListener('mousedown', (e) => e.preventDefault()); // keep selection alive
  btn.addEventListener('click', saveSelection);

  document.addEventListener('mouseup', (e) => {
    if (!chrome.runtime?.id) return host.remove(); // orphaned (see send): a fresh copy takes over
    if (e.composedPath().includes(host)) return;
    setTimeout(() => {
      const sel = window.getSelection();
      const text = sel?.toString().trim();
      if (!text || text.length < MIN_LEN || isEditable()) return hideBtn();
      if (autoSave) return void saveSelection();
      const rect = sel.getRangeAt(0).getBoundingClientRect();
      btn.style.top = Math.max(8, rect.top - 38) + 'px';
      btn.style.left = Math.min(window.innerWidth - 110, Math.max(8, rect.right - 90)) + 'px';
      btn.style.display = 'block';
    }, 10);
  });
  document.addEventListener('mousedown', (e) => { if (!e.composedPath().includes(host)) hideBtn(); });
  window.addEventListener('scroll', hideBtn, { passive: true });

  chrome.runtime.onMessage.addListener((msg, _s, reply) => {
    if (msg?.type === 'save-selection') { saveSelection().then(reply); return true; }
  });

  // ---- Bridge to the web app, for connecting this browser. Only on the app's own
  // origin and top frame, and only for messages the page itself posted. Tokens never
  // pass through here: the page gets a challenge and returns a single-use code. ----
  if (location.origin === SN_CONFIG.WEB_ORIGIN && window === window.top) {
    let started = false;
    const post = (msg) => window.postMessage(msg, SN_CONFIG.WEB_ORIGIN);
    const ask = (msg) => send(msg).catch(() => ({ error: 'The extension was updated. Reload this page.' }));
    window.addEventListener('message', async (e) => {
      if (e.source !== window || e.origin !== SN_CONFIG.WEB_ORIGIN || typeof e.data?.type !== 'string') return;
      if (e.data.type === 'sn:hello' && !started) {
        started = true;
        const r = await ask({ type: 'connect:start' });
        post(r.challenge ? { type: 'sn:challenge', challenge: r.challenge } : { type: 'sn:error', error: r.error });
      } else if (e.data.type === 'sn:code' && typeof e.data.code === 'string') {
        const r = await ask({ type: 'connect:finish', code: e.data.code });
        post(r.email ? { type: 'sn:connected', email: r.email } : { type: 'sn:error', error: r.error });
      }
    });
    post({ type: 'sn:ready' });
  }
})();
