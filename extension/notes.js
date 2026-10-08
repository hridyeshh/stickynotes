const list = document.getElementById('list');
const search = document.getElementById('search');

async function render() {
  const store = await HN.getStore();
  const q = search.value.trim().toLowerCase();
  const hit = (s) => (s || '').toLowerCase().includes(q);
  const topics = Object.values(store.topics)
    .map((t) => {
      const sources = Object.values(store.sources)
        .filter((s) => s.topic_id === t.id)
        .map((s) => {
          const all = HN.notesFor(store, s.url);
          const notes = !q || hit(t.title) || hit(s.title) ? all : all.filter((n) => hit(n.text) || hit(n.section));
          return { ...s, all, notes };
        })
        .filter((s) => s.notes.length);
      const latest = sources.flatMap((s) => s.all.map((n) => n.created_at)).sort().pop() || '';
      return { ...t, sources, latest };
    })
    .filter((t) => t.sources.length)
    .sort((a, b) => b.latest.localeCompare(a.latest));

  if (!topics.length) {
    list.innerHTML = `<div class="empty">${q ? 'No matches.' : 'No notes yet. Go highlight something!'}</div>`;
    return;
  }

  list.innerHTML = '';
  for (const t of topics) {
    const count = t.sources.reduce((n, s) => n + s.notes.length, 0);
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div class="row card-head">
        <div>
          <h2>${HN.esc(t.title)}</h2>
          <div class="muted">${count} note${count > 1 ? 's' : ''} from ${t.sources.length} source${t.sources.length > 1 ? 's' : ''}</div>
        </div>
        <button class="copy">Copy MD</button>
      </div>`;
    card.querySelector('.copy').onclick = async (e) => {
      await navigator.clipboard.writeText(HN.topicToMarkdown(store, t.id));
      e.target.textContent = 'Copied!';
      setTimeout(() => (e.target.textContent = 'Copy MD'), 1200);
    };

    for (const s of t.sources) {
      const block = document.createElement('div');
      block.className = 'source';
      block.innerHTML = `
        <div class="row card-head">
          <div>
            <a href="${HN.esc(s.url)}" target="_blank" rel="noopener">${HN.esc(s.title || s.url)}</a>
            <div class="muted">${HN.esc(s.site)}</div>
          </div>
          <button class="remove">Delete</button>
        </div>
        <div class="notes"></div>`;
      HN.renderNotes(s.notes, block.querySelector('.notes'), (id) => HN.send({ type: 'delete', ids: [id] }));
      block.querySelector('.remove').onclick = () => {
        if (confirm(`Delete all ${s.all.length} notes from “${s.title || s.url}”?`)) {
          HN.send({ type: 'delete', ids: s.all.map((n) => n.id) });
        }
      };
      card.appendChild(block);
    }
    list.appendChild(card);
  }
}

document.getElementById('exportMd').onclick = async () => {
  const store = await HN.getStore();
  const ids = Object.keys(store.topics).filter((id) => Object.values(store.sources).some((s) => s.topic_id === id));
  HN.download('notes.md', ids.map((id) => HN.topicToMarkdown(store, id)).join('\n---\n\n'));
};
document.getElementById('exportJson').onclick = async () => {
  HN.download('notes-backup.json', JSON.stringify(SN.toBackup(await HN.getStore()), null, 2), 'application/json');
};
document.getElementById('importBtn').onclick = () => document.getElementById('importFile').click();
document.getElementById('importFile').onchange = async (e) => {
  const file = e.target.files[0];
  e.target.value = ''; // so the same file can be picked again
  if (!file) return;
  let pages;
  try {
    pages = JSON.parse(await file.text());
  } catch {
    return alert('That file is not a valid notes backup.');
  }
  const r = await HN.send({ type: 'import', pages });
  alert(r?.error || `Restored ${r.added} note${r.added === 1 ? '' : 's'}.`);
};

search.addEventListener('input', render);
chrome.storage.onChanged.addListener((c) => { if (c.store) render(); }); // live-updates while you read
render();
