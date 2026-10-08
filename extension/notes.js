const list = document.getElementById('list');
const search = document.getElementById('search');

async function render() {
  const pages = await HN.getPages();
  const q = search.value.trim().toLowerCase();
  const entries = Object.values(pages)
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    .map((p) => {
      if (!q) return p;
      if (p.title.toLowerCase().includes(q)) return p;
      const notes = p.notes.filter((n) =>
        n.text.toLowerCase().includes(q) || (n.section || '').toLowerCase().includes(q));
      return notes.length ? { ...p, notes } : null;
    })
    .filter(Boolean);

  if (!entries.length) {
    list.innerHTML = `<div class="empty">${q ? 'No matches.' : 'No notes yet — go highlight something!'}</div>`;
    return;
  }

  list.innerHTML = '';
  for (const page of entries) {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div class="row card-head">
        <div>
          <h2><a href="${HN.esc(page.url)}" target="_blank">${HN.esc(page.title)}</a></h2>
          <div class="muted">${HN.esc(page.site)} · ${page.notes.length} note${page.notes.length > 1 ? 's' : ''}
            · ${new Date(page.updatedAt || page.createdAt).toLocaleDateString()}</div>
        </div>
        <div class="row">
          <button class="copy">Copy MD</button>
          <button class="rename">Rename</button>
          <button class="remove">Delete</button>
        </div>
      </div>
      <div class="notes"></div>`;

    HN.renderNotes(page, card.querySelector('.notes'), async (id) => {
      const p = await HN.getPages();
      p[page.url].notes = p[page.url].notes.filter((n) => n.id !== id);
      if (!p[page.url].notes.length) delete p[page.url];
      await HN.setPages(p);
    });

    card.querySelector('.copy').onclick = async (e) => {
      const p = await HN.getPages();
      await navigator.clipboard.writeText(HN.pageToMarkdown(p[page.url]));
      e.target.textContent = 'Copied!';
      setTimeout(() => (e.target.textContent = 'Copy MD'), 1200);
    };
    card.querySelector('.rename').onclick = async () => {
      const t = prompt('Note heading:', page.title);
      if (!t?.trim()) return;
      const p = await HN.getPages();
      p[page.url].title = t.trim();
      await HN.setPages(p);
    };
    card.querySelector('.remove').onclick = async () => {
      if (!confirm(`Delete all notes for “${page.title}”?`)) return;
      const p = await HN.getPages();
      delete p[page.url];
      await HN.setPages(p);
    };
    list.appendChild(card);
  }
}

document.getElementById('exportMd').onclick = async () => {
  const pages = Object.values(await HN.getPages());
  HN.download('notes.md', pages.map(HN.pageToMarkdown).join('\n---\n\n'));
};
document.getElementById('exportJson').onclick = async () => {
  HN.download('notes-backup.json', JSON.stringify(await HN.getPages(), null, 2), 'application/json');
};
document.getElementById('importBtn').onclick = () => document.getElementById('importFile').click();
document.getElementById('importFile').onchange = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const incoming = JSON.parse(await file.text());
    const pages = await HN.getPages();
    for (const [k, p] of Object.entries(incoming)) {
      if (!pages[k]) { pages[k] = p; continue; }
      const seen = new Set(pages[k].notes.map((n) => n.text));
      pages[k].notes.push(...p.notes.filter((n) => !seen.has(n.text)));
    }
    await HN.setPages(pages);
  } catch { alert('That file is not a valid notes backup.'); }
};

search.addEventListener('input', render);
chrome.storage.onChanged.addListener((c) => { if (c.pages) render(); }); // live-updates while you read
render();
