// Helpers shared by popup.html and notes.html. These pages only read the store;
// changes go to background.js by message.
const HN = {
  async getStore() {
    const { store } = await chrome.storage.local.get('store');
    return store || SN.emptyStore();
  },
  async getAuth() {
    return (await chrome.storage.local.get('auth')).auth;
  },
  send: (msg) => chrome.runtime.sendMessage(msg),

  esc(s) {
    return String(s).replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  },

  // Group notes by section, keeping the order sections first appeared in
  groupBySection(notes) {
    const map = new Map();
    for (const n of notes) {
      const k = n.section || '';
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(n);
    }
    return [...map.entries()];
  },

  /** A topic as Markdown: notes by section, each marked [n] with its source, then
   *  the numbered Sources list. */
  topicToMarkdown(store, topicId) {
    const sources = Object.values(store.sources).filter((s) => s.topic_id === topicId);
    const notes = sources.flatMap((s, i) => SN.notesFor(store, s.url).map((n) => ({ ...n, ref: i + 1 })));
    let md = `# ${store.topics[topicId]?.title || 'Notes'}\n\n`;
    for (const [sec, list] of HN.groupBySection(notes)) {
      if (sec) md += `## ${sec}\n\n`;
      md += list.map((n) => `- ${n.text} [${n.ref}]`).join('\n') + '\n\n';
    }
    return md + '## Sources\n\n' + sources.map((s, i) => `${i + 1}. [${s.title || s.url}](${s.url})`).join('\n') + '\n';
  },

  // Renders notes; onDelete(noteId) is called for the × buttons
  renderNotes(notes, container, onDelete) {
    container.innerHTML = HN.groupBySection(notes).map(([sec, list]) => `
      ${sec ? `<h3 class="section">${HN.esc(sec)}</h3>` : ''}
      <ul>${list.map((n) => `
        <li><span>${HN.esc(n.text)}</span>
          <button class="del" data-id="${HN.esc(n.id)}" title="Delete note">×</button></li>`).join('')}
      </ul>`).join('');
    container.querySelectorAll('.del').forEach((b) =>
      b.addEventListener('click', () => onDelete(b.dataset.id)));
  },

  download(filename, text, type = 'text/markdown') {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
};
