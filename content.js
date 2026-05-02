(function() {
if (window.__stickyNotesLoaded) return;
window.__stickyNotesLoaded = true;

const COLORS = ["yellow", "blue", "green", "pink"];

// Key olarak tam URL kullan (hash hariç)
const siteKey = "note_" + location.href.split("#")[0].replace(/\/$/, "");

let widget = null;
let visible = false;
let currentColor = "yellow";

function getNote(cb) { chrome.storage.local.get([siteKey], res => cb(res[siteKey] || null)); }
function saveNote(data) { chrome.storage.local.set({ [siteKey]: data }); }
function deleteNote() { chrome.storage.local.remove([siteKey]); }
function fmt(ts) {
  return new Date(ts).toLocaleDateString("en-US", { day:"numeric", month:"short", year:"numeric" });
}

function mk(tag, cls, txt) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (txt) e.textContent = txt;
  return e;
}

function mkSVG() {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("width","12"); svg.setAttribute("height","12");
  svg.setAttribute("viewBox","0 0 24 24"); svg.setAttribute("fill","none");
  svg.setAttribute("stroke","currentColor"); svg.setAttribute("stroke-width","2.5");
  svg.setAttribute("stroke-linecap","round"); svg.setAttribute("stroke-linejoin","round");
  const p1 = document.createElementNS(ns, "path"); p1.setAttribute("d","M12 20h9");
  const p2 = document.createElementNS(ns, "path"); p2.setAttribute("d","M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z");
  svg.appendChild(p1); svg.appendChild(p2);
  return svg;
}

function buildWidget(note) {
  if (widget) widget.remove();
  currentColor = (note && note.color) || "yellow";
  const hasNote = !!(note && note.text && note.text.trim());

  widget = mk("div");
  widget.id = "__sticky-note-widget";
  widget.className = "sn-" + currentColor;

  // Header
  const titleSpan = mk("span", "sn-title");
  titleSpan.appendChild(mkSVG());
  titleSpan.appendChild(document.createTextNode(" PAGE NOTE"));

  const dateSpan = mk("span", "sn-date", hasNote ? fmt(note.updatedAt) : "");
  const closeBtn = mk("button", "sn-close", "✕");
  const headerRight = mk("div", "sn-header-right");
  headerRight.appendChild(dateSpan);
  headerRight.appendChild(closeBtn);

  const header = mk("div", "sn-header");
  header.appendChild(titleSpan);
  header.appendChild(headerRight);

  // Textarea
  const ta = mk("textarea", "sn-textarea");
  ta.placeholder = "Leave a note for this page...";
  ta.value = hasNote ? note.text : "";

  // Colors
  const colorsDiv = mk("div", "sn-colors");
  COLORS.forEach(c => {
    const dot = mk("div", "sn-color-dot c-" + c + (c === currentColor ? " active" : ""));
    dot.dataset.color = c;
    dot.addEventListener("click", () => {
      currentColor = c;
      widget.className = "sn-" + c;
      colorsDiv.querySelectorAll(".sn-color-dot").forEach(d => d.classList.toggle("active", d === dot));
      getNote(n => { if (n) saveNote({...n, color: c}); });
    });
    colorsDiv.appendChild(dot);
  });

  // Buttons
  const saveBtn = mk("button", "sn-btn sn-primary sn-save", "Save");
  const deleteBtn = mk("button", "sn-btn sn-delete", "Delete");
  if (!hasNote) deleteBtn.style.display = "none";

  const btns = mk("div", "sn-btns");
  btns.appendChild(deleteBtn);
  btns.appendChild(saveBtn);

  const footer = mk("div", "sn-footer");
  footer.appendChild(colorsDiv);
  footer.appendChild(btns);

  widget.appendChild(header);
  widget.appendChild(ta);
  widget.appendChild(footer);
  document.body.appendChild(widget);

  // Save
  function doSave() {
    const text = ta.value.trim();
    if (!text) return;
    const data = { text, color: currentColor, updatedAt: Date.now(), url: location.href, hostname: location.hostname };
    saveNote(data);
    saveBtn.textContent = "Saved ✓";
    setTimeout(() => { saveBtn.textContent = "Save"; }, 1500);
    dateSpan.textContent = fmt(data.updatedAt);
    deleteBtn.style.display = "";
  }

  saveBtn.addEventListener("click", doSave);
  ta.addEventListener("keydown", e => { if ((e.ctrlKey||e.metaKey) && e.key==="s") { e.preventDefault(); doSave(); } });

  // Delete
  deleteBtn.addEventListener("click", () => {
    if (!confirm("Delete note for this page?")) return;
    deleteNote();
    ta.value = "";
    dateSpan.textContent = "";
    deleteBtn.style.display = "none";
  });

  // Close
  closeBtn.addEventListener("click", hide);

  // Textarea resize
  ta.addEventListener("input", () => { ta.style.height="auto"; ta.style.height=Math.min(ta.scrollHeight,260)+"px"; });

  // Drag
  let drag=false, ox=0, oy=0;
  header.addEventListener("mousedown", e => {
    if (e.target===closeBtn) return;
    drag=true;
    const r=widget.getBoundingClientRect(); ox=e.clientX-r.left; oy=e.clientY-r.top;
    widget.style.transition="none";
  });
  document.addEventListener("mousemove", e => {
    if (!drag) return;
    widget.style.right="auto"; widget.style.bottom="auto";
    widget.style.left=Math.max(0,Math.min(e.clientX-ox,window.innerWidth-widget.offsetWidth))+"px";
    widget.style.top=Math.max(0,Math.min(e.clientY-oy,window.innerHeight-widget.offsetHeight))+"px";
  });
  document.addEventListener("mouseup", ()=>{ drag=false; });
}

function show() {
  if (!widget) return;
  widget.style.display = "flex";
  requestAnimationFrame(()=>requestAnimationFrame(()=>widget.classList.add("sn-visible")));
  visible = true;
  setTimeout(()=>{ const ta=widget.querySelector(".sn-textarea"); if(ta) ta.focus(); }, 80);
}

function hide() {
  if (!widget) return;
  widget.classList.remove("sn-visible");
  setTimeout(()=>{ if(widget) widget.style.display="none"; }, 200);
  visible = false;
}

function toggle() {
  if (visible) { hide(); return; }
  if (widget) { show(); return; }
  getNote(note => { buildWidget(note); show(); });
}

// Sayfa yüklenince storage'da not varsa widget'ı göster
console.log("[PageNote] siteKey:", siteKey);
getNote(note => {
  console.log("[PageNote] note found:", note);
  if (note && note.text) {
    buildWidget(note);
    show();
  }
});

chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
  if (req.action === "toggle") {
    toggle();
    sendResponse({ ok: true });
    return true;
  }
  if (req.action === "getStatus") {
    getNote(note => sendResponse({ hasNote: !!(note&&note.text), color:(note&&note.color)||"yellow", visible }));
    return true;
  }
});

})();
