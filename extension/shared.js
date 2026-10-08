// Helpers shared by popup.html and notes.html
const HN = {
  async getPages() {
    const { pages = {} } = await chrome.storage.local.get('pages');
    return pages;
  },
  async setPages(pages) { await chrome.storage.local.set({ pages }); },

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

  pageToMarkdown(page) {
    let md = `# ${page.title}\n\nSource: ${page.url}\n\n`;
    for (const [sec, notes] of HN.groupBySection(page.notes)) {
      if (sec) md += `## ${sec}\n\n`;
      md += notes.map((n) => `- ${n.text}`).join('\n') + '\n\n';
    }
    return md.trimEnd() + '\n';
  },

  // Renders one page's notes; onDelete(noteId) is called for the × buttons
  renderNotes(page, container, onDelete) {
    container.innerHTML = HN.groupBySection(page.notes).map(([sec, notes]) => `
      ${sec ? `<h3 class="section">${HN.esc(sec)}</h3>` : ''}
      <ul>${notes.map((n) => `
        <li><span>${HN.esc(n.text)}</span>
          <button class="del" data-id="${n.id}" title="Delete note">×</button></li>`).join('')}
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
