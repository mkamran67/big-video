type ButtonPosition = "top-left" | "top-right" | "bottom-left" | "bottom-right";

const STORAGE_KEY = "buttonPosition";
const HIDDEN_PREFIX = "bv_hidden_";
const DEFAULT_POSITION: ButtonPosition = "top-right";

const LABELS: Record<ButtonPosition, string> = {
  "top-left": "Top Left", "top-right": "Top Right",
  "bottom-left": "Bottom Left", "bottom-right": "Bottom Right",
};

// ─── Position picker ──────────────────────────────────────────────────────────

function setActive(position: ButtonPosition): void {
  document.querySelectorAll<HTMLElement>(".pos-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.pos === position);
  });
  const label = document.getElementById("pos-label");
  if (label) label.textContent = LABELS[position];
}

// ─── Element hider list ───────────────────────────────────────────────────────

function renderList(selectors: string[], domain: string): void {
  const list = document.getElementById("selectors-list")!;
  list.innerHTML = "";
  if (selectors.length === 0) {
    list.innerHTML = '<p class="empty-msg">No elements hidden for this site</p>';
    return;
  }
  selectors.forEach((sel, i) => {
    const item = document.createElement("div");
    item.className = "selector-item";

    const text = document.createElement("span");
    text.className = "selector-text";
    text.textContent = sel;
    text.title = sel;

    const del = document.createElement("button");
    del.className = "del-btn";
    del.title = "Remove";
    del.textContent = "✕";
    del.addEventListener("click", () => {
      const updated = selectors.filter((_, idx) => idx !== i);
      chrome.storage.sync.set({ [HIDDEN_PREFIX + domain]: updated });
    });

    item.appendChild(text);
    item.appendChild(del);
    list.appendChild(item);
  });
}

// ─── Init ─────────────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {
  // Position picker
  chrome.storage.sync.get({ [STORAGE_KEY]: DEFAULT_POSITION }, (result) => {
    setActive(result[STORAGE_KEY] as ButtonPosition);
  });
  document.querySelectorAll<HTMLElement>(".pos-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const pos = btn.dataset.pos as ButtonPosition;
      setActive(pos);
      chrome.storage.sync.set({ [STORAGE_KEY]: pos });
    });
  });

  // Element hider
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (!tab?.url || !tab.id) return;
    let domain = "";
    try { domain = new URL(tab.url).hostname; } catch { return; }

    const badge = document.getElementById("domain-badge");
    if (badge) badge.textContent = domain;

    const storageKey = HIDDEN_PREFIX + domain;

    // Load initial list
    chrome.storage.sync.get({ [storageKey]: [] }, (result) => {
      renderList(result[storageKey] as string[], domain);
    });

    // Live-update list if content script saves while popup is open
    chrome.storage.onChanged.addListener((changes) => {
      if (changes[storageKey]) {
        renderList(changes[storageKey].newValue as string[], domain);
      }
    });

    // Picker button — sends message then popup auto-closes
    document.getElementById("picker-btn")?.addEventListener("click", () => {
      chrome.tabs.sendMessage(tab.id!, { action: "startPicker" });
      window.close();
    });
  });
});
