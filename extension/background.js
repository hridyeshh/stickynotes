chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: 'hn-save', title: 'Save to notes', contexts: ['selection'] });
});

const askTabToSave = (tabId) =>
  chrome.tabs.sendMessage(tabId, { type: 'save-selection' }).catch(() => {});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'hn-save' && tab?.id) askTabToSave(tab.id);
});

chrome.commands.onCommand.addListener((cmd, tab) => {
  if (cmd === 'save-selection' && tab?.id) askTabToSave(tab.id);
});
