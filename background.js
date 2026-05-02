async function injectAndToggle(tabId) {
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
    await chrome.scripting.insertCSS({ target: { tabId }, files: ["content.css"] });
  } catch (e) {}
  // inject bittikten sonra kısa bekle sonra mesaj gönder
  setTimeout(() => {
    chrome.tabs.sendMessage(tabId, { action: "toggle" }, () => {
      if (chrome.runtime.lastError) {}
    });
  }, 100);
}

// Popup butonundan gelen mesaj
chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
  if (req.action === "toggleFromPopup") {
    injectAndToggle(req.tabId);
    sendResponse({ ok: true });
  }
  return true;
});

// Klavye kısayolu
chrome.commands.onCommand.addListener(async (command) => {
  if (command === "toggle-note") {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.id) injectAndToggle(tab.id);
  }
});
