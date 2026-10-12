// The toolbar popup: this page's topic and note count, sync state, auto-save and
// the way to the notes. It reads the store; changes go to background.js.
(async () => {
  const $ = (id) => document.getElementById(id);
  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  // The page's content script knows its address (canonical link, in-app navigation).
  const page = tab?.id === undefined ? null
    : await chrome.tabs.sendMessage(tab.id, { type: 'page-url' }).catch(() => null);
  let topicId = null;
  let syncing = true;
  let syncError = '';

  function initials(user) {
    const words = (user?.name || '').split(/\s+/).filter(Boolean);
    return (words.length ? words.slice(0, 2).map((w) => w[0]) : [user?.email?.[0] || '?']).join('').toUpperCase();
  }

  function syncLine(auth, waiting) {
    if (!auth) return ['Not connected. Notes stay on this device.', 'off'];
    if (syncing) return ['Syncing your notes…', ''];
    if (syncError) {
      return [waiting ? `Offline. ${plural(waiting, 'change')} will sync when you reconnect.` : 'Offline. New notes are kept on this device.', 'off'];
    }
    if (waiting) return [`${plural(waiting, 'change')} waiting to sync`, ''];
    return ['All notes synced', 'synced'];
  }

  async function render() {
    const [store, auth] = await Promise.all([HN.getStore(), HN.getAuth()]);
    const notes = page?.url ? SN.notesFor(store, page.also ?? page.url) : [];
    topicId = notes.length ? store.sources[notes[0].url]?.topic_id ?? null : null;
    const sections = new Set(notes.map((n) => n.section).filter(Boolean)).size;
    if (!page?.url) {
      $('title').textContent = "Notes can't be saved here";
      $('count').textContent = 'Open a web page, or reload this one, to save notes on it.';
    } else {
      $('title').textContent = store.topics[topicId]?.title || page.title || 'This page';
      $('count').textContent = notes.length
        ? plural(notes.length, 'note') + (sections ? ` · ${plural(sections, 'section')}` : '')
        : 'No notes on this page yet';
    }
    $('page').disabled = !topicId;

    $('who').textContent = auth?.user.email || '';
    $('initials').textContent = auth ? initials(auth.user) : '';
    $('initials').hidden = !auth;
    $('connect').hidden = !!auth;
    $('disconnect').hidden = !auth;
    const [text, tone] = syncLine(auth, store.outbox.length);
    $('sync').textContent = text;
    $('dot').className = `dot ${tone}`;
  }

  const { settings = {} } = await chrome.storage.sync.get('settings');
  $('auto').setAttribute('aria-checked', String(!!settings.autoSave));
  $('auto').addEventListener('click', () => {
    const on = $('auto').getAttribute('aria-checked') !== 'true';
    $('auto').setAttribute('aria-checked', String(on));
    chrome.storage.sync.set({ settings: { ...settings, autoSave: on } });
  });

  const open = (url) => {
    chrome.tabs.create({ url });
    window.close();
  };
  // The web library once this browser is connected and has nothing waiting to sync
  // (an unsynced topic isn't there yet); the extension's own notes page otherwise.
  const onWeb = async () => !!(await HN.getAuth()) && !(await HN.getStore()).outbox.length;
  $('page').addEventListener('click', async () =>
    open(await onWeb() ? `${SN_CONFIG.WEB_ORIGIN}/t/${topicId}` : chrome.runtime.getURL(`notes.html#${topicId}`)));
  $('library').addEventListener('click', async () =>
    open(await onWeb() ? `${SN_CONFIG.WEB_ORIGIN}/library` : chrome.runtime.getURL('notes.html')));
  $('connect').addEventListener('click', () => open(`${SN_CONFIG.WEB_ORIGIN}/extension/connect`));
  $('disconnect').addEventListener('click', async () => {
    if (!confirm('Disconnect this browser? Your notes stay in your stickynotes account.')) return;
    const r = await HN.send({ type: 'disconnect' });
    if (r?.error) $('sync').textContent = r.error;
  });

  chrome.storage.onChanged.addListener((c) => { if (c.store || c.auth) render(); });
  render();
  // Opening the popup is a sync trigger.
  const r = await HN.send({ type: 'sync' }).catch((e) => ({ error: e.message }));
  syncing = false;
  syncError = r?.error || '';
  render();
})();
