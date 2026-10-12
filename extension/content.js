// Runs on every page: the Save note button, the toast after a save, and marks on
// passages saved before. Saving and storing go through background.js; page.js
// works out the page's address and title and where a passage sits in its text.
(() => {
  // background.js may inject this into a page that runs it already (askTabToSave).
  if (globalThis.snContent) return;
  globalThis.snContent = true;

  const MIN_LEN = 3;
  const MAX_LEN = 10000; // the server's limit
  const COLORS = ['yellow', 'pink', 'blue', 'green']; // as in sync.js
  const web = /^https?:$/.test(location.protocol);
  const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();
  // An extension reload or update orphans this script: the page keeps running it,
  // but chrome.* is gone and its calls throw instead of rejecting.
  const send = async (msg) => {
    try {
      return (await chrome.runtime.sendMessage(msg)) || {};
    } catch {
      return { error: 'stickynotes was updated. Reload this page.' };
    }
  };

  // Auto-save lives in its own storage area, so pages aren't sent the whole note
  // store every time it changes.
  let autoSave = false;
  // A copy orphaned by an extension reload (see send) gets "Extension context invalidated" here; it has no settings to read.
  chrome.storage.sync.get('settings').then(({ settings }) => { autoSave = !!settings?.autoSave; }, () => {});
  chrome.storage.sync.onChanged.addListener((c) => {
    if (c.settings) autoSave = !!c.settings.newValue?.autoSave;
  });

  // ---- The page ----
  const canonical = () => document.querySelector('link[rel="canonical"]')?.href;
  const first = { href: location.href, canonical: canonical() };
  const pageUrl = () => PG.pageUrl(location.href, canonical(), first);
  // Notes saved before phase 4 are under the raw address, not the canonical one.
  const pageUrls = () => [...new Set([pageUrl(), PG.cleanUrl(location.href), location.href.split('#')[0]])];

  function pageInfo() {
    const h1 = [...document.querySelectorAll('h1')].find((h) => h.offsetParent !== null && h.innerText.trim());
    const siteName = document.querySelector('meta[property="og:site_name"]')?.content || '';
    return { h1: clean(h1?.innerText), title: clean(document.title), site: `${location.hostname} ${siteName}` };
  }

  // The nearest h2-h4 above a node: the part of the page you were reading.
  function sectionHeading(node) {
    const el = node.nodeType === 1 ? node : node.parentElement;
    if (!el) return '';
    let found = null;
    for (const h of document.querySelectorAll('h2, h3, h4')) {
      if (h.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) found = h;
      else break;
    }
    return found ? clean(found.innerText.replace(/\[\s*edit\s*\]/gi, '')).slice(0, 200) : '';
  }

  // ---- The page's text without whitespace, and which text node each piece came
  // from: turns a selection into an anchor, and an anchor back into a range. ----
  const SKIP = /^(SCRIPT|STYLE|NOSCRIPT|TEXTAREA|TEMPLATE)$/;
  function indexText() {
    const nodes = [];
    const starts = [];
    let text = '';
    const walk = document.createTreeWalker(document.body || document.documentElement, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (SKIP.test(n.parentNode?.nodeName) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
    });
    for (let n; (n = walk.nextNode());) {
      const s = PG.strip(n.data);
      if (!s) continue;
      nodes.push(n);
      starts.push(text.length);
      text += s;
    }
    return { text, nodes, starts };
  }

  /** Offset in text node n of its k-th character that isn't whitespace. */
  function offsetOf(n, k) {
    for (let i = 0; i < n.data.length; i++) if (!/\s/.test(n.data[i]) && k-- === 0) return i;
    return n.data.length;
  }

  /** The DOM range for index.text[start, end). */
  function toRange(index, { start, end }) {
    const at = (c) => { // the node holding character c, and c's offset in it
      let lo = 0;
      let hi = index.starts.length - 1;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (index.starts[mid] <= c) lo = mid;
        else hi = mid - 1;
      }
      return [index.nodes[lo], offsetOf(index.nodes[lo], c - index.starts[lo])];
    };
    const range = document.createRange();
    const [a, i] = at(start);
    const [b, j] = at(end - 1);
    range.setStart(a, i);
    range.setEnd(b, j + 1);
    return range;
  }

  /** Where a DOM range sits in index.text, as { start, end }, or null. */
  function toOffsets(index, range) {
    let start = -1;
    let end = -1;
    for (let j = 0; j < index.nodes.length; j++) {
      const n = index.nodes[j];
      if (!range.intersectsNode(n)) {
        if (start !== -1) break;
        continue;
      }
      const from = n === range.startContainer ? range.startOffset : 0;
      const to = n === range.endContainer ? range.endOffset : n.data.length;
      const inside = PG.strip(n.data.slice(from, to)).length;
      if (!inside) continue;
      const before = PG.strip(n.data.slice(0, from)).length;
      if (start === -1) start = index.starts[j] + before;
      end = index.starts[j] + before + inside;
    }
    return start === -1 ? null : { start, end };
  }

  // ---- Marks: saved passages tinted with the CSS Custom Highlight API, which
  // leaves the page's DOM alone. One highlight per colour; the tints are in content.css. ----
  const marks = new Map(); // highlight id → { range, color }
  function paint() {
    if (!window.Highlight) return;
    for (const c of COLORS) {
      CSS.highlights.set(`sn-${c}`, new Highlight(...[...marks.values()].filter((m) => m.color === c).map((m) => m.range)));
    }
  }

  /** Marks this page's saved highlights: keeps ranges still on the page and finds
   *  the rest by their anchors. Returns how many it couldn't find. */
  function apply(highlights) {
    const keep = new Set(highlights.map((h) => h.id));
    for (const id of marks.keys()) if (!keep.has(id)) marks.delete(id);
    let index = null;
    let missing = 0;
    for (const h of highlights) {
      const live = marks.get(h.id)?.range;
      if (live && !live.collapsed && live.startContainer.isConnected) continue;
      index ??= indexText();
      const at = PG.locate(index.text, h.text, h.anchor);
      if (at) {
        marks.set(h.id, { range: toRange(index, at), color: h.color || 'yellow' });
      } else {
        marks.delete(h.id);
        missing++;
      }
    }
    paint();
    return missing;
  }

  // ---- Restoring marks: when the page loads, once more a little later for
  // content that renders late, and again when an app moves to another page. ----
  let run = 0;
  let welcomed = '';
  async function restore() {
    const mine = ++run;
    for (let attempt = 0; attempt < 2; attempt++) {
      if (attempt) await new Promise((done) => setTimeout(done, 2500));
      const url = pageUrl();
      const r = await send({ type: 'page', url, also: pageUrls() });
      if (mine !== run || !r.highlights) return;
      if (apply(r.highlights) && !attempt) continue;
      if (marks.size && welcomed !== url) {
        welcomed = url;
        banner(marks.size);
      }
      return;
    }
  }

  let shown = location.href.split('#')[0];
  function onNavigate() {
    const href = location.href.split('#')[0];
    if (href === shown) return;
    shown = href;
    run++; // drops a restore still running for the last page
    marks.clear();
    paint();
    hideBar();
    setTimeout(restore, 1000); // gives the app a moment to render the new page
  }

  // ---- UI, in a closed shadow root: page CSS can't restyle it and page scripts
  // can't read your topics out of it. Georgia stands in for the Classical fonts,
  // which pages don't have. ----
  const PLUS = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/><path d="M12 5v14"/></svg>';
  const CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';
  const DOWN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
  const host = document.createElement('div');
  host.style.cssText = 'all:initial;position:fixed;top:0;left:0;z-index:2147483647;';
  const root = host.attachShadow({ mode: 'closed' });
  root.innerHTML = `
    <style>
      :host { all: initial; }
      * { box-sizing: border-box; }
      .bar, .banner, .toast { position: fixed; display: none; color: #201f1d; font: 14px/1.4 Georgia, 'Times New Roman', serif; }
      .on { display: flex; }
      .bar { align-items: center; gap: 4px; max-width: calc(100vw - 16px); padding: 4px; background: #f8f4f4;
        border: 1px solid #b68235; border-radius: 4px; box-shadow: 0 3px 10px rgba(45, 43, 43, .16); }
      /* Highlighter colours: click one to save in it. Your last one is ringed; Save note and Alt+S use it. */
      .inks { display: flex; flex: none; gap: 6px; padding: 0 9px; border-inline: 1px solid rgba(32, 31, 29, .12); }
      .ink, .ink:hover { width: 18px; height: 18px; padding: 0; border: 1px solid rgba(32, 31, 29, .25); border-radius: 50%; background: var(--c); }
      .ink:hover { transform: scale(1.15); }
      .ink[aria-current=true] { box-shadow: 0 0 0 2px #f8f4f4, 0 0 0 3.5px #7d5411; }
      [data-color=yellow] { --c: #f2d14b; }
      [data-color=pink] { --c: #ef8fb7; }
      [data-color=blue] { --c: #86b6ea; }
      [data-color=green] { --c: #93cf8c; }
      /* Where the save goes. Click it to pick another topic. */
      .to { display: inline-flex; align-items: center; gap: 5px; min-width: 0; padding: 5px 6px 5px 8px; color: #201f1d; }
      .to small { flex: none; font-size: 11px; color: #605d5d; }
      .to-name { overflow: hidden; max-width: 180px; text-overflow: ellipsis; white-space: nowrap; font-style: italic; }
      .to svg { flex: none; color: #7d5411; }
      .topic { position: absolute; top: calc(100% + 6px); right: 0; width: 270px; padding: 10px; background: #f8f4f4;
        border: 1px solid #b68235; border-radius: 6px; box-shadow: 0 8px 24px rgba(45, 43, 43, .2); }
      .bar.up .topic { top: auto; bottom: calc(100% + 6px); }
      button { margin: 0; border: 0; border-radius: 3px; background: transparent; color: #7d5411;
        font: 13px/1.4 Georgia, serif; cursor: pointer; }
      button:hover, button.first { background: rgba(182, 130, 53, .14); }
      :focus-visible { outline: 2px solid #b68235; outline-offset: 1px; }
      .save { display: inline-flex; align-items: center; gap: 6px; padding: 5px 10px; font-size: 15px; font-weight: 600; }
      svg { width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
      .banner { top: 14px; left: 50%; transform: translateX(-50%); align-items: center; gap: 8px; padding: 9px 14px;
        background: #f3f2f2; border: 1px solid rgba(32, 31, 29, .16); border-radius: 4px;
        box-shadow: 0 3px 10px rgba(45, 43, 43, .16); font-size: 13px; white-space: nowrap; }
      .banner svg { color: #7d5411; }
      .toast { right: 18px; bottom: 18px; flex-direction: column; width: min(330px, calc(100vw - 36px)); padding: 14px 16px;
        background: #f3f2f2; border: 1px solid rgba(32, 31, 29, .16); border-radius: 7px; box-shadow: 0 12px 32px rgba(45, 43, 43, .22); }
      .title { font-size: 17px; font-weight: 600; line-height: 1.2; }
      .sub { margin-top: 2px; font-size: 13px; color: #605d5d; }
      .foot, .pick { margin-top: 12px; padding-top: 10px; border-top: 1px solid rgba(32, 31, 29, .12); }
      .foot { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
      .status { display: inline-flex; align-items: center; gap: 7px; font-size: 12px; color: #605d5d; }
      .dot { width: 7px; height: 7px; flex: none; border-radius: 50%; background: #b68235; }
      .dot.synced { background: #7d5411; }
      .dot.off { background: #7d7979; }
      .actions { display: flex; flex: none; gap: 2px; }
      .actions button { padding: 4px 8px; }
      input { width: 100%; padding: 6px 8px; border: 1px solid rgba(32, 31, 29, .25); border-radius: 4px;
        background: #fff; color: #201f1d; font: 14px Georgia, serif; }
      ul { max-height: 180px; overflow: auto; margin: 6px 0 0; padding: 0; list-style: none; }
      li button { width: 100%; padding: 5px 8px; text-align: left; color: #201f1d; font-size: 14px; }
      .none { padding: 6px 8px 2px; font-size: 13px; color: #605d5d; }
      [hidden] { display: none !important; }
    </style>
    <div class="bar">
      <button class="save" type="button" title="Save note (Alt+S)">${PLUS}Save note</button>
      <span class="inks" role="group" aria-label="Highlighter colour">${COLORS.map((c) => `<button class="ink" type="button" data-color="${c}" aria-current="false" aria-label="Save in ${c}" title="Save in ${c}"></button>`).join('')}</span>
      <button class="to" type="button" aria-expanded="false" title="Pick the topic" hidden><small>to</small><span class="to-name"></span>${DOWN}</button>
      <form class="topic" hidden>
        <input aria-label="Topic" placeholder="Save to a topic…" autocomplete="off">
        <ul></ul>
      </form>
    </div>
    <div class="banner" role="status">${CHECK}<span></span></div>
    <div class="toast" role="status">
      <div class="title"></div>
      <div class="sub"></div>
      <div class="foot">
        <span class="status"><span class="dot"></span><span class="state"></span></span>
        <span class="actions">
          <button type="button" data-act="undo">Undo</button>
          <button type="button" data-act="change">Change</button>
          <button type="button" data-act="view">View</button>
        </span>
      </div>
      <form class="pick" hidden>
        <input aria-label="Topic" placeholder="Move this page to…" autocomplete="off">
        <ul></ul>
      </form>
    </div>`;
  const $ = (sel) => root.querySelector(sel);
  const bar = $('.bar');
  const toastEl = $('.toast');
  const pick = $('.pick');
  const input = $('.pick input');
  const topicForm = $('.topic');
  const topicInput = $('.topic input');
  document.documentElement.appendChild(host);
  // Keys typed into the toast stay out of the page's own shortcuts.
  for (const type of ['keydown', 'keyup', 'keypress']) root.addEventListener(type, (e) => e.stopPropagation());

  // ---- The bar: Save note, the colours, and the topic the save goes to ----
  let held = null; // the selection the bar is for, kept while its topic picker has the focus
  let ink = 'yellow'; // your last colour
  let picked = ''; // a topic picked on the bar for this save
  let plans = 0; // drops an answer that comes after the bar has moved on

  function hideBar() {
    bar.classList.remove('on');
    closePicker();
    held = null;
    plans++;
  }

  function showBar(sel) {
    held = { range: sel.getRangeAt(0).cloneRange(), text: clean(sel.toString()) };
    picked = '';
    $('.to').hidden = true;
    bar.classList.add('on');
    place();
    const mine = ++plans;
    send({ type: 'plan', url: pageUrl(), page: pageInfo() }).then((r) => {
      if (mine !== plans || r.error) return;
      ink = r.color;
      topics = r.topics;
      for (const b of root.querySelectorAll('.ink')) b.setAttribute('aria-current', String(b.dataset.color === ink));
      $('.to-name').textContent = r.topic;
      $('.to').hidden = false;
      place(); // the topic's name changed the bar's width
    });
  }

  function place() {
    const r = held.range.getBoundingClientRect();
    const { offsetWidth: w, offsetHeight: h } = bar;
    bar.style.left = `${Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2))}px`;
    bar.style.top = `${r.bottom + 8 + h < innerHeight ? r.bottom + 8 : Math.max(8, r.top - h - 8)}px`;
  }

  function openPicker() {
    topicForm.hidden = false;
    $('.to').setAttribute('aria-expanded', 'true');
    bar.classList.toggle('up', bar.getBoundingClientRect().bottom + 260 > innerHeight);
    topicInput.value = '';
    listTopics(topicForm, choose);
    topicInput.focus();
  }

  function closePicker() {
    topicForm.hidden = true;
    $('.to').setAttribute('aria-expanded', 'false');
  }

  // The picker took the page's selection; this puts it back, so you still see what you're saving.
  function giveBack() {
    closePicker();
    place();
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(held.range);
  }

  function choose(title) {
    picked = title;
    $('.to-name').textContent = title;
    giveBack();
  }

  function banner(n) {
    $('.banner span').textContent = `Restored ${n} highlight${n === 1 ? '' : 's'} from your last visit`;
    $('.banner').classList.add('on');
    setTimeout(() => $('.banner').classList.remove('on'), 3500);
  }

  // ---- The toast ----
  let note = null; // { id, url, fresh } of the note the toast is about
  let hideTimer;
  function toast({ title, sub = '', about = null, state = '', tone = '' }) {
    note = about;
    $('.title').textContent = title;
    $('.sub').textContent = sub;
    $('.sub').hidden = !sub;
    status(state, tone);
    $('[data-act=undo]').hidden = $('[data-act=change]').hidden = !about?.fresh;
    $('[data-act=view]').hidden = !about;
    $('.foot').hidden = !state && !about;
    pick.hidden = true;
    toastEl.classList.add('on');
    hideLater(about?.fresh ? 6000 : 3000);
  }

  function status(text, tone = '') {
    $('.state').textContent = text;
    $('.dot').className = `dot ${tone}`;
    $('.status').hidden = !text;
  }

  // Hides the toast after ms, though not while it's pointed at or typed in.
  function hideLater(ms) {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      if (toastEl.matches(':hover') || !pick.hidden) hideLater(1500);
      else toastEl.classList.remove('on');
    }, ms);
  }

  /** Says whether a change reached the account. */
  async function synced(id) {
    const r = await send({ type: 'sync' });
    if (note?.id !== id) return;
    if (r.error) status('Offline. Will sync when you reconnect', 'off');
    else if (r.connected) status('Synced to your library', 'synced');
    else status('Kept on this device. Connect to sync it', 'off');
  }

  // ---- Save ----
  /** Saves the selection, or the one the bar is for, in this colour (your last one if none). */
  async function saveSelection(color) {
    const sel = window.getSelection();
    const live = clean(sel?.toString());
    const target = live.length >= MIN_LEN && sel.rangeCount ? { range: sel.getRangeAt(0).cloneRange(), text: live } : held;
    const topic = picked;
    hideBar();
    if (!target) return;
    const { range, text } = target;
    if (!web) return toast({ title: "Can't save here", sub: 'Notes can only be saved on web pages.' });
    if (text.length > MAX_LEN) return toast({ title: 'Too long to save', sub: 'A note can be up to 10,000 characters.' });

    const index = indexText();
    const at = toOffsets(index, range);
    const url = pageUrl();
    const r = await send({
      type: 'save',
      input: {
        url, site: location.hostname, page: pageInfo(), text, section: sectionHeading(range.startContainer),
        anchor: at && PG.describe(index.text, at.start, at.end), color, topic,
      },
    });
    if (r.error) return toast({ title: "Couldn't save", sub: r.error });
    sel.removeAllRanges();
    if (r.duplicate) {
      return toast({
        title: 'Already saved', sub: `This passage is already in your notes${r.section ? ` under ${r.section}` : ''}.`,
        about: { id: r.id, url }, state: 'No changes', tone: 'off',
      });
    }
    ink = r.color;
    marks.set(r.id, { range, color: r.color });
    paint();
    toast({ title: `Saved to ${r.topic}`, sub: r.section && `Under ${r.section}`, about: { id: r.id, url, fresh: true }, state: 'Saved on this device…' });
    synced(r.id);
  }

  for (const b of root.querySelectorAll('.bar > button, .ink')) b.addEventListener('mousedown', (e) => e.preventDefault()); // keeps the selection
  $('.save').addEventListener('click', () => saveSelection());
  $('.inks').addEventListener('click', (e) => {
    const c = e.target.closest('.ink')?.dataset.color;
    if (c) saveSelection(c);
  });
  $('.to').addEventListener('click', () => (topicForm.hidden ? openPicker() : closePicker()));

  $('.actions').addEventListener('click', async (e) => {
    const act = e.target.closest('button')?.dataset.act;
    const about = note;
    if (!act || !about) return;
    if (act === 'view') {
      send({ type: 'view', url: about.url });
    } else if (act === 'undo') {
      const r = await send({ type: 'undo', id: about.id });
      if (r.error) return toast({ title: "Couldn't undo", sub: r.error });
      marks.delete(about.id);
      paint();
      toastEl.classList.remove('on');
    } else {
      const r = await send({ type: 'topics', id: about.id });
      if (r.error) return toast({ title: "Couldn't change the topic", sub: r.error });
      topics = r.topics;
      $('.foot').hidden = true;
      pick.hidden = false;
      input.value = '';
      listTopics(pick, moveTo);
      input.focus();
    }
  });

  // ---- Topic pickers: the bar's (where this save goes) and the toast's Change (move this page) ----
  let topics = []; // titles, the most recently used first
  function choices(form) {
    const q = clean(form.querySelector('input').value).slice(0, 300);
    const lower = q.toLowerCase();
    const list = topics.filter((t) => t.toLowerCase().includes(lower)).slice(0, 6);
    if (q && !topics.some((t) => t.toLowerCase() === lower)) list.push(q);
    return list;
  }

  function listTopics(form, onPick) {
    const known = new Set(topics.map((t) => t.toLowerCase()));
    const items = choices(form).map((title, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = i ? '' : 'first'; // what Enter picks
      b.textContent = known.has(title.toLowerCase()) ? title : `New topic “${title}”`;
      b.addEventListener('click', () => onPick(title));
      const li = document.createElement('li');
      li.append(b);
      return li;
    });
    if (!items.length) items.push(Object.assign(document.createElement('li'), { className: 'none', textContent: 'Type a name to start a new topic.' }));
    form.querySelector('ul').replaceChildren(...items);
  }

  async function moveTo(title) {
    const about = note;
    if (!about) return;
    const r = await send({ type: 'move', id: about.id, title });
    if (r.error) return toast({ title: "Couldn't change the topic", sub: r.error });
    toast({ title: `Saved to ${r.topic}`, sub: 'This page and its notes moved here.', about, state: 'Saved on this device…' });
    synced(about.id);
  }

  function backToToast() {
    pick.hidden = true;
    $('.foot').hidden = false;
    hideLater(3000);
  }

  // Typing filters, Enter takes the first choice, Escape backs out.
  for (const [form, onPick, back] of [[pick, moveTo, backToToast], [topicForm, choose, giveBack]]) {
    const field = form.querySelector('input');
    field.addEventListener('input', () => listTopics(form, onPick));
    field.addEventListener('keydown', (e) => { if (e.key === 'Escape') back(); });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const [title] = choices(form);
      if (title) onPick(title);
    });
  }

  // ---- Selecting ----
  function isEditable() {
    const a = document.activeElement;
    return a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.isContentEditable);
  }

  document.addEventListener('mouseup', (e) => {
    if (!chrome.runtime?.id) return host.remove(); // orphaned (see send): a fresh copy takes over
    // A page can select text and fire a mouseup itself; with auto-save on, that would save notes you never chose.
    if (!e.isTrusted || e.composedPath().includes(host)) return;
    setTimeout(() => {
      const sel = window.getSelection();
      if (clean(sel?.toString()).length < MIN_LEN || !sel.rangeCount || isEditable()) return hideBar();
      if (autoSave) return void saveSelection();
      showBar(sel);
    }, 10);
  });
  document.addEventListener('mousedown', (e) => { if (!e.composedPath().includes(host)) hideBar(); });
  window.addEventListener('scroll', hideBar, { passive: true });

  chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
    if (msg?.type === 'save-selection') { saveSelection(); reply(); } // context menu, Alt+S; replying tells the worker we're here
    else if (msg?.type === 'marks' && web && msg.url === pageUrl()) apply(msg.highlights);
    else if (msg?.type === 'page-url' && web) reply({ url: pageUrl(), also: pageUrls(), title: PG.pageTitle(pageInfo()) }); // the popup
  });

  if (web) {
    restore();
    addEventListener('pageshow', (e) => { if (e.persisted) restore(); }); // back from the back/forward cache
    if (window.navigation) navigation.addEventListener('currententrychange', onNavigate);
    else setInterval(onNavigate, 1000);
  }

  // ---- Bridge to the web app, for connecting this browser. Only on the app's own
  // origin and top frame, and only for messages the page itself posted. Tokens never
  // pass through here: the page gets a challenge and returns a single-use code. ----
  if (location.origin === SN_CONFIG.WEB_ORIGIN && window === window.top) {
    let started = false;
    const post = (msg) => window.postMessage(msg, SN_CONFIG.WEB_ORIGIN);
    window.addEventListener('message', async (e) => {
      if (e.source !== window || e.origin !== SN_CONFIG.WEB_ORIGIN || typeof e.data?.type !== 'string') return;
      if (e.data.type === 'sn:ping') {
        post({ type: 'sn:ready' }); // the web app asking whether the extension is here
      } else if (e.data.type === 'sn:hello' && !started) {
        started = true;
        const r = await send({ type: 'connect:start' });
        post(r.challenge ? { type: 'sn:challenge', challenge: r.challenge } : { type: 'sn:error', error: r.error });
      } else if (e.data.type === 'sn:code' && typeof e.data.code === 'string') {
        const r = await send({ type: 'connect:finish', code: e.data.code });
        post(r.email ? { type: 'sn:connected', email: r.email } : { type: 'sn:error', error: r.error });
      }
    });
    post({ type: 'sn:ready' });
  }
})();
