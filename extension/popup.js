(async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  // The same key content.js saves under: the URL without its #hash.
  const url = /^https?:/.test(tab?.url || '') ? tab.url.split('#')[0] : null;
  const $ = (id) => document.getElementById(id);
  let topicId = null;

  async function render() {
    const store = await HN.getStore();
    const notes = url ? HN.notesFor(store, url) : [];
    const source = url && store.sources[url];
    topicId = source?.topic_id ?? null;
    if (!notes.length) {
      $('title').textContent = 'No notes on this page yet';
      $('count').textContent = 'Select text, then click “＋ Save note” (or press Alt+S).';
      $('notes').innerHTML = '';
      $('copy').disabled = true;
    } else {
      $('title').textContent = store.topics[topicId]?.title || source.title;
      $('count').textContent = `${notes.length} note${notes.length > 1 ? 's' : ''} from this page`;
      $('copy').disabled = false;
      HN.renderNotes(notes, $('notes'), (id) => HN.send({ type: 'delete', ids: [id] }));
    }
    renderAccount(store);
  }

  async function renderAccount(store) {
    const auth = await HN.getAuth();
    const waiting = store.outbox.length ? ` · ${store.outbox.length} waiting to sync` : '';
    $('account').innerHTML = auth
      ? `<span>Syncing as ${HN.esc(auth.user.email)}${waiting}</span><button id="disconnect">Disconnect</button>`
      : `<span>Not connected${waiting}</span><button id="connect" class="primary">Connect</button>`;
    if (!auth) {
      $('connect').onclick = () => chrome.tabs.create({ url: SN_CONFIG.WEB_ORIGIN + '/extension/connect' });
      return;
    }
    $('disconnect').onclick = async () => {
      if (!confirm('Disconnect this browser? Your notes stay in your stickynotes account.')) return;
      const r = await HN.send({ type: 'disconnect' });
      if (r?.error) $('account').firstChild.textContent = r.error;
    };
  }

  const { settings = {} } = await chrome.storage.local.get('settings');
  $('auto').checked = !!settings.autoSave;
  $('auto').addEventListener('change', (e) =>
    chrome.storage.local.set({ settings: { ...settings, autoSave: e.target.checked } }));

  $('copy').addEventListener('click', async () => {
    await navigator.clipboard.writeText(HN.topicToMarkdown(await HN.getStore(), topicId));
    $('copy').textContent = 'Copied!';
    setTimeout(() => ($('copy').textContent = 'Copy MD'), 1200);
  });
  $('all').addEventListener('click', () =>
    chrome.tabs.create({ url: chrome.runtime.getURL('notes.html') }));

  chrome.storage.onChanged.addListener((c) => { if (c.store || c.auth) render(); });
  render();
  HN.send({ type: 'sync' }).catch(() => {}); // opening the popup is a sync trigger
})();
