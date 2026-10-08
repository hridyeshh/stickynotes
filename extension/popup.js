(async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  let key = null;
  try { const u = new URL(tab.url); key = u.origin + u.pathname; } catch {}

  const $ = (id) => document.getElementById(id);

  async function render() {
    const pages = await HN.getPages();
    const page = key && pages[key];
    if (!page || !page.notes.length) {
      $('title').textContent = 'No notes on this page yet';
      $('count').textContent = 'Select text, then click “＋ Save note” (or press Alt+S).';
      $('notes').innerHTML = '';
      $('copy').disabled = true;
      return;
    }
    $('title').textContent = page.title;
    $('count').textContent = `${page.notes.length} note${page.notes.length > 1 ? 's' : ''}`;
    $('copy').disabled = false;
    HN.renderNotes(page, $('notes'), async (id) => {
      const p = await HN.getPages();
      p[key].notes = p[key].notes.filter((n) => n.id !== id);
      if (!p[key].notes.length) delete p[key];
      await HN.setPages(p);
      render();
    });
  }

  const { settings = {} } = await chrome.storage.local.get('settings');
  $('auto').checked = !!settings.autoSave;
  $('auto').addEventListener('change', (e) =>
    chrome.storage.local.set({ settings: { ...settings, autoSave: e.target.checked } }));

  $('copy').addEventListener('click', async () => {
    const pages = await HN.getPages();
    await navigator.clipboard.writeText(HN.pageToMarkdown(pages[key]));
    $('copy').textContent = 'Copied!';
    setTimeout(() => ($('copy').textContent = 'Copy MD'), 1200);
  });
  $('all').addEventListener('click', () =>
    chrome.tabs.create({ url: chrome.runtime.getURL('notes.html') }));

  render();
})();
