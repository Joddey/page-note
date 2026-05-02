let currentTab = null;
let currentKey = null;
let allNotes = [];

const toggleBtn   = document.getElementById("toggleBtn");
const currentUrl  = document.getElementById("currentUrl");
const noteCount   = document.getElementById("noteCount");
const notesList   = document.getElementById("notesList");
const notePreview = document.getElementById("notePreview");
const searchInput = document.getElementById("searchInput");

function siteKey(url) {
  try { return "note_" + url.split("#")[0].replace(/\/$/, ""); }
  catch { return "note_" + url; }
}
function formatDate(ts) {
  return new Date(ts).toLocaleDateString("en-US", { day: "numeric", month: "short" });
}
function shortUrl(hostname, pathname) {
  const h = hostname.replace(/^www\./, "");
  const p = pathname === "/" ? "" : pathname;
  return h + (p.length > 28 ? p.substring(0, 28) + "…" : p);
}

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTab = tab;
  const isRestricted = !tab || !tab.url || tab.url.startsWith("chrome://") || tab.url.startsWith("chrome-extension://");

  if (!isRestricted) {
    const url = new URL(tab.url);
    currentKey = siteKey(tab.url);
    currentUrl.textContent = shortUrl(url.hostname, url.pathname);
  } else {
    currentUrl.textContent = "Doesn't work on this page";
    toggleBtn.disabled = true;
    toggleBtn.style.opacity = "0.35";
  }

  loadAllNotes();

  if (!isRestricted && currentKey) {
    chrome.storage.local.get([currentKey], res => {
      const note = res[currentKey];
      if (note && note.text) {
        toggleBtn.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
          Open / Edit Note
        `;
        toggleBtn.className = "toggle-btn btn-view";
        notePreview.textContent = note.text.length > 90 ? note.text.substring(0, 90) + "…" : note.text;
        notePreview.className = `current-note-preview show preview-${note.color || "yellow"}`;
      }
    });
  }
}

function loadAllNotes(filter = "") {
  chrome.storage.local.get(null, all => {
    allNotes = Object.entries(all)
      .filter(([k]) => k.startsWith("note_"))
      .map(([k, v]) => ({ key: k, ...v }))
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

    const plural = allNotes.length === 1 ? "1 note" : `${allNotes.length} notes`;
    noteCount.textContent = plural;

    const filtered = filter
      ? allNotes.filter(n =>
          (n.text || "").toLowerCase().includes(filter.toLowerCase()) ||
          (n.url || "").toLowerCase().includes(filter.toLowerCase())
        )
      : allNotes;

    renderNotes(filtered);
  });
}

function renderNotes(notes) {
  notesList.innerHTML = "";

  if (notes.length === 0) {
    notesList.innerHTML = `
      <div class="empty">
        <div class="empty-icon">📝</div>
        ${allNotes.length === 0
          ? "No notes yet.<br>Go to any page and add a note."
          : "No results found."}
      </div>`;
    return;
  }

  const header = document.createElement("div");
  header.className = "section-header";
  header.innerHTML = `<span>ALL NOTES</span><button class="clear-all" id="clearAll">Delete all</button>`;
  notesList.appendChild(header);

  document.getElementById("clearAll").addEventListener("click", () => {
    if (!confirm(`Delete all ${allNotes.length} notes?`)) return;
    chrome.storage.local.remove(allNotes.map(n => n.key), () => location.reload());
  });

  notes.forEach(note => {
    const color = note.color || "yellow";
    const url = note.url ? (() => { try { return new URL(note.url); } catch { return null; } })() : null;
    const displayUrl = url ? shortUrl(url.hostname, url.pathname + (url.search||"")) : note.key.replace("note_", "");

    const div = document.createElement("div");
    div.className = "note-item";
    div.innerHTML = `
      <div class="note-dot dot-${color}"></div>
      <div class="note-info">
        <div class="note-url">${displayUrl}</div>
        <div class="note-preview">${note.text ? (note.text.length > 55 ? note.text.substring(0, 55) + "…" : note.text) : ""}</div>
        <div class="note-date">${note.updatedAt ? formatDate(note.updatedAt) : ""}</div>
      </div>
    `;
    div.addEventListener("click", () => { if (note.url) chrome.tabs.create({ url: note.url }); });
    notesList.appendChild(div);
  });
}

searchInput.addEventListener("input", () => loadAllNotes(searchInput.value));

toggleBtn.addEventListener("click", () => {
  if (!currentTab || toggleBtn.disabled) return;
  chrome.runtime.sendMessage({ action: "toggleFromPopup", tabId: currentTab.id });
  window.close();
});

init();
